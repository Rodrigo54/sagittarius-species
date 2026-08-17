import {
  CATEGORIA_DA_CLASSE,
  type CategoriaId,
  type SpeciesClassId,
} from '../portrait-schema';

/** Vocabulário **do jogo** que só o gerador de taxonomia precisa: como cada
 * `species_class` vira um set, qual gate de DLC ela carrega, e qual rótulo
 * cada categoria usa. O que a espécie pode *declarar* (as classes e categorias
 * válidas, e qual categoria espelha qual classe) mora em
 * `portrait-schema/vocabulario.ts`, porque é o schema que valida isso.
 *
 * Tudo aqui é vocabulário fixo da Paradox, conferido contra a instalação do
 * jogo — muda só quando sai DLC novo, não quando o mod ganha espécie. */

/** A categoria guarda-chuva do mod: recebe **todos** os sets, sempre, sem
 * nenhuma espécie precisar declará-la. `name` aponta pra chave de localização
 * própria (`ssm_sagittarius`), não pra uma `species_class` — categoria não
 * exige que o `name` seja uma classe (no vanilla, `synthetics` usa `SYNTH` e
 * `biogenesis` usa `BIOGENESIS_CAT`, que não existem em `species_classes`). */
export const CATEGORIA_GUARDA_CHUVA = 'sagittarius';

/** Nome do set de cada classe, quando a classe tem um agrupamento só. Havendo
 * mais de um (espécies da mesma classe pedindo categorias diferentes), o
 * gerador acrescenta as categorias temáticas ao nome — ver `nomeDoSet`.
 *
 * Os nomes reproduzem os que já estão publicados, inclusive o singular de
 * `ssm_machine`: set é referenciado só por `portrait_categories`, então
 * renomear seria inofensivo, mas manter deixa o diff do `.txt` gerado
 * legível contra o arquivo escrito à mão que ele substitui. */
export const SET_DA_CLASSE: Record<SpeciesClassId, string> = {
  HUM: 'ssm_humanoids',
  MAM: 'ssm_mammalians',
  REP: 'ssm_reptilians',
  AVI: 'ssm_avians',
  ART: 'ssm_arthropoids',
  MOL: 'ssm_molluscoids',
  FUN: 'ssm_fungoids',
  PLANT: 'ssm_plantoids',
  LITHOID: 'ssm_lithoids',
  NECROID: 'ssm_necroids',
  AQUATIC: 'ssm_aquatics',
  TOX: 'ssm_toxoids',
  INF: 'ssm_infernals',
  MACHINE: 'ssm_machine',
};

/** Scripted trigger vanilla que libera cada classe dependente de DLC. As seis
 * classes de Species Pack; as demais não têm gate (a classe está sempre
 * disponível, então o set também).
 *
 * O trigger é o do Species Pack, mesmo onde a classe tem uma **segunda porta**
 * (`PLANT` também é jogável com o Ancient Relics, `AQUATIC` com o Shadows of
 * the Shroud, `NECROID` com o Vipra the Vapor). É o mesmo recorte que o
 * vanilla faz nos sets dessas classes — o set `aquatics` exige `has_aquatics`
 * e ponto, sem cobrir a porta do Shroud. Efeito prático aqui: quem entrou pela
 * porta secundária recebe a espécie na classe de fallback (a sereia como
 * humanoide), nunca fica sem retrato.
 *
 * Todos são triggers booleanos (`has_X = { host_has_dlc = "..." }`), o que
 * permite tanto afirmar (`has_infernals = yes`) quanto negar
 * (`has_infernals = no`) — a negação é o que faz o fallback funcionar, e é
 * padrão vanilla (`custom_portraits` da classe MACHINE usa
 * `has_machine_age_dlc = no` do mesmo jeito).
 *
 * `MACHINE` **não** entra aqui: no vanilla o gate de DLC das máquinas está
 * por origem de retrato (`custom_portraits`), não na classe — a classe em si
 * é do jogo-base. */
export const GATE_DA_CLASSE: Partial<Record<SpeciesClassId, string>> = {
  PLANT: 'has_plantoids',
  LITHOID: 'has_lithoids',
  NECROID: 'has_necroids',
  AQUATIC: 'has_aquatics',
  TOX: 'has_toxoids',
  INF: 'has_infernals',
};

/** Rótulo (`name`) das categorias temáticas — as que não espelham classe
 * nenhuma. O `name` das espelhadas é a própria classe, derivado de
 * `CATEGORIA_DA_CLASSE`; ver `nameDaCategoria`. */
const NAME_DA_CATEGORIA_TEMATICA: Record<string, string> = {
  cybernetics: 'CYBERNETIC',
  synthetics: 'SYNTH',
  psionics: 'PSIONIC',
  [CATEGORIA_GUARDA_CHUVA]: 'ssm_sagittarius',
};

/** Classe espelhada por categoria — o inverso de `CATEGORIA_DA_CLASSE`. */
const CLASSE_DA_CATEGORIA = new Map<CategoriaId, SpeciesClassId>(
  (Object.entries(CATEGORIA_DA_CLASSE) as [SpeciesClassId, CategoriaId][]).map(
    ([classe, categoria]) => [categoria, classe]
  )
);

/** O `name` que a categoria leva no `.txt` gerado: a classe espelhada, quando
 * há uma; senão o rótulo temático. */
export function nameDaCategoria(categoria: CategoriaId | typeof CATEGORIA_GUARDA_CHUVA): string {
  const classe = CLASSE_DA_CATEGORIA.get(categoria as CategoriaId);
  if (classe !== undefined) return classe;

  const tematica = NAME_DA_CATEGORIA_TEMATICA[categoria];
  if (tematica === undefined) {
    throw new Error(`categoria "${categoria}" não tem rótulo (name) declarado em generate-taxonomy/vocabulario.ts`);
  }
  return tematica;
}
