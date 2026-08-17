/** Um valor qualquer de script Clausewitz, como ele existe no JSON-fonte de
 * `assets/name_lists/`: escalar, lista, ou bloco aninhado. Definido junto do
 * schema (`scripts/name-list-schema/`), que é o dono do formato do arquivo, e
 * reexportado aqui porque o escritor deste pipeline decide a serialização de
 * cada nó a partir desse tipo. */
export type { ValorClausewitz } from '../name-list-schema';
import type { ValorClausewitz } from '../name-list-schema';

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

/** A entrada de espécie-flavor também é definida pelo schema — reexportada
 * aqui pra que os módulos deste pipeline continuem importando de um lugar só. */
export type { SpeciesNameEntry } from '../name-list-schema';
