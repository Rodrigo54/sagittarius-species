/** Ponto de entrada público de `scripts/promo-schema/` — quem precisa do
 * schema/tipos de `assets/promo/species-promo.json` importa daqui, não direto
 * de `schema.ts`. Usado por `generate-promo`, o único pipeline que lê esse
 * arquivo. */

export * from './schema';
