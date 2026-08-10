/** Configuração do `workshopitem` do VDF que o `steamcmd +workshop_build_item` consome. Dois
 * modos possíveis: publicar conteúdo novo (com changenote) ou só metadados (título/descrição,
 * sem changenote) — nunca os dois juntos, ver `docs/pipeline-publish-workshop.md`. */
export type ConteudoVdfPublicacao =
  | {
      modo: 'conteudo';
      appid: string;
      publishedFileId: string;
      contentFolder: string;
      previewFile: string;
      changenote: string;
    }
  | {
      modo: 'metadata';
      appid: string;
      publishedFileId: string;
      contentFolder: string;
      previewFile: string;
      title: string;
      description: string;
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
  ];

  if (config.modo === 'conteudo') {
    linhas.push(par('changenote', config.changenote));
  } else {
    linhas.push(par('title', config.title));
    linhas.push(par('description', config.description));
  }

  return ['"workshopitem"', '{', ...linhas, '}'].join('\n') + '\n';
}
