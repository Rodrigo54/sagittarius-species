import { lexer, type Token, type Tokens } from 'marked';

// Steam só suporta headings até [h1]-[h3] no BBCode dela (não existe [h4]+).
const NIVEL_MAXIMO_HEADING = 3;

/** Converte uma sequência de tokens *inline* (conteúdo dentro de um parágrafo, heading, item de
 * lista, etc.) concatenando sem separador — são fragmentos da mesma linha de texto. */
function renderInline(tokens: Token[] = []): string {
  return tokens.map(renderToken).join('');
}

/** Converte uma sequência de tokens *block* (parágrafos, headings, listas no nível do documento)
 * separando cada um por uma linha em branco, como blocos de texto distintos. */
function renderBlock(tokens: Token[] = []): string {
  return tokens
    .map(renderToken)
    .filter((texto) => texto.length > 0)
    .join('\n\n');
}

function renderLista(items: Tokens.ListItem[]): string {
  const itens = items.map((item) => `[*] ${renderInline(item.tokens)}`).join('\n');
  return `[list]\n${itens}\n[/list]`;
}

/**
 * Converte um único token do parser de markdown pra BBCode (dialeto da Steam). BBCode literal já
 * presente no markdown-fonte (ex.: `[b]texto[/b]` digitado à mão) não é sintaxe markdown válida —
 * o parser o trata como texto puro, então atravessa sem mudança, sem tratamento especial aqui.
 */
function renderToken(token: Token): string {
  switch (token.type) {
    case 'heading': {
      const nivel = Math.min(token.depth, NIVEL_MAXIMO_HEADING);
      return `[h${nivel}]${renderInline(token.tokens)}[/h${nivel}]`;
    }
    case 'paragraph':
      return renderInline(token.tokens);
    case 'list':
      return renderLista(token.items);
    case 'blockquote':
      return `[quote]${renderBlock(token.tokens)}[/quote]`;
    case 'code':
      return `[code]${token.text}[/code]`;
    case 'codespan':
      return `[code]${token.text}[/code]`;
    case 'hr':
      return '_________________';
    case 'space':
      return '';
    case 'strong':
      return `[b]${renderInline(token.tokens)}[/b]`;
    case 'em':
      return `[i]${renderInline(token.tokens)}[/i]`;
    case 'del':
      return `[strike]${renderInline(token.tokens)}[/strike]`;
    case 'link':
      return `[url=${token.href}]${renderInline(token.tokens)}[/url]`;
    case 'image':
      return `[img]${token.href}[/img]`;
    case 'br':
      return '\n';
    case 'escape':
      return token.text;
    case 'text':
      return token.tokens ? renderInline(token.tokens) : token.text;
    default:
      // Tipos não usados nos arquivos-fonte de hoje (description.md/change-notes.md — ex.: table,
      // html, def): devolve o texto cru em vez de quebrar a conversão.
      return 'raw' in token ? token.raw : '';
  }
}

/** Converte um documento Markdown inteiro pro dialeto BBCode da Steam. */
export function markdownParaBBCode(markdown: string): string {
  const tokens = lexer(markdown.trim());
  return renderBlock(tokens).trim();
}
