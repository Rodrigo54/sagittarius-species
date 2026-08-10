/** Hash puro, sem dependência nenhuma, agnóstico de motor de geração.
 *
 * Seed determinística (FNV-1a 32-bit) derivada de espécie+gênero+variante —
 * rodar a mesma variante duas vezes produz a mesma imagem, sem guardar
 * estado em lugar nenhum. É o piso padrão, usado quando nem `--seed` da CLI
 * nem `variantes.NNN.seed` do `portrait.json` estão presentes (ver
 * `resolverSeed` abaixo). */
export function seedDeterministica(slug: string, genero: string, variante: string): number {
  const texto = `${slug}:${genero}:${variante}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** De onde a seed final veio — só pra rotular o log de `index.ts`, sem
 * efeito nenhum na geração em si. */
export type OrigemSeed = 'cli' | 'config' | 'deterministica';

export interface SeedResolvida {
  seed: number;
  origem: OrigemSeed;
}

/** Resolve qual seed usar pra uma variante, entre as três fontes possíveis,
 * na ordem em que a mais explícita vence:
 *
 * 1. `--seed` da CLI — override pontual desta execução, pra testar uma seed
 *    nova sem editar o `portrait.json` (regenerar uma imagem rejeitada na
 *    revisão). Sempre vence, mesmo que a variante já tenha `seed` fixada.
 * 2. `variantes.NNN.seed` do `portrait.json` — override persistido: alguém
 *    já testou uma seed (determinística ou via `--seed`), gostou do
 *    resultado e colou o número aqui manualmente pra fixá-lo pra sempre.
 * 3. `seedDeterministica` — piso padrão, sem intervenção nenhuma.
 *
 * Fixar a seed no `portrait.json` é sempre manual: esta função só decide
 * qual das três vale nesta execução, nunca escreve de volta no arquivo. */
export function resolverSeed(cliSeed: number | undefined, seedConfig: number | undefined, seedDeterministicaValor: number): SeedResolvida {
  if (cliSeed !== undefined) return { seed: cliSeed, origem: 'cli' };
  if (seedConfig !== undefined) return { seed: seedConfig, origem: 'config' };
  return { seed: seedDeterministicaValor, origem: 'deterministica' };
}
