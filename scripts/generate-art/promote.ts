import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { PortraitConfig } from '../generate-portraits/types';
import type { GeneroAlvo } from './validation';

/** Copia (não move) o staging inteiro pra `assets/`, só se os N arquivos
 * esperados (`counts.<genero>`) estiverem todos presentes — fail-fast, nada
 * é copiado se faltar um. Sobrescreve o que já existir em `assets/` (é assim
 * que uma espécie existente é reworkeada com arte nova). */
export async function promoverEspecie(
  config: PortraitConfig,
  slug: string,
  genero: GeneroAlvo,
  pastaStagingGenero: string,
  pastaAssetsEspecie: string
): Promise<{ promovidos: number }> {
  const esperado = config.counts[genero] ?? -1;
  const chavesEsperadas = Array.from({ length: Math.max(esperado, 0) }, (_, i) => String(i + 1).padStart(3, '0'));

  let arquivosStaging: string[];
  try {
    arquivosStaging = (await readdir(pastaStagingGenero)).filter((f) => f.endsWith('.png'));
  } catch {
    arquivosStaging = [];
  }

  const faltando = chavesEsperadas.filter((chave) => !arquivosStaging.includes(`${chave}.png`));
  if (esperado <= 0 || faltando.length > 0) {
    throw new Error(
      `${slug}/${genero}: staging incompleto em "${pastaStagingGenero}" — faltam ${faltando.length} de ${esperado} imagem(ns)${faltando.length > 0 ? ` (${faltando.join(', ')})` : ''}. Nada foi promovido.`
    );
  }

  const pastaDestino = genero === 'flat' ? pastaAssetsEspecie : join(pastaAssetsEspecie, genero);
  await mkdir(pastaDestino, { recursive: true });

  for (const chave of chavesEsperadas) {
    await copyFile(join(pastaStagingGenero, `${chave}.png`), join(pastaDestino, `${chave}.png`));
  }

  return { promovidos: chavesEsperadas.length };
}
