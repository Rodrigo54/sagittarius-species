/** Seed determinística (FNV-1a 32-bit) derivada de espécie+gênero+variante —
 * rodar a mesma variante duas vezes produz a mesma imagem, sem guardar
 * estado em lugar nenhum. Regenerar de propósito (imagem rejeitada na
 * revisão) exige passar `--seed` explícito, sobrescrevendo só aquele
 * índice. */
export function seedDeterministica(slug: string, genero: string, variante: string): number {
  const texto = `${slug}:${genero}:${variante}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
