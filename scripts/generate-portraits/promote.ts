import { join, relative, sep } from 'node:path';
import type { SpeciesInfo } from '../shared/species';
import { limparOrfaos, limparOrfaosGlobais } from './sync';
import { copyFile, mkdir, open, stat } from 'node:fs/promises';
import { dirname, extname } from 'node:path';

export interface ArquivoPreparado { origem: string; destino: string }

/** Roda `tarefa` sobre `itens` com no máximo `limite` execuções concorrentes —
 * uma promoção completa mexe em centenas de arquivos (DDS + txt); paralelo o
 * bastante pra não serializar syscall por syscall, sem abrir mais handles de
 * uma vez do que o SO aguenta. */
async function comConcorrencia<T>(itens: T[], limite: number, tarefa: (item: T) => Promise<void>) {
  let indice = 0;
  async function worker() {
    while (indice < itens.length) await tarefa(itens[indice++]!);
  }
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, worker));
}

const CONCORRENCIA = 32;

/** Confere o lote inteiro antes da primeira cópia; a cópia final não é uma transação. */
export async function promoverArquivos(arquivos: ArquivoPreparado[]) {
  await comConcorrencia(arquivos, CONCORRENCIA, async (arquivo) => {
    const info = await stat(arquivo.origem);
    if (!info.isFile() || info.size === 0) throw new Error('Saída ausente ou vazia: ' + arquivo.origem);
    if (extname(arquivo.origem) === '.dds') {
      const handle = await open(arquivo.origem, 'r');
      try {
        const header = Buffer.alloc(4);
        await handle.read(header, 0, 4, 0);
        if (info.size < 128 || header.toString('ascii') !== 'DDS ') throw new Error('DDS inválido: ' + arquivo.origem);
      } finally { await handle.close(); }
    }
  });
  await comConcorrencia(arquivos, CONCORRENCIA, async (arquivo) => {
    await mkdir(dirname(arquivo.destino), { recursive: true });
    await copyFile(arquivo.origem, arquivo.destino);
  });
}

/** Sob filtro, nenhum arquivo do lote pode pertencer a outra espécie — checa
 * tanto a lista de espécies quanto o destino de cada arquivo dentro de
 * `pastaModelos`/`pastaTxt` (arquivos fora das duas, como o registro global
 * de taxonomia em `common/`, são exceção deliberada: sempre promovidos,
 * mesmo sob filtro). */
function validarFiltro(arquivos: ArquivoPreparado[], especies: SpeciesInfo[], pastaModelos: string, pastaTxt: string, filtro: string) {
  if (especies.some(info => info.slug !== filtro)) throw new Error('Lote contém espécie fora do filtro: ' + filtro);
  for (const raiz of [pastaModelos, pastaTxt]) {
    for (const arquivo of arquivos) {
      if (!arquivo.destino.startsWith(raiz + sep)) continue;
      const primeiroSegmento = relative(raiz, arquivo.destino).split(sep)[0];
      if (primeiroSegmento !== filtro && !primeiroSegmento?.startsWith(filtro + '_')) {
        throw new Error(`Lote contém arquivo fora do filtro "${filtro}": ${arquivo.destino}`);
      }
    }
  }
}

export async function promoverLote(arquivos: ArquivoPreparado[], especies: SpeciesInfo[], pastaModelos: string, pastaTxt: string, filtro?: string) {
  if (filtro !== undefined) validarFiltro(arquivos, especies, pastaModelos, pastaTxt, filtro);
  await promoverArquivos(arquivos);
  for (const info of especies) await limparOrfaos(info, join(pastaModelos, info.slug));
  if (filtro === undefined) await limparOrfaosGlobais(especies, pastaModelos, pastaTxt);
}
