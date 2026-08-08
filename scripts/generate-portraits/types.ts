import type { PortraitConfig, RigId } from '../portrait-schema';

export type { PortraitConfig, RigId };

/** `sl_shared` é o rig original do Stellar Legion Mod (UV desperdiça metade
 * do canvas — ver future-plans.md); `ssm_shared` é o fork com a UV
 * corrigida e um único plano, usado por 16 das 18 espécies. O *valor* aceito
 * (`RigId`) vem de `portrait-schema` — fonte de verdade única de "quais
 * strings são um rig válido"; o que cada valor *significa* em termos de
 * canvas/geometria é definido aqui embaixo, em `RIGS`. */

/** `largura` (padrão): escala a arte pra largura do guia, topo no topo do
 * guia — regra padrão pra composições "busto alto e estreito". O excesso de
 * altura é cortado pela borda inferior do canvas.
 * `altura`: escala pra altura mínima (garante que a base sempre toque a borda
 * do canvas), permitindo que a largura resultante ultrapasse o guia (nunca o
 * canvas) — pra composições atipicamente largas (ombros largos, capuz), onde
 * preencher a largura do guia deixaria a arte curta demais pra alcançar a
 * base. Declarado por espécie no `portrait.json`. Valor aceito também vem de
 * `portrait-schema` (`MODOS_ENQUADRAMENTO`); o tipo aqui é só pra manter o
 * nome em português já usado neste arquivo. */
export type ModoEnquadramento = NonNullable<PortraitConfig['modo']>;

/** O que encosta no topo do guia.
 *
 * `conteudo` (padrão): o topo do bounding box da arte.
 *
 * `cabeca`: a primeira linha em que a silhueta fica **sólida**, ignorando o
 * que houver de fino e esparso acima dela. Existe para composições com
 * chifres, antenas ou penachos: ancorando pelo bounding box, esses ornamentos
 * empurram a cabeça para baixo e o personagem sai menor que o das outras
 * espécies. Com `cabeca`, o ornamento sobe para a faixa acima do guia — que
 * é visível em parte dos contextos de UI e cortada nos mais agressivos (ver
 * "Enquadramento" no CLAUDE.md), ou seja, exatamente onde elementos
 * sacrificáveis devem ficar.
 *
 * Não é o padrão porque nem toda estrutura fina é sacrificável: metade das
 * espécies tem alguma, e em algumas (tentáculos, por exemplo) ela é a
 * característica da espécie. A escolha é por espécie, com julgamento visual. */
export type AncoraVertical = NonNullable<PortraitConfig['ancora']>;

/** Enquadramento-alvo dentro do canvas do rig, expresso em **fração do
 * canvas** — é isso que faz o canvas ser uma constante trocável: mudar a
 * resolução da textura não exige recalibrar o guia. */
export interface GuiaEnquadramento {
  /** Largura da arte, em fração da largura do canvas (usado no modo `largura`). */
  largura: number;
  /** Topo da arte, em fração da altura do canvas. */
  topo: number;
  /** Centro horizontal da arte, em fração da largura do canvas. */
  centroX: number;
}

export interface RigInfo {
  /** Nome da entity registrada em `_humanoid_portrait_entities.asset`. */
  entity: string;
  /** Canvas de `character_textures` deste rig. */
  canvas: { largura: number; altura: number };
  /** Presente = a arte em `assets/portraits/` é **master nativo** e o
   * enquadramento é derivado aqui, a cada `bun run portrait`.
   * Ausente = contrato legado: o PNG em `assets/` já vem enquadrado, no
   * canvas exato, e é usado como está. */
  guia?: GuiaEnquadramento;
}

export const RIG_PADRAO: RigId = 'sl_shared';

export const RIGS: Record<RigId, RigInfo> = {
  /** Legado congelado: as duas espécies que restaram aqui (`ssm_mermaids`,
   * `ssm_astral`) foram revertidas na preparação da 1.8.0 e o enquadramento
   * delas é a composição original, herdada — não vem de guia nenhum. Sem
   * `guia`, o pipeline as trata pelo contrato antigo e não as recompõe. */
  sl_shared: {
    entity: 'sl_humanoid_01_entity',
    canvas: { largura: 825, altura: 1650 },
  },
  ssm_shared: {
    entity: 'ssm_humanoid_01_entity',
    /** O canvas cobre o plano **já recortado** por `recortarPlanoAcima`
     * (`scripts/generate-shared-rig/mesh-uv.ts`), que remove do topo a faixa
     * que a câmera de retrato nunca captura — 195 dos 976 px do canvas
     * anterior.
     *
     * A altura preserva a densidade de antes (nenhum pixel a mais ou a menos
     * por unidade de mesh): `976 − 195 = 781`. O valor usado é 780 porque o
     * BC3 comprime em blocos de 4×4 e exige dimensões múltiplas de 4; o 0,13%
     * de diferença fica bem abaixo do ruído da própria medição, que é 0,4%
     * (`k_x` 2,034 contra `k_y` 2,042 em `measure-framing/ancora.json`).
     *
     * Preservar a proporção é obrigatório, não estético: a projeção do canvas
     * no mesh é isotrópica, então esticar um eixo esticaria a arte.
     *
     * Este é o ponto onde a densidade sobe quando houver arte em resolução
     * maior — multiplicar ambas as dimensões pelo mesmo fator, e mais nada. */
    canvas: { largura: 980, altura: 780 },
    /** - `largura`: 600 px do canvas de 980, a mesma fração de antes — a arte
     *   não muda de tamanho relativo.
     * - `topo`: onde ficava `y_canvas 339` no canvas anterior, reexpresso no
     *   espaço recortado: `(339 − 195) / 781`. Mantém a arte exatamente na
     *   mesma posição física do mesh, que é o que faz o enquadramento in-game
     *   não mudar apesar de todo o resto ter mudado.
     * - `centroX`: **0,5**, o centro do canvas. Aqui está a correção que
     *   originou este trabalho: a arte estava centrada em 559 num canvas cujo
     *   centro é 490, porque o guia antigo fora calibrado contra o esqueleto
     *   do rig herdado em vez do plano que o jogo enquadra. */
    guia: { largura: 600 / 980, topo: (339 - 195) / 781, centroX: 0.5 },
  },
};

export interface SpeciesInfo {
  /** Nome da pasta, ex.: "ssm_astral" */
  slug: string;
  /** Caminho completo até assets/portraits/ssm_<especie> */
  pastaAssets: string;
  config: PortraitConfig;
  arquivosMale: string[];
  arquivosFemale: string[];
  arquivosFlat: string[];
}

export function rigDe(config: PortraitConfig): RigInfo {
  return RIGS[config.rig ?? RIG_PADRAO];
}
