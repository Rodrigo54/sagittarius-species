import type { PortraitConfig, RigId } from '../portrait-schema';

export type { PortraitConfig, RigId };

/** Contratos geométricos dos rigs de retrato compartilhados. */

/** `largura` (padrão): escala a arte pra largura do guia, topo no topo do
 * guia — regra padrão pra composições "busto alto e estreito". O excesso de
 * altura é cortado pela borda inferior do canvas, e o personagem sai do mesmo
 * tamanho em toda espécie, porque a largura é fixa.
 *
 * `altura`: escala pra altura mínima (garante que a base sempre toque a borda
 * do canvas), permitindo que a largura resultante ultrapasse o guia (nunca o
 * canvas). Dois casos pedem esse modo, e o segundo é o mais comum:
 *
 * 1. **Composição larga demais** (ombros largos, capuz, armadura): preencher a
 *    largura do guia deixaria a arte curta demais pra alcançar a base, e o
 *    busto flutuaria. Aqui `altura` é obrigatório — `largura` é erro de
 *    validação.
 * 2. **A arte tem abaixo do busto algo que precisa aparecer**: escalar pela
 *    largura joga o pedaço de baixo além da borda do canvas, onde ele nunca
 *    chega à tela. Aqui `largura` valida sem reclamar e só some com o
 *    elemento — a escolha é visual, espécie a espécie.
 *
 * O preço, no caso 2, é tamanho: a largura passa a ser derivada da proporção
 * de cada PNG, então a arte fica menor que a das espécies em `largura` e
 * **varia entre variantes da mesma espécie** conforme quanto corpo entrou no
 * enquadramento de cada uma. Não há como ter as duas coisas: a distância
 * cabeça→cintura é ~3 alturas de cabeça, e ela não cabe no canvas com a cabeça
 * no tamanho que o guia dá.
 *
 * Declarado por espécie no `portrait.json`. Valor aceito também vem de
 * `portrait-schema` (`MODOS_ENQUADRAMENTO`); o tipo aqui é só pra manter o
 * nome em português já usado neste arquivo. */
export type ModoEnquadramento = NonNullable<PortraitConfig['modo']>;

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
  /** Arte já enquadrada, sem guia para recomposição. */
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

export function rigDe(config: PortraitConfig): RigInfo {
  return RIGS[config.rig ?? RIG_PADRAO];
}
