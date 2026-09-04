import { join } from 'node:path';
import { PASTA_ASSETS } from '../converter';

/** `assets/promo/` guarda tanto o config (`species-promo.json`) quanto os
 * ativos que o pipeline não deriva de mais ninguém (as fontes vendorizadas) —
 * mesmo raciocínio de `assets/name_lists/*.json`: `assets/` é a fonte de
 * verdade de todo conteúdo do pipeline, não só das texturas DDS. */
export const PASTA_PROMO_ASSETS = join(PASTA_ASSETS, 'promo');
export const CAMINHO_CONFIG = join(PASTA_PROMO_ASSETS, 'species-promo.json');

export const PASTA_PORTRAITS_ASSETS = join(PASTA_ASSETS, 'portraits');
export const PASTA_CITY_SETS_ASSETS = join(PASTA_ASSETS, 'city_sets');

/** Orbitron Bold — nome da espécie, no topo do painel de texto. */
export const FONTE_TITULO = join(PASTA_PROMO_ASSETS, 'Orbitron-Bold.ttf');
/** Exo 2 Regular — parágrafo de lore, abaixo do título. Fonte legível
 * escolhida por combinar com o tom sci-fi do título sem competir com ele. */
export const FONTE_CORPO = join(PASTA_PROMO_ASSETS, 'Exo2-Regular.ttf');

/** Onde cada imagem de divulgação é escrita: `assets/promo/ssm_<especie>.png` —
 * decisão explícita (não `steam-workshop/pictures/promo/`): a saída também é
 * fonte/ativo do repositório, o upload pra galeria da Steam continua manual. */
export function caminhoSaida(slug: string): string {
  return join(PASTA_PROMO_ASSETS, `${slug}.png`);
}
