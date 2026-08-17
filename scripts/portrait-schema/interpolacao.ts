/** Motor de interpolação dos textos de prompt — agnóstico de prompt, de
 * espécie e de ComfyUI: recebe um template, um objeto de campos já mesclado
 * (`base` → gênero → variante) e a tabela de vocabulário, e devolve texto.
 * Quem decide QUAIS templates existem e em que ordem eles entram no prompt é
 * `prompt-builder.ts`; quem decide o TEXTO é `base.json`.
 *
 * Sintaxe:
 * - `<secao.campo>` — placeholder. **Fora de colchetes é obrigatório**: não
 *   resolver é erro (`ErroCampoObrigatorio`), com o rótulo da variante junto,
 *   pra falhar antes de enfileirar um lote inteiro com o campo faltando.
 * - `[trecho]` — segmento opcional, **aninhável**. Só é emitido se todos os
 *   placeholders diretos dele resolverem; senão o segmento inteiro some,
 *   preposição e tudo (`"[ with <hair.secondary_color> highlights]"` não
 *   deixa "with  highlights" pra trás). Um opcional aninhado se resolve
 *   sozinho, sem derrubar o pai.
 *
 * Não existe sintaxe de escape: nenhum texto do pipeline usa `<` ou `[`
 * literalmente. Se um dia precisar, adicionar é aditivo — hoje `<`/`[` soltos
 * são erro de sintaxe, não texto.
 *
 * Resolução de um placeholder, em duas camadas:
 * 1. Se o caminho tem entrada de vocabulário para aquele valor, sai o texto
 *    `positive` da entrada (`<person.gender>` com `"Male"` → `"man"`;
 *    `<person.ethnicity>` com `"African"` → a frase inteira já com peso).
 * 2. Senão, sai o valor cru em minúsculas (`<hair.primary_color>` com
 *    `"Salmon"` → `"salmon"`; números viram texto: `<person.age>` → `"21"`).
 *
 * A interpolação sempre usa o lado `positive` do vocabulário — o lado
 * `negative` não é composto por templates, é emitido como fragmento inteiro
 * pelo `prompt-builder`. */

export interface EntradaVocabulario {
  positive: string;
  negative?: string;
}

/** Tabela de vocabulário indexada por caminho (`"person.gender"`) e, dentro
 * dele, por valor do enum (`"Male"`). Vem de `base.json`. */
export type VocabularioTextos = Record<string, Record<string, EntradaVocabulario>>;

/** Campos compostos já mesclados. Tipado estruturalmente (seção → campo →
 * valor) em vez de `CamposCompostos` do schema: o motor não precisa saber
 * quais seções existem, e assim uma seção nova no schema não exige tocar
 * aqui. */
export type CamposParaInterpolacao = Record<string, Record<string, unknown> | undefined>;

/** Sintaxe malformada no próprio template — colchete/ângulo sem par, caminho
 * fora do formato `secao.campo`. É erro de quem escreveu o `base.json` ou o
 * `portrait.json`, não de uma variante específica. */
export class ErroTemplate extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'ErroTemplate';
  }
}

/** Placeholder fora de colchetes cujo campo não existe no objeto mesclado —
 * o template declarou aquele campo como obrigatório e a variante não o
 * declarou. Carrega `caminho` e `rotulo` separados pra quem captura poder
 * reagrupar por variante em vez de só repassar a mensagem. */
export class ErroCampoObrigatorio extends Error {
  constructor(
    readonly caminho: string,
    readonly rotulo: string,
    readonly template: string
  ) {
    super(
      `${rotulo}: o template exige "${caminho}", que não está declarado em nenhum nível (base/gênero/variante). ` +
        `Declare o campo, ou marque o trecho como opcional com colchetes no template: ${template}`
    );
    this.name = 'ErroCampoObrigatorio';
  }
}

type NoTemplate =
  | { tipo: 'literal'; texto: string }
  | { tipo: 'campo'; caminho: string }
  | { tipo: 'opcional'; filhos: NoTemplate[] };

/** Formato de caminho aceito: `secao.campo`, ambos em snake_case minúsculo
 * (mesma convenção das chaves do schema). Um caminho que passa por aqui ainda
 * pode não existir no schema — isso é checado contra o shape do zod em
 * `portrait-schema`, não aqui (o motor não conhece o schema). */
const FORMATO_CAMINHO = /^[a-z][a-z_]*\.[a-z][a-z_0-9]*$/;

