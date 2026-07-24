import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { PortraitConfig, SpeciesInfo } from './types';

const ordenarNumericamente = (arquivos: string[]) =>
  [...arquivos].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

async function listarPngs(pasta: string): Promise<string[]> {
  if (!existsSync(pasta)) return [];
  const itens = await readdir(pasta);
  return ordenarNumericamente(itens.filter((item) => item.endsWith('.png'))).map(
    (item) => join(pasta, item)
  );
}

export async function listarPastasEspecies(pastaPortraits: string): Promise<string[]> {
  const itens = await readdir(pastaPortraits, { withFileTypes: true });
  return itens
    .filter((item) => item.isDirectory() && item.name.startsWith('ssm_'))
    .map((item) => item.name)
    .sort();
}

export async function lerConfig(pastaEspecie: string): Promise<PortraitConfig> {
  const conteudo = await readFile(join(pastaEspecie, 'portrait.json'), 'utf-8');
  return JSON.parse(conteudo);
}

export async function carregarEspecie(
  pastaPortraits: string,
  slug: string
): Promise<SpeciesInfo> {
  const pastaAssets = join(pastaPortraits, slug);
  const config = await lerConfig(pastaAssets);

  const arquivosMale = config.gendered
    ? await listarPngs(join(pastaAssets, 'male'))
    : [];
  const arquivosFemale = config.gendered
    ? await listarPngs(join(pastaAssets, 'female'))
    : [];
  const arquivosFlat = config.gendered ? [] : await listarPngs(pastaAssets);

  return { slug, pastaAssets, config, arquivosMale, arquivosFemale, arquivosFlat };
}
