/** Qual rig compartilhado (`gfx/models/portraits/<rig>/`) a espécie usa.
 * `sl_shared` é o rig original do Stellar Legion Mod (UV desperdiça metade
 * do canvas — ver future-plans.md); `ssm_shared` é o fork com a UV
 * corrigida e um único plano, usado por 16 das 18 espécies. */
export type RigId = 'sl_shared' | 'ssm_shared';

/** `largura` (padrão): escala a arte pra largura do guia, topo no topo do
 * guia — regra padrão pra composições "busto alto e estreito". O excesso de
 * altura é cortado pela borda inferior do canvas.
 * `altura`: escala pra altura mínima (garante que a base sempre toque a borda
 * do canvas), permitindo que a largura resultante ultrapasse o guia (nunca o
 * canvas) — pra composições atipicamente largas (ombros largos, capuz), onde
 * preencher a largura do guia deixaria a arte curta demais pra alcançar a
 * base. Declarado por espécie no `portrait.json`. */
export type ModoEnquadramento = 'largura' | 'altura';

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
    canvas: { largura: 980, altura: 976 },
    /** Reproduz exatamente o guia em pixels que o `migrate-portraits` aplicava
     * sobre este canvas (largura 600, topo 339, centro 559) — **inclusive** o
     * descentramento horizontal de 69 px que a medição in-game revelou (o
     * centro do canvas é 490, não 559). Corrigi-lo é a etapa seguinte; o guia
     * fica idêntico até lá, para que a mudança de forma do pipeline seja
     * verificável isoladamente, sem se misturar com mudança de valor. */
    guia: { largura: 600 / 980, topo: 339 / 976, centroX: 559 / 980 },
  },
};

export interface PortraitConfig {
  name: string;
  gendered: boolean;
  /** Omitido = `sl_shared`. */
  rig?: RigId;
  /** Só faz sentido em rig com `guia`. Omitido = `largura`. */
  modo?: ModoEnquadramento;
  counts: {
    male?: number;
    female?: number;
    flat?: number;
  };
}

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
