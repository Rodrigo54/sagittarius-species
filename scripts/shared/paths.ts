import { join } from 'node:path';

export const PASTA_RAIZ = join(import.meta.dir, '../..');
export const PASTA_ASSETS = join(PASTA_RAIZ, 'assets');
export const PASTA_MOD = join(PASTA_RAIZ, 'mod/sagittarius-species');
export const MAGICK = join(PASTA_RAIZ, 'bin/imagemagick/magick.exe');
export function caminhoStellaris(override?: string): string {
  const caminho = override ?? process.env.STELLARIS_PATH;
  if (!caminho?.trim()) throw new Error('Defina STELLARIS_PATH no .env com a pasta da instalação do Stellaris.');
  return caminho;
}
