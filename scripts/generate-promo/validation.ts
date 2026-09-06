import { stat } from 'node:fs/promises';
import type { SpeciesInfo } from '../shared/species';
import type { RoomsInfo } from '../generate-rooms/types';
import type { EspeciePromo } from '../promo-schema';
import { selecionarFundo, selecionarVariantes, type VariantePodio } from './selecao';
import { medirRecortes } from './trim';
import { FONTE_CORPO, FONTE_TITULO } from './paths';

export interface EspeciePromoResolvida {
  variantes: VariantePodio[];
  fundo: string;
}

/** Resolve as variantes/fundo declarados em species-promo.json e confere que
 * a espécie consegue mesmo compor a imagem: os PNGs apontados existem e são
 * legíveis (`medirRecortes`), e as fontes do template estão no disco. Único
 * ponto dessa verificação — usado tanto por `bun run promo` (antes de abrir o
 * browser) quanto por `bun run validate`, pra não divergirem sobre o que
 * conta como espécie pronta pra gerar. */
export async function validarEspecie(
  info: SpeciesInfo,
  especie: EspeciePromo,
  rooms: RoomsInfo
): Promise<EspeciePromoResolvida> {
  const variantes = selecionarVariantes(info, especie.variantes);
  const fundo = selecionarFundo(info.slug, rooms, especie.fundo);
  await medirRecortes([...variantes.map((v) => v.caminho), fundo]);
  for (const fonte of [FONTE_TITULO, FONTE_CORPO]) {
    const dados = await stat(fonte).catch(() => undefined);
    if (!dados?.isFile()) throw new Error(`Fonte ausente: ${fonte}`);
  }
  return { variantes, fundo };
}
