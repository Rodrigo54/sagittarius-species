/** Descobre, nos `.gfx` do jogo, quais sprites são **retrato de personagem**.
 *
 * Não dá pra reconhecer isso pelo nome: a lista inclui
 * `GFX_contacts_portrait_character_masked`, `GFX_FC_portrait_character_masked`
 * e `GFX_portrait_room_masked_character_only`, que um filtro por prefixo
 * `GFX_portrait_character` deixaria de fora — e são contextos de UI reais (tela
 * de contatos, primeiro contato). O que os define é o próprio bloco: um
 * `portraitType` com `type = character` ou `character = yes`.
 *
 * Cada um desses sprites é um **enquadramento de câmera diferente** sobre o
 * mesmo mesh, então cada um precisa da sua própria âncora na calibração — a
 * janela de um `close_up` não é comparável à de um `character` sem isso. É por
 * isso que a saída é a lista de nomes: `coletarContextos` agrupa os contextos
 * por sprite, e cada grupo é uma câmera a calibrar.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/** O formato dos `.gfx` é Clausewitz, mas aqui basta varrer os blocos
 * `portraitType = { ... }` — parsear a árvore inteira só para ler um nome
 * seria custo sem retorno, e o bloco é plano. */
export function extrairNomesDeRetrato(texto: string): string[] {
  const nomes: string[] = [];

  for (const bloco of texto.matchAll(/portraitType\s*=\s*\{([\s\S]*?)\n\s*\}/g)) {
    const corpo = bloco[1];
    const nome = corpo.match(/name\s*=\s*"([^"]+)"/)?.[1];
    if (!nome) continue;

    const ehPersonagem =
      /\btype\s*=\s*character\b/i.test(corpo) || /\bcharacter\s*=\s*yes\b/i.test(corpo);
    if (!ehPersonagem) continue;

    nomes.push(nome);
  }

  return nomes;
}

export async function lerNomesDeRetrato(stellarisPath: string): Promise<string[]> {
  const pastaInterface = join(stellarisPath, 'interface');
  const arquivos = (await readdir(pastaInterface)).filter((f) => f.endsWith('.gfx')).sort();

  const nomes: string[] = [];
  for (const arquivo of arquivos) {
    nomes.push(...extrairNomesDeRetrato(await readFile(join(pastaInterface, arquivo), 'latin1')));
  }
  return nomes;
}
