/** Ponto de entrada público de `scripts/name-list-schema/` — quem precisa do
 * schema/tipos de `assets/name_lists/<cultura>.json` importa daqui, não direto
 * de `schema.ts`. Usado por `generate-names`, o único pipeline que lê esses
 * arquivos. */

export * from './schema';
