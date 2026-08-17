import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { GeneroAlvo } from '../portrait-schema';

/** Espelha em `geracaoArt.<gênero>.variantes.<chave>.seed`, no texto de um
 * `portrait.json`, a seed resolvida pra variante, devolvendo o texto novo.
 * `seed: undefined` significa o que já significa no resto do pipeline
 * (`resolverSeed`, `camposVariante.seed`) — "esta variante não declara
 * seed" —, e apaga a chave.
 *
 * Trabalha sobre o texto CRU do arquivo, nunca sobre o objeto que `lerConfig`
 * devolve: o zod reconstrói o objeto na ordem das chaves do *schema*, não na
 * do arquivo, então reserializar aquilo reordenaria o `portrait.json` inteiro.
 * Partindo do texto, o diff sai só na linha da seed.
 *
 * A serialização (2 espaços + newline final) é a mesma que os `portrait.json`
 * do repositório já usam — o round-trip é byte a byte idêntico na maioria
 * deles, e normaliza whitespace nos poucos que divergem. */
export function aplicarSeed(
  textoJson: string,
  genero: GeneroAlvo,
  chave: string,
  seed: number | undefined
): string {
  const dados = JSON.parse(textoJson);
  const variante = dados?.geracaoArt?.[genero]?.variantes?.[chave];
  if (variante === undefined || variante === null || typeof variante !== 'object') {
    throw new Error(`portrait.json não declara geracaoArt.${genero}.variantes.${chave} — seed não gravada.`);
  }
  if (seed === undefined) {
    delete variante.seed;
  } else {
    variante.seed = seed;
  }
  return `${JSON.stringify(dados, null, 2)}\n`;
}

/** Relê o `portrait.json` da espécie e espelha nele a seed da variante —
 * gravando o número, ou apagando a chave quando `seed` é `undefined`.
 *
 * A releitura do disco é de propósito: entre o início da execução e este
 * ponto passaram-se minutos de GPU, e o arquivo pode ter sido editado nesse
 * meio-tempo — reescrever a partir do que foi lido lá atrás desfaria a
 * edição. */
export async function gravarSeed(
  pastaEspecie: string,
  genero: GeneroAlvo,
  chave: string,
  seed: number | undefined
): Promise<void> {
  const caminho = join(pastaEspecie, 'portrait.json');
  const texto = await readFile(caminho, 'utf-8');
  await writeFile(caminho, aplicarSeed(texto, genero, chave, seed), 'utf-8');
}
