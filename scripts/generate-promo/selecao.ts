import { basename } from 'node:path';
import type { SpeciesInfo } from '../shared/species';
import type { RoomsInfo } from '../generate-rooms/types';
import type { GeneroAlvo } from '../portrait-schema';
import type { EspeciePromo, GeneroPromo } from '../promo-schema';
import type { Colocacao } from './layout';

export interface VariantePodio {
  /** Caminho completo do PNG do personagem, em assets/portraits/. */
  caminho: string;
  genero: GeneroAlvo;
  /** Colocação no pódio: 1 = maior/destaque, 3 = menor. A ordem declarada em
   * `especie.variantes` É a ordem de colocação — a 1ª entrada é o 1º lugar. */
  colocacao: Colocacao;
}

/** Resolve as 3 variantes do pódio a partir do que a espécie declarou
 * explicitamente em `species-promo.json` — não há seleção automática, a
 * escolha de quais PNGs aparecem é sempre manual. */
export function selecionarVariantes(info: SpeciesInfo, variantes: EspeciePromo['variantes']): VariantePodio[] {
  return variantes.map((chave, i) => ({
    ...resolverVariante(info, chave),
    colocacao: (i + 1) as Colocacao,
  }));
}

function resolverVariante(info: SpeciesInfo, chave: string): { caminho: string; genero: GeneroAlvo } {
  const [genero, indice] = chave.split('/') as [GeneroPromo, string];
  const arquivos = info.arquivos[genero] ?? [];
  const caminho = arquivos.find((arquivo) => basename(arquivo) === `${indice}.png`);
  if (caminho === undefined) {
    throw new Error(
      `${info.slug}: variante "${chave}" (de species-promo.json) não existe em assets/portraits/${info.slug}/${genero}/`
    );
  }
  return { caminho, genero };
}

/** Hash determinístico (FNV-1a de 32 bits) — o mesmo slug sempre escolhe o
 * mesmo fundo entre execuções, sem guardar estado em lugar nenhum. */
function hashFnv1a(texto: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Escolhe o fundo (`assets/city_sets/NNN_room.png`) — por hash determinístico
 * do slug sobre a lista de rooms disponíveis, ou pelo override `fundo` em
 * species-promo.json. */
export function selecionarFundo(slug: string, rooms: RoomsInfo, override: string | undefined): string {
  if (override !== undefined) {
    const caminho = rooms.arquivos.find((arquivo) => basename(arquivo) === `${override}_room.png`);
    if (caminho === undefined) {
      throw new Error(`${slug}: fundo "${override}" (de species-promo.json) não existe em assets/city_sets/`);
    }
    return caminho;
  }

  if (rooms.arquivos.length === 0) {
    throw new Error(`${slug}: nenhum fundo disponível em assets/city_sets/`);
  }
  return rooms.arquivos[hashFnv1a(slug) % rooms.arquivos.length];
}
