/** Vocabulário fechado usado pelo schema de `portrait.json` (`schema.ts`).
 *
 * As listas de `person`/`hair`/`eyes` abaixo foram portadas do pacote
 * `ComfyUI-OOP` (`custom_nodes/ComfyUI-OOP`, `0xRavenBlack/ComfyUI-OOP`) —
 * eram extraídas ao vivo do `object_info` do ComfyUI local (ver histórico
 * dessa extração em `generate-art-historico-da-sessao.md`), mas o projeto
 * abandonou a dependência do pacote (`generate-art-migracao-schema-proprio.md`)
 * e essas listas viraram uma **cópia estática**, mantida aqui manualmente —
 * não são mais revalidadas contra uma API ao vivo. Só um valor exatamente
 * igual a um destes é aceito, então digitar errado é pego pelo schema, não
 * silenciosamente aceito e ignorado pelo ComfyUI. */

export const FORMAS_CORPO = [
  'Slim', 'Athletic', 'Average', 'Curvy', 'Chubby', 'Hourglass', 'Muscular',
] as const;

export const ETNIAS = ['African', 'Asian', 'Caucasian', 'Latino', 'Pacific', 'Alien'] as const;

export const GENEROS_PESSOA = ['Female', 'Male', 'Androgynous'] as const;

export const ESTILOS_CABELO = [
  'Short', 'Long', 'Curly', 'Straight', 'Wavy', 'Bald', 'Ponytail', 'Braided', 'Bun', 'Spiky', 'Undercut',
] as const;

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

export const CORES_OLHO = ['Blue', 'Green', 'Brown', 'Hazel', 'Gray', 'Amber', 'Violet'] as const;

/** Arquétipo visual — vocabulário **novo**, exclusivo deste schema, sem
 * relação com `species_class` (mecânica de jogo, não existe em
 * `portrait.json` hoje — ver `ssm_species_classes.txt`/`ssm_portrait_sets.txt`
 * se algum dia precisar existir). Categoria ampla e reaproveitável entre
 * espécies (ex.: `Human` cobre `ssm_default`, `ssm_knight`, `ssm_astral` e
 * `ssm_mercenary`, todas visualmente bem diferentes entre si) — a
 * diferenciação visual entre espécies que compartilham o mesmo `value` é
 * responsabilidade do campo `description` de `Tipo`, não deste enum.
 * Levantamento completo das 18 espécies do pacote em
 * `generate-art-migracao-schema-proprio.md`. */
export const TIPOS = [
  'Human', 'Elf', 'Mermaid', 'Necroid', 'Furry', 'Molluscoid', 'Eldritch', 'Robot', 'Avian', 'Alien', 'Cyborg',
] as const;

/** Rig de retrato compartilhado (`gfx/models/portraits/<rig>/`) — ver
 * `RIGS`/`RigInfo` em `generate-portraits/types.ts` pro que cada um significa
 * (canvas, guia de enquadramento). Fonte de verdade do *valor* aceito mora
 * aqui; o que cada valor *implica* (canvas, geometria) mora em
 * `generate-portraits`, que não é usado pelo schema. */
export const RIGS_VALIDOS = ['sl_shared', 'ssm_shared'] as const;
export type RigId = (typeof RIGS_VALIDOS)[number];

/** Ver `ModoEnquadramento` em `generate-portraits/types.ts`. */
export const MODOS_ENQUADRAMENTO = ['largura', 'altura'] as const;

/** Ver `AncoraVertical` em `generate-portraits/types.ts`. */
export const ANCORAS_VERTICAIS = ['conteudo', 'cabeca'] as const;

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
