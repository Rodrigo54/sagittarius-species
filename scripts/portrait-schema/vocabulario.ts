/** Vocabulário fechado usado pelo schema de `portrait.json` (`schema.ts`).
 *
 * As listas de `person`/`hair`/`eyes` abaixo são uma **cópia estática**,
 * mantida aqui manualmente — não são revalidadas contra nenhuma API ao vivo
 * (histórico de por que era diferente antes: `docs/history/2026-07-28-generate-art-v1.md`
 * e `docs/history/2026-08-08-generate-art-schema-proprio.md`). Só um valor
 * exatamente igual a um destes é aceito, então digitar errado é pego pelo
 * schema, não silenciosamente aceito e ignorado pelo ComfyUI. */

export const FORMAS_CORPO = [
  'Slim', 'Athletic', 'Average', 'Curvy', 'Chubby', 'Hourglass', 'Muscular',
] as const;

/** Descrição em português por valor — usada por `gerar-json-schema.ts` pra
 * injetar `enumDescriptions` no JSON Schema gerado, reconhecido pelo
 * language service de JSON do VS Code (mesmo mecanismo do enum de
 * `settings.json`) pra mostrar a descrição de cada valor no hover/
 * autocomplete de `portrait.json` — não só a descrição do campo inteiro
 * (`.describe()` em `schema.ts` já cobre isso). `Record<(typeof X)[number],
 * string>` (não `Partial`) de propósito: o TypeScript trava a build se um
 * valor novo entrar no array acima sem ganhar descrição aqui. Escopo
 * deliberadamente limitado aos enums não autoexplicáveis — não existe mapa
 * equivalente pra `CORES`/`CORES_OLHO`, cujos valores já são óbvios
 * em inglês ("Blue", "Black"...). */
export const FORMAS_CORPO_DESCRICOES: Record<(typeof FORMAS_CORPO)[number], string> = {
  Slim: 'corpo magro',
  Athletic: 'corpo atlético',
  Average: 'corpo mediano',
  Curvy: 'corpo com curvas acentuadas',
  Chubby: 'corpo rechonchudo',
  Hourglass: 'corpo em ampulheta, cintura marcada',
  Muscular: 'corpo musculoso',
};

/** Cada valor tem um texto de reforço correspondente em `vocabulary` do
 * `scripts/generate-art/base.json` — o schema daquele arquivo é derivado
 * deste array e exige uma entrada por valor, então um valor novo aqui trava
 * a geração (e `bun test`) até ganhar texto lá. */
export const ETNIAS = ['African', 'Asian', 'Caucasian', 'Latino', 'Pacific', 'Mixed', 'Nordic'] as const;

export const GENEROS_PESSOA = ['Female', 'Male', 'Androgynous'] as const;

export const ESTILOS_CABELO = [
  'Short', 'Long', 'Curly', 'Straight', 'Wavy', 'Bald', 'Ponytail', 'Braided', 'Bun', 'Spiky', 'Undercut',
  'Afro', 'Dreadlocks', 'Long Curly', 'Short Curly', 'Long Straight', 'Short Straight', 'Long Wavy', 'Short Wavy',
] as const;

/** Ver rationale completo no comentário de `FORMAS_CORPO_DESCRICOES` acima.
 * Os seis valores compostos no fim (`"Long Curly"` etc.) combinam
 * comprimento (`Long`/`Short`) com textura (`Curly`/`Straight`/`Wavy`) num
 * único valor, porque `style` é um campo só e os dois eixos são
 * independentes. Convenção de nome: duas palavras, Title Case, com espaço —
 * mesmo precedente de `CORES` (`"Sky Blue"`); não exige nada de `schema.ts`/
 * `prompt-builder.ts`, já que `hair.style.toLowerCase()` concatena a string
 * inteira no prompt ("long curly hair"). Os valores standalone (`Curly`,
 * `Straight`, `Wavy`, `Long`, `Short`) atendem quem não quer especificar os
 * dois eixos. */
