/** Hash puro, sem dependência nenhuma, agnóstico de motor de geração.
 *
 * Seed determinística (FNV-1a 32-bit) derivada de espécie+gênero+variante —
 * rodar a mesma variante duas vezes produz a mesma imagem, sem guardar
 * estado em lugar nenhum. É o piso padrão, usado quando nem `--seed` da CLI
 * nem `variantes.NNN.seed` do `portrait.json` estão presentes, e é também
 * pra onde `--seed default` devolve a variante (ver `resolverSeed` abaixo). */
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

/** De onde a seed final veio e, junto, o que isso implica pro
 * `portrait.json` — `index.ts` decide gravar/remover/não-tocar olhando só
 * pra este rótulo, sem reconsultar a config:
 *
 * - `'cli'` — `--seed N`: grava `N` na variante.
 * - `'aleatoria'` — `--seed` sem valor: grava o número sorteado.
 * - `'padrao'` — `--seed default` numa variante que TINHA seed gravada:
 *   remove a chave.
 * - `'config'` / `'deterministica'` — nada a escrever; o arquivo já descreve
 *   a imagem que vai sair. */
export type OrigemSeed = 'cli' | 'aleatoria' | 'padrao' | 'config' | 'deterministica';

export interface SeedResolvida {
  seed: number;
  origem: OrigemSeed;
}

/** Resolve qual seed usar pra uma variante, entre as fontes possíveis, na
 * ordem em que a mais explícita vence:
 *
 * 1. `--seed N` da CLI — fixa `N` nesta variante: gera com ela e a grava,
 *    ainda que a variante já tivesse outra `seed`.
 * 2. `--seed` sem valor (`'random'`) — sorteia aqui e grava o sorteio.
 * 3. `--seed default` — devolve a variante ao piso determinístico e apaga a
 *    `seed` gravada. Sem seed gravada não há o que apagar, então a origem
 *    colapsa em `'deterministica'`: o comando vira no-op no arquivo, e rodá-lo
 *    duas vezes não produz diff na segunda.
 * 4. `variantes.NNN.seed` do `portrait.json` — a seed da imagem que está em
 *    disco. Vale pra toda execução que não passe `--seed`.
 * 5. `seedDeterministica` — piso padrão, sem intervenção nenhuma.
 *
 * Toda forma de `--seed` é uma declaração persistente: o campo `seed` do
 * `portrait.json` descreve a seed da imagem em disco, não a última coisa
 * digitada na CLI. A escrita em si mora em `index.ts`/`gravarSeed`, e só
 * acontece depois que o PNG existe. */
export function resolverSeed(
  cliSeed: number | 'random' | 'default' | undefined,
  seedConfig: number | undefined,
  seedDeterministicaValor: number
): SeedResolvida {
  if (cliSeed === 'random') return { seed: sortearSeed(), origem: 'aleatoria' };
  if (cliSeed === 'default') {
    return { seed: seedDeterministicaValor, origem: seedConfig !== undefined ? 'padrao' : 'deterministica' };
  }
  if (cliSeed !== undefined) return { seed: cliSeed, origem: 'cli' };
  if (seedConfig !== undefined) return { seed: seedConfig, origem: 'config' };
  return { seed: seedDeterministicaValor, origem: 'deterministica' };
}
