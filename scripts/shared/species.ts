import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { generosDe, zPortraitConfig, type GeneroAlvo, type PortraitConfig } from '../portrait-schema';
import { ordenarNumericamente } from '../utils';

export interface SpeciesInfo {
  /** Nome da pasta, ex.: "ssm_astral" */
  slug: string;
  /** Caminho completo até assets/portraits/ssm_<especie> */
  pastaAssets: string;
  config: PortraitConfig;
  /** PNGs de origem por gênero, com uma chave por gênero declarado em
   * `config.counts` (`generosDe`) — as mesmas chaves que nomeiam as subpastas
   * em `assets/` e em `mod/`. Quem precisa de todos os arquivos itera os
   * valores; quem precisa de um gênero específico já sabe que ele existe. */
  arquivos: Partial<Record<GeneroAlvo, string[]>>;
}



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
 * `JSON.parse` de `portrait.json` por conta própria). Cobre a forma do
 * arquivo; o que depende do disco (contagem de PNGs, geometria, canal alfa)
 * fica com `validarEspecie`. */
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

  // Uma subpasta por gênero declarado — inclusive `genderless/`, que é uma
  // pasta como qualquer outra. Por isso nada aqui precisa saber o que é ter
  // gênero: a lista de pastas a varrer vem do próprio `counts`.
  const arquivos: Partial<Record<GeneroAlvo, string[]>> = {};
  for (const genero of generosDe(config.counts)) {
    arquivos[genero] = await listarPngs(join(pastaAssets, genero));
  }

  return { slug, pastaAssets, config, arquivos };
}
