/** Vocabulário fechado usado pelo schema de `portrait.json` (`schema.ts`).
 *
 * As listas de `person`/`hair`/`eyes` abaixo foram portadas do pacote
 * `ComfyUI-OOP` (`custom_nodes/ComfyUI-OOP`, `0xRavenBlack/ComfyUI-OOP`) —
 * eram extraídas ao vivo do `object_info` do ComfyUI local (ver histórico
 * dessa extração em `generate-art-v1-historico-da-sessao.md`), mas o projeto
 * abandonou a dependência do pacote (`generate-art-migracao-schema-proprio.md`)
 * e essas listas viraram uma **cópia estática**, mantida aqui manualmente —
 * não são mais revalidadas contra uma API ao vivo. Só um valor exatamente
 * igual a um destes é aceito, então digitar errado é pego pelo schema, não
 * silenciosamente aceito e ignorado pelo ComfyUI. */

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
 * equivalente pra `CORES_CABELO`/`CORES_OLHO`, cujos valores já são óbvios
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

/** Cada valor tem um texto de reforço correspondente em `prompt-builder.ts`
 * (`TEXTO_ETNIA`) — se um valor novo entrar aqui, o TypeScript trava a build
 * até ganhar entrada lá também (mesmo mecanismo de `FORMAS_CORPO_DESCRICOES`
 * etc., `Record` não-`Partial`). */
export const ETNIAS = ['African', 'Asian', 'Caucasian', 'Latino', 'Pacific', 'Mixed', 'Nordic'] as const;

export const GENEROS_PESSOA = ['Female', 'Male', 'Androgynous'] as const;

export const ESTILOS_CABELO = [
  'Short', 'Long', 'Curly', 'Straight', 'Wavy', 'Bald', 'Ponytail', 'Braided', 'Bun', 'Spiky', 'Undercut',
  'Afro', 'Dreadlocks', 'Long Curly', 'Short Curly', 'Long Straight', 'Short Straight', 'Long Wavy', 'Short Wavy',
] as const;

/** Ver rationale completo no comentário de `FORMAS_CORPO_DESCRICOES` acima.
 * Os seis valores compostos no fim (`"Long Curly"` etc.) combinam
 * comprimento (`Long`/`Short`) com textura (`Curly`/`Straight`/`Wavy`) num
 * único valor — os dois eixos são independentes em `style`, então antes
 * dessa adição não dava pra escolher os dois ao mesmo tempo. Convenção de
 * nome: duas palavras, Title Case, com espaço — mesmo precedente já usado
 * em `CORES_CABELO` (`"Sky Blue"`); funciona sem tocar em `schema.ts`/
 * `prompt-builder.ts`, já que `hair.style.toLowerCase()` concatena a string
 * inteira no prompt ("long curly hair"). Os valores standalone (`Curly`,
 * `Straight`, `Wavy`, `Long`, `Short`) continuam disponíveis pra quem não
 * quer especificar os dois eixos. */
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

export const CORES_CABELO = [
  ' ', 'Black', 'Brown', 'Blonde', 'Red', 'White', 'Gray', 'Blue', 'Green', 'Pink', 'Purple', 'Orange',
  'Yellow', 'Teal', 'Cyan', 'Magenta', 'Maroon', 'Turquoise', 'Lavender', 'Beige', 'Gold', 'Silver',
  'Bronze', 'Copper', 'Indigo', 'Violet', 'Lilac', 'Burgundy', 'Olive', 'Peach', 'Coral', 'Mint', 'Azure',
  'Amber', 'Charcoal', 'Navy', 'Sky Blue', 'Lime', 'Mustard', 'Rose', 'Periwinkle', 'Salmon', 'Emerald',
  'Sapphire', 'Ruby', 'Platinum',
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
 * **novo**, exclusivo deste schema. Categoria ampla e reaproveitável entre
 * espécies (ex.: `Human` cobre `ssm_default`, `ssm_knight`, `ssm_astral` e
 * `ssm_mercenary`, todas visualmente bem diferentes entre si) — a
 * diferenciação visual entre espécies que compartilham o mesmo `value` é
 * responsabilidade do campo `description` de `Tipo`, não deste enum.
 * Levantamento completo das 18 espécies do pacote em
 * `generate-art-migracao-schema-proprio.md`. */
export const TIPOS = [
  'Human', 'Elf', 'Mermaid', 'Necroid', 'Furry', 'Molluscoid', 'Eldritch', 'Robot', 'Avian', 'Alien', 'Cyborg',
] as const;

/** Ver rationale completo no comentário de `FORMAS_CORPO_DESCRICOES` acima. */
export const TIPOS_DESCRICOES: Record<(typeof TIPOS)[number], string> = {
  Human: 'humano',
  Elf: 'élfico',
  Mermaid: 'sereia/tritão',
  Necroid: 'necroide, morto-vivo/esquelético',
  Furry: 'peludo, antropomórfico animal',
  Molluscoid: 'moluscoide, tipo molusco/lesma',
  Eldritch: 'eldritch, criatura cósmica/tentacular',
  Robot: 'robótico',
  Avian: 'aviano, tipo ave',
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
  altura: 'escala a arte pela altura mínima do guia (composições atipicamente largas)',
};

/** Ver `AncoraVertical` em `generate-portraits/types.ts`. */
export const ANCORAS_VERTICAIS = ['conteudo', 'cabeca'] as const;

/** Ver rationale completo no comentário de `FORMAS_CORPO_DESCRICOES` acima. */
export const ANCORAS_VERTICAIS_DESCRICOES: Record<(typeof ANCORAS_VERTICAIS)[number], string> = {
  conteudo: 'encosta no topo do guia o bounding box da arte (padrão)',
  cabeca: 'encosta no topo do guia a cabeça, primeira linha densa de pixels opacos',
};

/** Estado do tronco — descreve o que está (ou não) cobrindo o tronco,
 * **sem julgar** "mais coberto é melhor" (`ssm_mermaids` com escama à
 * mostra no tronco é um estado tão correto quanto `ssm_astral` com
 * armadura completa). Existe como campo estruturado dedicado — em vez de
 * só texto livre — porque foi exatamente isso ("barriga/peito de fora
 * mesmo pedindo cobertura total") que se perdeu repetidamente no meio de
 * um `extra` longo durante o desenvolvimento do `ssm_astral`, mesmo com
 * reforço de peso (ver `generate-art-migracao-schema-proprio.md`). */
export const ESTADOS_TORSO = [
  'Bare', 'FullyCovered', 'ArmsCoveredTorsoBare', 'TorsoCoveredArmsBare', 'PartiallyCovered',
] as const;

/** Ver rationale completo no comentário de `FORMAS_CORPO_DESCRICOES` acima. */
export const ESTADOS_TORSO_DESCRICOES: Record<(typeof ESTADOS_TORSO)[number], string> = {
  Bare: 'tronco à mostra, sem cobertura',
  FullyCovered: 'tronco totalmente coberto',
  ArmsCoveredTorsoBare: 'braços cobertos, tronco à mostra',
  TorsoCoveredArmsBare: 'tronco coberto, braços à mostra',
  PartiallyCovered: 'tronco parcialmente coberto',
};
