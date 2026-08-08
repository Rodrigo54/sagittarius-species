/** Ponto de entrada público de `scripts/portrait-schema/` — pipelines que
 * precisam do schema/tipos de `portrait.json` importam daqui, não direto de
 * `schema.ts`/`vocabulario.ts`. Usado por `generate-portraits` e
 * `generate-art` (os dois pipelines que leem/escrevem `portrait.json`). */

export * from './schema';
export * from './vocabulario';