export function analisarTemplate(template: string): NoTemplate[] {
  let posicao = 0;

  function analisarSequencia(dentroDeOpcional: boolean): NoTemplate[] {
    const nos: NoTemplate[] = [];
    let literal = '';

    function despejarLiteral(): void {
      if (literal.length > 0) {
        nos.push({ tipo: 'literal', texto: literal });
        literal = '';
      }
    }

    while (posicao < template.length) {
      const caractere = template[posicao]!;

      if (caractere === '[') {
        posicao++;
        despejarLiteral();
        nos.push({ tipo: 'opcional', filhos: analisarSequencia(true) });
        continue;
      }

      if (caractere === ']') {
        if (!dentroDeOpcional) {
          throw new ErroTemplate(`"]" sem "[" correspondente (posição ${posicao}) no template: ${template}`);
        }
        posicao++;
        despejarLiteral();
        return nos;
      }

      if (caractere === '<') {
        const fim = template.indexOf('>', posicao);
        if (fim === -1) {
          throw new ErroTemplate(`"<" sem ">" correspondente (posição ${posicao}) no template: ${template}`);
        }
        const caminho = template.slice(posicao + 1, fim).trim();
        if (!FORMATO_CAMINHO.test(caminho)) {
          throw new ErroTemplate(
            `"<${caminho}>" não está no formato "secao.campo" (minúsculas, snake_case) no template: ${template}`
          );
        }
        despejarLiteral();
        nos.push({ tipo: 'campo', caminho });
        posicao = fim + 1;
        continue;
      }

      if (caractere === '>') {
        throw new ErroTemplate(`">" sem "<" correspondente (posição ${posicao}) no template: ${template}`);
      }

      literal += caractere;
      posicao++;
    }

    if (dentroDeOpcional) {
      throw new ErroTemplate(`"[" sem "]" correspondente no template: ${template}`);
    }
    despejarLiteral();
    return nos;
  }

  return analisarSequencia(false);
}

/** Todos os caminhos citados por um template, inclusive dentro de segmentos
 * opcionais — é a leitura ESTÁTICA (o que o template referencia), não a
 * dinâmica (o que resolveu numa variante). É o que a validação de cobertura
 * usa pra decidir se um campo declarado chega ou não ao prompt. */
export function caminhosDoTemplate(template: string): string[] {
  const caminhos: string[] = [];

  function percorrer(nos: NoTemplate[]): void {
    for (const no of nos) {
      if (no.tipo === 'campo') caminhos.push(no.caminho);
      else if (no.tipo === 'opcional') percorrer(no.filhos);
    }
  }

  percorrer(analisarTemplate(template));
  return caminhos;
}

function resolverCampo(
  campos: CamposParaInterpolacao,
  vocabulario: VocabularioTextos,
  caminho: string
): string | undefined {
  const [secao, campo] = caminho.split('.') as [string, string];
  const valor = campos[secao]?.[campo];
  if (valor === undefined || valor === null || valor === '') return undefined;

  const entrada = vocabulario[caminho]?.[String(valor)];
  if (entrada) return entrada.positive;

  return String(valor).toLowerCase();
}

interface Contexto {
  campos: CamposParaInterpolacao;
  vocabulario: VocabularioTextos;
  rotulo: string;
  template: string;
}

/** `resolvido` é falso quando algum placeholder DIRETO desta sequência não
 * resolveu — o que faz o segmento opcional que a contém ser descartado
 * inteiro. Placeholders dentro de opcionais aninhados não afetam este
 * resultado: eles já foram descartados no nível deles. */
function renderizar(nos: NoTemplate[], ctx: Contexto, raiz: boolean): { texto: string; resolvido: boolean } {
  let texto = '';
  let resolvido = true;

  for (const no of nos) {
    if (no.tipo === 'literal') {
      texto += no.texto;
      continue;
    }

    if (no.tipo === 'campo') {
      const valor = resolverCampo(ctx.campos, ctx.vocabulario, no.caminho);
      if (valor === undefined) {
        // Na raiz o placeholder é obrigatório por construção — só um segmento
        // opcional pode absorver a ausência de um campo.
        if (raiz) throw new ErroCampoObrigatorio(no.caminho, ctx.rotulo, ctx.template);
        resolvido = false;
        continue;
      }
      texto += valor;
      continue;
    }

    const filho = renderizar(no.filhos, ctx, false);
    if (filho.resolvido) texto += filho.texto;
  }

  return { texto, resolvido };
}

/** Espaço e vírgula sobrando nas BORDAS do texto renderizado. Um segmento
 * opcional carrega a pontuação que o liga ao vizinho (`"[<person.gender>, ]"`),
 * então quando ele é o último a sobrar a vírgula fica pendurada na ponta.
 * Limpar as bordas é determinístico; limpeza no MEIO do texto não existe de
 * propósito — é para isso que o segmento opcional carrega sua própria
 * pontuação. */
const BORDAS_DE_PONTUACAO = /^[\s,]+|[\s,]+$/g;

/** Renderiza um template. Devolve `undefined` quando o resultado é vazio (só
 * segmentos opcionais, todos descartados) — o fragmento simplesmente não
 * entra no prompt, sem deixar vírgula sobrando.
 *
 * `rotulo` identifica a origem em mensagens de erro; use algo que aponte a
 * variante exata (`"mermaids/male/017 (torso.template)"`). */
export function interpolar(
  template: string,
  campos: CamposParaInterpolacao,
  vocabulario: VocabularioTextos,
  rotulo: string
): string | undefined {
  const nos = analisarTemplate(template);
  const { texto } = renderizar(nos, { campos, vocabulario, rotulo, template }, true);
  const limpo = texto.replace(BORDAS_DE_PONTUACAO, '');
  return limpo.length > 0 ? limpo : undefined;
}