export const ESTILOS_CABELO_DESCRICOES: Record<(typeof ESTILOS_CABELO)[number], string> = {
  Short: 'cabelo curto',
  Long: 'cabelo longo',
  Curly: 'cabelo cacheado',
  Straight: 'cabelo liso',
  Wavy: 'cabelo ondulado',
  Bald: 'careca, sem cabelo',
  Ponytail: 'rabo de cavalo',
  Braided: 'cabelo trançado',
  Bun: 'coque',
  Spiky: 'cabelo espetado',
  Undercut: 'raspado nas laterais, mais longo no topo',
  Afro: 'cabelo afro (black power)',
  Dreadlocks: 'dreadlocks',
  'Long Curly': 'cabelo cacheado longo',
  'Short Curly': 'cabelo cacheado curto',
  'Long Straight': 'cabelo liso longo',
  'Short Straight': 'cabelo liso curto',
  'Long Wavy': 'cabelo ondulado longo',
  'Short Wavy': 'cabelo ondulado curto',
};

/** Vocabulário de cor genérico, não só de cabelo: `hair.primary_color`/
 * `secondary_color` e `torso.primary_color`/`secondary_color` reaproveitam a
 * mesma lista (cor de armadura/vestimenta varia por indivíduo sem duplicar a
 * frase inteira — o template da seção posiciona cada cor na peça certa).
 *
 * Não existe valor "nenhuma cor" aqui: ausência se expressa **omitindo a
 * chave** (todo campo de cor é `.optional()` no schema), e o template marca o
 * trecho correspondente como opcional (`[ with <hair.secondary_color>
 * highlights]`). */
export const CORES = [
  'Black', 'Brown', 'Blonde', 'Red', 'White', 'Gray', 'Blue', 'Green', 'Pink', 'Purple', 'Orange',
  'Yellow', 'Teal', 'Cyan', 'Magenta', 'Maroon', 'Turquoise', 'Lavender', 'Beige', 'Gold', 'Silver',
  'Bronze', 'Copper', 'Indigo', 'Violet', 'Lilac', 'Burgundy', 'Olive', 'Peach', 'Coral', 'Mint', 'Azure',
  'Amber', 'Charcoal', 'Navy', 'Sky Blue', 'Lime', 'Mustard', 'Rose', 'Periwinkle', 'Salmon', 'Emerald',
  'Sapphire', 'Ruby', 'Platinum', 'Amethyst', 'Pearl',
] as const;

export const FORMAS_OLHO = [
  'Round', 'Almond', 'Hooded', 'Monolid', 'Upturned', 'Downturned', 'Oval', 'Closed',
] as const;

/** Ver rationale completo no comentário de `FORMAS_CORPO_DESCRICOES` acima. */
export const FORMAS_OLHO_DESCRICOES: Record<(typeof FORMAS_OLHO)[number], string> = {
  Round: 'olhos redondos',
  Almond: 'olhos amendoados',
  Hooded: 'olhos com pálpebra caída, cobrindo parte da dobra',
  Monolid: 'olhos sem dobra visível na pálpebra',
  Upturned: 'olhos puxados para cima nos cantos externos',
  Downturned: 'olhos caídos para baixo nos cantos externos',
  Oval: 'olhos ovais',
  Closed: 'olhos fechados',
};

export const CORES_OLHO = ['Blue', 'Green', 'Brown', 'Hazel', 'Gray', 'Amber', 'Violet'] as const;

/** Arquétipo visual pro prompt de geração de arte via IA — vocabulário
 * exclusivo deste schema. Categoria ampla e reaproveitável entre espécies
 * (ex.: `Human` cobre `ssm_default`, `ssm_knight`, `ssm_astral` e
 * `ssm_mercenary`, todas visualmente bem diferentes entre si) — a
 * diferenciação visual entre espécies que compartilham o mesmo arquétipo é
 * responsabilidade do `template` da seção `species`, não deste enum.
 * Levantamento completo das 18 espécies do pacote em
 * `docs/history/2026-08-08-generate-art-schema-proprio.md`. */
export const ARQUETIPOS = [
  'Human', 'Elf', 'Mermaid', 'Necroid', 'Furry', 'Molluscoid', 'Eldritch', 'Robot', 'Avian', 'Draconic', 'Alien',
  'Cyborg',
] as const;

