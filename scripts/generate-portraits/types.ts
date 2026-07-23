/** Qual rig compartilhado (`gfx/models/portraits/<rig>/`) a espécie usa.
 * `sl_shared` é o rig original do Stellar Legion Mod (UV desperdiça metade
 * do canvas — ver future-plans.md); `ssm_shared` é o fork com a UV
 * corrigida, usado só por espécies novas (nenhuma das publicadas usa). */
export type RigId = 'sl_shared' | 'ssm_shared';

export interface RigInfo {
  /** Nome da entity registrada em `_humanoid_portrait_entities.asset`. */
  entity: string;
  /** Dimensões esperadas do PNG de `character_textures` para este rig. */
  largura: number;
  altura: number;
}

export const RIG_PADRAO: RigId = 'sl_shared';

export const RIGS: Record<RigId, RigInfo> = {
  sl_shared: { entity: 'sl_humanoid_01_entity', largura: 825, altura: 1650 },
  ssm_shared: { entity: 'ssm_humanoid_01_entity', largura: 980, altura: 976 },
};

export interface PortraitConfig {
  name: string;
  gendered: boolean;
  /** Omitido = `sl_shared` (comportamento atual, nenhuma espécie publicada
   * precisa declarar isso). Só espécies novas que usam o rig corrigido
   * declaram `"rig": "ssm_shared"` explicitamente. */
  rig?: RigId;
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
