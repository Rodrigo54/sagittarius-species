/** Um valor qualquer de script Clausewitz, como ele existe no JSON-fonte de
 * `assets/name_lists/`: escalar, lista, ou bloco aninhado. O formato não tem
 * schema fixo (cada cultura declara os aspectos que quiser), então o que dá
 * pra afirmar é a forma recursiva — o suficiente pro escritor decidir como
 * serializar cada nó sem `any`. */
export type ValorClausewitz =
  | string
  | number
  | boolean
  | ValorClausewitz[]
  | { [chave: string]: ValorClausewitz };

export type BlocoClausewitz = { [chave: string]: ValorClausewitz };

/** `valor` como bloco aninhado, ou `undefined` se for escalar/lista — evita
 * repetir o par `typeof`/`Array.isArray` em cada ponto de inspeção. */
export function comoBloco(valor: ValorClausewitz | undefined): BlocoClausewitz | undefined {
  if (valor === undefined || typeof valor !== 'object' || Array.isArray(valor)) return undefined;
  return valor;
}

export interface VanillaKeys {
  army: string[];
  shipSize: string[];
  planetClass: string[];
}

export interface SpeciesNameEntry {
  key: string;
  name: string;
  plural: string;
  home_planet?: string;
  home_system?: string;
  portrait: string;
  species_class?: string;
}
