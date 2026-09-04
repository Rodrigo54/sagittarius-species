import { readFile } from 'node:fs/promises';
import { carregarEspecie } from '../generate-portraits/discovery';
import type { SpeciesInfo } from '../generate-portraits/types';
import { carregarRooms } from '../generate-rooms/discovery';
import type { RoomsInfo } from '../generate-rooms/types';
import { zSpeciesPromoFile, type SpeciesPromoFile } from '../promo-schema';
import { CAMINHO_CONFIG, PASTA_CITY_SETS_ASSETS, PASTA_PORTRAITS_ASSETS } from './types';

/** Lê e valida `assets/promo/species-promo.json` contra o schema `zod` de
 * `promo-schema/` — único ponto de carga do arquivo. */
export async function carregarConfig(): Promise<SpeciesPromoFile> {
  const conteudo = await readFile(CAMINHO_CONFIG, 'utf-8');
  const resultado = zSpeciesPromoFile.safeParse(JSON.parse(conteudo));
  if (!resultado.success) {
    const erros = resultado.error.issues
      .map((issue) => `species-promo.json — ${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
      .join('\n');
    throw new Error(erros);
  }
  return resultado.data;
}

/** Reaproveita o carregador de `generate-portraits` — mesma noção de "quais
 * PNGs existem por gênero em assets/portraits/<slug>/", que já é o único
 * ponto de leitura desses arquivos para dois outros pipelines
 * (`generate-portraits`, `generate-art`). */
export async function carregarVariantesDisponiveis(slug: string): Promise<SpeciesInfo> {
  return carregarEspecie(PASTA_PORTRAITS_ASSETS, slug);
}

/** Idem para `generate-rooms` — mesma listagem de `assets/city_sets/`. */
export async function carregarRoomsDisponiveis(): Promise<RoomsInfo> {
  return carregarRooms(PASTA_CITY_SETS_ASSETS);
}
