/** Configuração do `workshopitem` do VDF que o `steamcmd +workshop_build_item` consome.
 * `title`/`description` são sempre enviados (todo publish mantém a descrição da Steam em sincronia
 * com `description.md`); `changenote` é opcional — presente na publicação de conteúdo, ausente no
 * modo `--metadata-only` (só título/descrição, sem build nova). Ver `docs/pipeline-publish-workshop.md`. */
export type ConteudoVdfPublicacao = {
  appid: string;
  publishedFileId: string;
  contentFolder: string;
  previewFile: string;
  title: string;
  description: string;
  changenote?: string;
};

/** Escapa um valor pro formato VDF (KeyValues): barra invertida e aspas duplas são os únicos
 * caracteres especiais dentro de uma string entre aspas. Quebras de linha literais são aceitas
 * sem escape (changenote/description costumam ser multi-linha). */
function escaparValorVdf(valor: string): string {
  return valor.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function par(chave: string, valor: string): string {
  return `\t"${chave}"\t\t"${escaparValorVdf(valor)}"`;
}

export function montarVdf(config: ConteudoVdfPublicacao): string {
  const linhas = [
    par('appid', config.appid),
    par('publishedfileid', config.publishedFileId),
    par('contentfolder', config.contentFolder),
    par('previewfile', config.previewFile),
    par('title', config.title),
    par('description', config.description),
  ];

  if (config.changenote !== undefined) {
    linhas.push(par('changenote', config.changenote));
  }

  return ['"workshopitem"', '{', ...linhas, '}'].join('\n') + '\n';
}
