/** Insere `"slugNovo"` logo abaixo de cada ocorrência de `"slugOriginal"` nas
 * listas `portraits` dos arquivos de registro (species_classes /
 * portrait_sets), preservando a indentação da linha original. Idempotente: se
 * o arquivo já menciona o slug novo, nada muda. */
export function inserirAposOcorrencias(
  conteudo: string,
  slugOriginal: string,
  slugNovo: string
): { conteudo: string; ocorrencias: number } {
  if (conteudo.includes(`"${slugNovo}"`)) {
    return { conteudo, ocorrencias: 0 };
  }

  const linhas = conteudo.split('\n');
  const resultado: string[] = [];
  let ocorrencias = 0;

  for (const linha of linhas) {
    resultado.push(linha);
    const match = linha.match(/^([\t ]*)"(.+)"[\t ]*\r?$/);
    if (match && match[2] === slugOriginal) {
      resultado.push(`${match[1]}"${slugNovo}"`);
      ocorrencias++;
    }
  }

  return { conteudo: resultado.join('\n'), ocorrencias };
}
