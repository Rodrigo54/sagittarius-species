export interface PortraitConfig {
  name: string;
  gendered: boolean;
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
