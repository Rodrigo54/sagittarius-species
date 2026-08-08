import { copyFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import type { GeneroAlvo, PortraitConfig } from '../portrait-schema';

/** Duplicado de `scripts/generate-art/promote.ts` — opera só em
 * `PortraitConfig.counts`/`GeneroAlvo`, agnóstico de qual seção
 * (`geracaoArt` ou `geracaoArtV2`) gerou o staging. Duplicado (não
 * importado) por `generate-art-v2/` continuar autocontida mesmo se
 * `scripts/generate-art/` for apagada no futuro. Se este arquivo for
 * ajustado aqui, considere se o irmão do v1 precisa do mesmo ajuste. */

/** Nome de PNG numerado na convenção do pipeline (`001.png`..`NNN.png`) — o
 * único formato de arquivo que a limpeza de órfãos abaixo tem permissão de
 * apagar. Relevante porque, pra espécie `flat`, `pastaDestino` é a própria
 * pasta da espécie (mesmo nível de `portrait.json`, `.md`, imagens de
 * referência) — sem esse filtro, a limpeza apagaria arquivos que não são
 * PNG numerado nenhum. */
const PADRAO_PNG_NUMERADO = /^\d{3}\.png$/;

/** Copia (não move) o staging inteiro pra `assets/`, só se os N arquivos
 * esperados (`counts.<genero>`) estiverem todos presentes — fail-fast, nada
 * é copiado se faltar um. Sobrescreve o que já existir em `assets/` (é assim
 * que uma espécie existente é reworkeada com arte nova). Depois de copiar,
 * apaga qualquer `NNN.png` órfão que já estivesse em `assets/` além do
 * `counts.<genero>` atual (ex.: reduzir `counts.male` de 26 pra 15 deixa
 * `016.png`..`026.png` órfãos) — mesma política de limpeza total do
 * `bun run portrait` pros `.dds` de `mod/`, aplicada aqui pro PNG fonte, já
 * que sem isso o próximo `bun run portrait` travaria com erro de contagem
 * (PNGs encontrados ≠ `counts` declarado). */
export async function promoverEspecie(
  config: PortraitConfig,
  slug: string,
  genero: GeneroAlvo,
  pastaStagingGenero: string,
  pastaAssetsEspecie: string
): Promise<{ promovidos: number; removidos: number }> {
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

  const chavesEsperadasSet = new Set(chavesEsperadas.map((chave) => `${chave}.png`));
  let arquivosDestino: string[];
  try {
    arquivosDestino = await readdir(pastaDestino);
  } catch {
    arquivosDestino = [];
  }
  const orfaos = arquivosDestino.filter(
    (arquivo) => PADRAO_PNG_NUMERADO.test(arquivo) && !chavesEsperadasSet.has(arquivo)
  );
  for (const orfao of orfaos) {
    await unlink(join(pastaDestino, orfao));
  }

  return { promovidos: chavesEsperadas.length, removidos: orfaos.length };
}
