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

/** Teto (exclusivo) do sorteio de `sortearSeed` — a mesma faixa de 32 bits
 * que `seedDeterministica` produz, pra que toda seed do repo, sorteada ou
 * derivada, viva na mesma ordem de grandeza. */
const FAIXA_SEED = 0x100000000;

/** Seed aleatória para `--seed` sem valor. Diferente de `seedDeterministica`,
 * não é reproduzível — é justamente o ponto: o número sorteado só sobrevive
 * porque `index.ts` o grava em `variantes.NNN.seed` depois de gerar. */
export function sortearSeed(): number {
  return Math.floor(Math.random() * FAIXA_SEED);
}

/** De onde a seed final veio — rotula o log de `index.ts` e, no caso de
 * `'aleatoria'`, sinaliza que ela precisa ser gravada no `portrait.json`. */
export type OrigemSeed = 'cli' | 'aleatoria' | 'config' | 'deterministica';

export interface SeedResolvida {
  seed: number;
  origem: OrigemSeed;
}

/** Resolve qual seed usar pra uma variante, entre as fontes possíveis, na
 * ordem em que a mais explícita vence:
 *
 * 1. `--seed N` da CLI — override pontual desta execução, pra testar uma seed
 *    nova sem editar o `portrait.json` (regenerar uma imagem rejeitada na
 *    revisão). Sempre vence, mesmo que a variante já tenha `seed` fixada.
 * 2. `--seed` sem valor (`'random'`) — sorteia aqui e devolve origem
 *    `'aleatoria'`, o sinal de que `index.ts` grava esse número em
 *    `variantes.NNN.seed` depois que a imagem fica pronta.
 * 3. `variantes.NNN.seed` do `portrait.json` — a última seed usada nesta
 *    variante, gravada por um `--seed` sem valor ou colada à mão. Vale pra
 *    todas as execuções seguintes que não passem `--seed`.
 * 4. `seedDeterministica` — piso padrão, sem intervenção nenhuma.
 *
 * A escrita em si mora em `index.ts`/`aplicarSeed`: esta função decide qual
 * seed vale nesta execução e, pela origem, se ela merece ser persistida. */
export function resolverSeed(
  cliSeed: number | 'random' | undefined,
  seedConfig: number | undefined,
  seedDeterministicaValor: number
): SeedResolvida {
  if (cliSeed === 'random') return { seed: sortearSeed(), origem: 'aleatoria' };
  if (cliSeed !== undefined) return { seed: cliSeed, origem: 'cli' };
  if (seedConfig !== undefined) return { seed: seedConfig, origem: 'config' };
  return { seed: seedDeterministicaValor, origem: 'deterministica' };
}
