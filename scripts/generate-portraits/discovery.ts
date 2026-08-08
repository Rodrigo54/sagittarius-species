import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { zPortraitConfig } from '../portrait-schema';
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

/** Lê e valida `portrait.json` contra o schema `zod` de `portrait-schema/` —
 * único ponto de carga usado por `generate-portraits` e `generate-art`, então
 * validar aqui cobre os dois pipelines de uma vez (nenhum dos dois faz
 * `JSON.parse` de `portrait.json` por conta própria). Substitui
 * `validarGeracaoArt`/`validarEspecie`'s antiga checagem de forma/enum —
 * essas duas funções continuam existindo só pro que zod não valida
 * (arquivos no disco: contagem de PNGs, geometria, canal alfa). */
export async function lerConfig(pastaEspecie: string): Promise<PortraitConfig> {
  const conteudo = await readFile(join(pastaEspecie, 'portrait.json'), 'utf-8');
  const resultado = zPortraitConfig.safeParse(JSON.parse(conteudo));
  if (!resultado.success) {
    const slug = basename(pastaEspecie);
    const erros = resultado.error.issues
      .map((issue) => `${slug}: portrait.json — ${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
      .join('\n');
    throw new Error(erros);
  }
  return resultado.data;
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
