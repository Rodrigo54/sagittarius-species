import { z } from 'zod';

/** Fonte de verdade do formato de `assets/promo/species-promo.json` — schema
 * `zod`, com tipos TS inferidos no fim do arquivo. Mesmo desenho de
 * `scripts/portrait-schema/`/`scripts/name-list-schema/`: o JSON Schema
 * (`.json`) é artefato **derivado** (`gerar-json-schema.ts`), nunca editado à
 * mão, e serve o autocomplete do VS Code via `json.schemas`.
 *
 * Convenção de idioma (CLAUDE.md): chaves em inglês, `.describe(...)` em
 * português.
 *
 * O arquivo é a fonte de verdade de nome + lore usados por
 * `scripts/generate-promo/` — o mesmo texto que hoje vive em
 * `steam-workshop/description.md` (cópia editável independente dali pra
 * frente, não um parser de Markdown). Cada espécie declara explicitamente as
 * 3 variantes de personagem do pódio (sem seleção automática — a escolha de
 * quais PNGs aparecem é sempre manual); o fundo (`assets/city_sets/`)
 * continua opcional, ausente cai na escolha automática determinística. */

const GENEROS_VALIDOS = ['male', 'female', 'genderless'] as const;
const COLOCACOES_VALIDAS = ['1', '2', '3'] as const;

const CHAVE_SLUG = /^ssm_[a-z0-9_]+$/;
const CHAVE_VARIANTE = new RegExp(`^(${GENEROS_VALIDOS.join('|')})/\\d{3}$`);
const CHAVE_FUNDO = /^\d{3}$/;

const QUANTIDADE_DE_VARIANTES = 3;

const zEspeciePromo = z
  .object({
    nome: z
      .string()
      .describe('Nome de exibição da espécie — o mesmo texto em negrito usado em steam-workshop/description.md.'),
    lore: z
      .string()
      .describe('Parágrafo de lore usado no painel de texto da imagem de divulgação — cópia editável do parágrafo de description.md, não vinculada a ele.'),
    variantes: z
      .array(z.string().regex(CHAVE_VARIANTE, 'formato esperado "<gênero>/<NNN>" (ex.: "female/012")'))
      .length(
        QUANTIDADE_DE_VARIANTES,
        `precisa ter exatamente ${QUANTIDADE_DE_VARIANTES} variantes — é a quantidade fixa usada na composição.`
      )
      .describe(
        'As 3 variantes de personagem do pódio, na ordem 1º-2º-3º lugar, no formato "<gênero>/<NNN>" (ex.: ["female/012", "male/003", "female/007"]) — cada entrada precisa existir de fato em assets/portraits/<slug>/<gênero>/. Escolha sempre explícita, sem seleção automática.'
      ),
    fundo: z
      .string()
      .regex(CHAVE_FUNDO, 'formato esperado "NNN" (ex.: "037"), o número de NNN_room.png')
      .optional()
      .describe(
        'Override manual do fundo — o NNN de NNN_room.png em assets/city_sets/. Ausente = escolha automática e determinística por hash do slug.'
      ),
    escalas: z
      .partialRecord(z.enum(COLOCACOES_VALIDAS), z.number().positive())
      .optional()
      .describe(
        'Override manual de escala por colocação no pódio ("1" a "3", 1 = maior/destaque) — a proporção do recorte varia por variante, e a escala padrão (definida em scripts/generate-promo/layout.ts) pode não caber bem em todas as espécies. Chave ausente = usa a escala padrão daquela colocação; objeto todo ausente = usa a escala padrão em todas.'
      ),
  })
  .strict();

export const zSpeciesPromoFile = z
  .record(z.string().regex(CHAVE_SLUG, 'chave precisa ser um slug ssm_<especie>'), zEspeciePromo)
  .describe('Formato completo de assets/promo/species-promo.json — uma entrada por espécie, chave = slug ssm_<especie>.');

export type EspeciePromo = z.infer<typeof zEspeciePromo>;
export type SpeciesPromoFile = z.infer<typeof zSpeciesPromoFile>;
export type GeneroPromo = (typeof GENEROS_VALIDOS)[number];
