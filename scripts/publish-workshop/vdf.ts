/** Configuração do `workshopitem` do VDF que o `steamcmd +workshop_build_item` consome.
 * `title`/`description` são sempre enviados (todo publish mantém a descrição da Steam em sincronia
 * com `description.md`); `changenote` é opcional — presente na publicação de conteúdo, ausente no
 * modo `--metadata-only` (só título/descrição, sem build nova). Ver `docs/pipeline-publish-workshop.md`. */
type Metadados = {
  appid: string;
  publishedFileId: string;
  previewFile: string;
  title: string;
  description: string;
};
export type ConteudoVdfPublicacao = Metadados & (
  | { modo: 'metadata'; contentFolder?: never; changenote?: never }
  | { modo: 'conteudo'; contentFolder: string; changenote: string }
);

/** O KeyValues do steamcmd lê este VDF sem sequências de escape: dentro de um valor entre aspas,
 * `\"` não escapa nada e a aspa encerra o valor ali, jogando o resto do texto na posição de chave
 * (o parse falha com `key name too long` / `got } in key`). Como não há como representar uma aspa
 * dupla, ela vira aspa tipográfica, alternando abertura e fechamento. Barra invertida e quebra de
 * linha são literais e passam intactas — inclusive nos caminhos Windows de `contentfolder`. */
function sanitizarValorVdf(valor: string): string {
  let proximaEhAbertura = true;
  return valor.replace(/"/g, () => {
    const aspa = proximaEhAbertura ? '“' : '”';
    proximaEhAbertura = !proximaEhAbertura;
    return aspa;
  });
}

function par(chave: string, valor: string): string {
  return `\t"${chave}"\t\t"${sanitizarValorVdf(valor)}"`;
}

export function montarVdf(config: ConteudoVdfPublicacao): string {
  const linhas = [
    par('appid', config.appid),
    par('publishedfileid', config.publishedFileId),
    par('previewfile', config.previewFile),
    par('title', config.title),
    par('description', config.description),
  ];

  if (config.modo === 'conteudo') {
    linhas.push(par('contentfolder', config.contentFolder));
    linhas.push(par('changenote', config.changenote));
  }

  return ['"workshopitem"', '{', ...linhas, '}'].join('\n') + '\n';
}
