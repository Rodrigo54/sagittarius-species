import { writeFile } from 'node:fs/promises';

const REGEX_HEADING_VERSAO = /^##\s+(.+)$/m;
const REGEX_PROXIMO_HEADING = /^##\s+/m;
const REGEX_TIMESTAMP_NO_FINAL = /\s+—\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/;

export type SecaoChangelog = {
  /** Texto completo da linha de heading como está hoje no arquivo, ex.: "## 1.9.0" ou
   * "## 1.9.0 — 2026-08-10 15:30" */
  linhaHeading: string;
  /** Só a versão, sem timestamp, ex.: "1.9.0" */
  versao: string;
  /** true se a linha já tem "— YYYY-MM-DD HH:mm" no final */
  jaTemTimestamp: boolean;
  /** Offset (em caracteres) de onde a linha de heading começa no conteúdo original */
  offsetLinhaHeading: number;
  /** Comprimento da linha de heading (sem o \n final) */
  comprimentoLinhaHeading: number;
  /** Corpo da seção — tudo entre a linha de heading e o próximo "## " (ou fim do arquivo), sem
   * espaço em branco nas pontas */
  corpo: string;
};

/** Localiza e devolve a seção `## <versão>` mais no topo do arquivo — é sempre a versão mais
 * recente, por convenção (novas entradas entram sempre no topo, ver `change-notes.md`). */
export function extrairPrimeiraSecao(conteudo: string): SecaoChangelog {
  const match = REGEX_HEADING_VERSAO.exec(conteudo);
  if (!match) {
    throw new Error(
      'Não encontrei nenhuma seção "## <versão>" em change-notes.md. Adicione uma seção nova no topo do arquivo (abaixo do parágrafo introdutório) antes de publicar.'
    );
  }

  const linhaHeading = match[0];
  const textoHeading = match[1]!.trim();
  const jaTemTimestamp = REGEX_TIMESTAMP_NO_FINAL.test(textoHeading);
  const versao = jaTemTimestamp
    ? textoHeading.replace(REGEX_TIMESTAMP_NO_FINAL, '').trim()
    : textoHeading;

  const offsetLinhaHeading = match.index;
  const inicioCorpo = offsetLinhaHeading + linhaHeading.length;
  const restante = conteudo.slice(inicioCorpo);
  const proximoHeading = REGEX_PROXIMO_HEADING.exec(restante);
  const corpo = (proximoHeading ? restante.slice(0, proximoHeading.index) : restante).trim();

  if (!corpo) {
    throw new Error(
      `A seção "${linhaHeading.trim()}" de change-notes.md está vazia — escreva o que mudou nessa versão antes de publicar.`
    );
  }

  return {
    linhaHeading,
    versao,
    jaTemTimestamp,
    offsetLinhaHeading,
    comprimentoLinhaHeading: linhaHeading.length,
    corpo,
  };
}

function formatarTimestampLocal(data: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())} ${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

/** Devolve a linha de heading que deve ficar gravada no arquivo: se a seção já tinha timestamp,
 * devolve a linha inalterada; senão, devolve com "— YYYY-MM-DD HH:mm" (hora local) anexado. */
export function comTimestamp(secao: SecaoChangelog, agora: Date): string {
  if (secao.jaTemTimestamp) return secao.linhaHeading;
  return `## ${secao.versao} — ${formatarTimestampLocal(agora)}`;
}

/** Reescreve só a linha de heading da primeira seção em change-notes.md, sem mexer no resto do
 * arquivo. Não faz nada se a seção já tinha timestamp (a linha não muda). Chamar só depois da
 * confirmação do publish — nunca antes, pra não gravar um timestamp de uma publicação cancelada. */
export async function gravarTimestamp(
  caminhoArquivo: string,
  conteudoOriginal: string,
  secao: SecaoChangelog,
  novaLinhaHeading: string
): Promise<void> {
  if (secao.jaTemTimestamp) return;

  const antes = conteudoOriginal.slice(0, secao.offsetLinhaHeading);
  const depois = conteudoOriginal.slice(secao.offsetLinhaHeading + secao.comprimentoLinhaHeading);
  await writeFile(caminhoArquivo, antes + novaLinhaHeading + depois, 'utf-8');
}
