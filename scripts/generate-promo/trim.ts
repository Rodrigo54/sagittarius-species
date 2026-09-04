/** Medição (nunca escrita) do recorte de cada personagem, usada pelo template
 * HTML/CSS pra reproduzir via `object-position`/crop o mesmo "trim +
 * resize!" que o pipeline principal de portraits faz fisicamente no
 * ImageMagick — aqui a composição final é o browser, então o corte também
 * precisa ser CSS: reescrever um PNG só pra depois o Playwright compor de
 * novo seria um passo intermediário sem propósito. */

import { $ } from 'bun';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __DIRNAME = dirname(fileURLToPath(import.meta.url));
const MAGICK = join(__DIRNAME, '../../bin/imagemagick/magick.exe');

export interface MedidaRecorte {
  arquivo: string;
  /** Dimensão total do PNG original — o crop em si é feito via CSS a partir
   * daqui, o arquivo nunca é reescrito nem recortado fisicamente. */
  larguraOriginal: number;
  alturaOriginal: number;
  /** Bounding box do conteúdo (sem a transparência em volta). */
  trimLargura: number;
  trimAltura: number;
  /** Canto superior-esquerdo da bounding box dentro do arquivo original. */
  offsetX: number;
  offsetY: number;
}

/** Mede dimensão total + bounding box de conteúdo (`%@` = trim box) de cada
 * PNG numa única invocação do ImageMagick. */
export async function medirRecortes(arquivos: string[]): Promise<MedidaRecorte[]> {
  if (arquivos.length === 0) return [];

  const saida = await $`${MAGICK} identify -format ${'%wx%h %@\n'} ${arquivos}`.text();
  const linhas = saida.trim().split('\n');
  if (linhas.length !== arquivos.length) {
    throw new Error(
      `identify retornou ${linhas.length} medida(s) para ${arquivos.length} arquivo(s)`
    );
  }

  return linhas.map((linha, i) => {
    const match = linha.trim().match(/^(\d+)x(\d+) (\d+)x(\d+)([+-]\d+)([+-]\d+)$/);
    if (!match) {
      throw new Error(`medida ilegível para "${arquivos[i]}": "${linha}"`);
    }
    return {
      arquivo: arquivos[i],
      larguraOriginal: Number(match[1]),
      alturaOriginal: Number(match[2]),
      trimLargura: Number(match[3]),
      trimAltura: Number(match[4]),
      offsetX: Number(match[5]),
      offsetY: Number(match[6]),
    };
  });
}
