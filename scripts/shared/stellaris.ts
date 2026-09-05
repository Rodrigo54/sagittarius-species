/** `species_class` do Stellaris a que uma espécie deste mod pode pertencer.
 * Só classes que o jogo de fato usa para espécies de império (jogável ou de
 * IA): `PSIONIC` e `CYBERNETIC` ficam de fora de propósito — existem no
 * vanilla para o ship set, têm `randomized = { always = no }`, e usá-las
 * tiraria a espécie do sorteio de impérios de IA (ver `docs/pipeline-taxonomy.md`).
 *
 * A ordem em que a espécie declara estas classes é a ordem de preferência
 * quando há DLC envolvido: a primeira ganha o gate positivo, as seguintes
 * acumulam as negações — quem não tem o DLC cai na classe seguinte. */
export const SPECIES_CLASSES_VALIDAS = [
  'HUM', 'MAM', 'REP', 'AVI', 'ART', 'MOL', 'FUN', 'PLANT', 'LITHOID', 'NECROID', 'AQUATIC', 'TOX', 'INF',
  'MACHINE',
] as const;
export type SpeciesClassId = (typeof SPECIES_CLASSES_VALIDAS)[number];

/** Ver rationale completo no comentário de `FORMAS_CORPO_DESCRICOES` acima. */
export const SPECIES_CLASSES_DESCRICOES: Record<SpeciesClassId, string> = {
  HUM: 'humanoide',
  MAM: 'mamífero',
  REP: 'reptiliano',
  AVI: 'aviano',
  ART: 'artrópode',
  MOL: 'moluscoide',
  FUN: 'fungoide',
  PLANT: 'plantoide — o retrato exige o Plantoids Species Pack (a classe também é jogável com o Ancient Relics Story Pack)',
  LITHOID: 'lithoide — exige o Lithoids Species Pack',
  NECROID: 'necroide — o retrato exige o Necroids Species Pack (a classe também é jogável com o Vipra the Vapor)',
  AQUATIC: 'aquático — o retrato exige o Aquatics Species Pack (a classe também é jogável com o Shadows of the Shroud)',
  TOX: 'toxoide — exige o Toxoids Species Pack',
  INF: 'infernal — exige o Infernals Species Pack',
  MACHINE: 'máquina',
};

/** Categoria de retrato (`common/portrait_categories/`) — a aba do editor de
 * império onde a espécie aparece. Duas naturezas, misturadas de propósito num
 * enum só porque a espécie declara as duas do mesmo jeito:
 *
 * - **espelhada**: corresponde a uma `species_class` (`infernals` ↔ `INF`),
 *   ver `CATEGORIA_DA_CLASSE`;
 * - **temática**: transversal a classes (`cybernetics` agrupa sets de sete
 *   classes diferentes no vanilla), rotulada por uma chave de localização que
 *   nem sempre é uma classe (`synthetics` usa `SYNTH`, que não existe em
 *   `species_classes`).
 *
 * `sagittarius` não está aqui: é a categoria guarda-chuva do mod e recebe
 * **todos** os sets automaticamente, sem ser declarada por espécie. */
export const CATEGORIAS_VALIDAS = [
  'humanoids', 'mammalians', 'reptilians', 'avians', 'arthropoids', 'molluscoids', 'fungoids', 'plantoids',
  'lithoids', 'necroids', 'aquatics', 'toxoids', 'infernals', 'machines',
  'cybernetics', 'synthetics', 'psionics',
] as const;
export type CategoriaId = (typeof CATEGORIAS_VALIDAS)[number];

/** Ver rationale completo no comentário de `FORMAS_CORPO_DESCRICOES` acima. */
export const CATEGORIAS_DESCRICOES: Record<CategoriaId, string> = {
  humanoids: 'aba Humanoid — espelha a classe HUM',
  mammalians: 'aba Mammalian — espelha a classe MAM',
  reptilians: 'aba Reptilian — espelha a classe REP',
  avians: 'aba Avian — espelha a classe AVI',
  arthropoids: 'aba Arthropoid — espelha a classe ART',
  molluscoids: 'aba Molluscoid — espelha a classe MOL',
  fungoids: 'aba Fungoid — espelha a classe FUN',
  plantoids: 'aba Plantoid — espelha a classe PLANT',
  lithoids: 'aba Lithoid — espelha a classe LITHOID',
  necroids: 'aba Necroid — espelha a classe NECROID',
  aquatics: 'aba Aquatic — espelha a classe AQUATIC',
  toxoids: 'aba Toxoid — espelha a classe TOX',
  infernals: 'aba Infernal — espelha a classe INF',
  machines: 'aba Machine — espelha a classe MACHINE',
  cybernetics: 'aba Cybernetic — temática, transversal a classes',
  synthetics: 'aba Synthetic — temática, transversal a classes',
  psionics: 'aba Psionic — temática, transversal a classes',
};

/** A categoria que espelha cada classe. Usado pelo schema pra rejeitar
 * declaração incoerente (categoria `aquatics` sem a classe `AQUATIC`) e pelo
 * `generate-taxonomy` pra saber qual categoria uma classe implica. */
export const CATEGORIA_DA_CLASSE: Record<SpeciesClassId, CategoriaId> = {
  HUM: 'humanoids',
  MAM: 'mammalians',
  REP: 'reptilians',
  AVI: 'avians',
  ART: 'arthropoids',
  MOL: 'molluscoids',
  FUN: 'fungoids',
  PLANT: 'plantoids',
  LITHOID: 'lithoids',
  NECROID: 'necroids',
  AQUATIC: 'aquatics',
  TOX: 'toxoids',
  INF: 'infernals',
  MACHINE: 'machines',
};

/** As categorias que **não** espelham classe nenhuma — livres pra qualquer
 * espécie declarar, já que não afirmam nada sobre a classe dela. */
export const CATEGORIAS_TEMATICAS: readonly CategoriaId[] = CATEGORIAS_VALIDAS.filter(
  (categoria) => !Object.values(CATEGORIA_DA_CLASSE).includes(categoria)
);