/** Ver rationale completo no comentário de `FORMAS_CORPO_DESCRICOES` acima. */
export const ARQUETIPOS_DESCRICOES: Record<(typeof ARQUETIPOS)[number], string> = {
  Human: 'humano',
  Elf: 'élfico',
  Mermaid: 'sereia/tritão',
  Necroid: 'necroide, morto-vivo/esquelético',
  Furry: 'peludo, antropomórfico animal',
  Molluscoid: 'moluscoide, tipo molusco/lesma',
  Eldritch: 'eldritch, criatura cósmica/tentacular',
  Robot: 'robótico',
  Avian: 'aviano, tipo ave',
  Draconic: 'dracônico, dragão humanoide',
  Alien: 'alienígena genérico',
  Cyborg: 'ciborgue, parte orgânico e parte máquina',
};

/** Rig de retrato compartilhado (`gfx/models/portraits/<rig>/`) — ver
 * `RIGS`/`RigInfo` em `generate-portraits/types.ts` pro que cada um significa
 * (canvas, guia de enquadramento). Fonte de verdade do *valor* aceito mora
 * aqui; o que cada valor *implica* (canvas, geometria) mora em
 * `generate-portraits`, que não é usado pelo schema. */
export const RIGS_VALIDOS = ['sl_shared', 'ssm_shared'] as const;
export type RigId = (typeof RIGS_VALIDOS)[number];

/** Ver `ModoEnquadramento` em `generate-portraits/types.ts`. */
export const MODOS_ENQUADRAMENTO = ['largura', 'altura'] as const;

/** Ver rationale completo no comentário de `FORMAS_CORPO_DESCRICOES` acima. */
export const MODOS_ENQUADRAMENTO_DESCRICOES: Record<(typeof MODOS_ENQUADRAMENTO)[number], string> = {
  largura: 'escala a arte pela largura do guia (padrão)',
  altura:
    'escala a arte pela altura mínima do guia (composições largas demais pro guia, ' +
    'ou que precisam mostrar algo abaixo do busto)',
};

/** Ver `AncoraVertical` em `generate-portraits/types.ts`. */
export const ANCORAS_VERTICAIS = ['conteudo', 'cabeca'] as const;

/** Ver rationale completo no comentário de `FORMAS_CORPO_DESCRICOES` acima. */
export const ANCORAS_VERTICAIS_DESCRICOES: Record<(typeof ANCORAS_VERTICAIS)[number], string> = {
  conteudo: 'encosta no topo do guia o bounding box da arte (padrão)',
  cabeca: 'encosta no topo do guia a cabeça, primeira linha densa de pixels opacos',
};

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

/** Estado do tronco — descreve o que está (ou não) cobrindo o tronco,
 * **sem julgar** "mais coberto é melhor" (`ssm_mermaids` com escama à
 * mostra no tronco é um estado tão correto quanto `ssm_astral` com
 * armadura completa). Existe como campo estruturado dedicado — em vez de
 * só texto livre — porque é isso ("barriga/peito de fora mesmo pedindo
 * cobertura total") que se perde no meio de um texto longo, mesmo com
 * reforço de peso (ver `docs/history/2026-08-08-generate-art-schema-proprio.md`).
 * Cada valor tem entrada em `vocabulary` do `base.json`, com os dois lados
 * (positivo e, quando há oposto claro, negativo). */
export const ESTADOS_TORSO = [
  'Bare', 'FullyCovered', 'ArmsCoveredTorsoBare', 'TorsoCoveredArmsBare', 'PartiallyCovered',
  'CroppedSleeved',
] as const;

/** Ver rationale completo no comentário de `FORMAS_CORPO_DESCRICOES` acima. */
export const ESTADOS_TORSO_DESCRICOES: Record<(typeof ESTADOS_TORSO)[number], string> = {
  Bare: 'tronco à mostra, sem cobertura',
  FullyCovered: 'tronco totalmente coberto',
  ArmsCoveredTorsoBare: 'braços cobertos, tronco à mostra',
  TorsoCoveredArmsBare: 'tronco coberto, braços à mostra',
  PartiallyCovered: 'tronco parcialmente coberto',
  CroppedSleeved: 'peito e braços cobertos (top cropped com manga comprida), barriga à mostra',
};
