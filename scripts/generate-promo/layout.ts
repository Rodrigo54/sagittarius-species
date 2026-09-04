/** Geometria da imagem de divulgação — todos os números em pixels do canvas
 * final (1920×1080). Nenhum destes valores veio da entrevista pixel a pixel;
 * são o "como" de um "o quê" já combinado (painel de texto à esquerda com
 * degradê, pódio de 3 personagens à direita) e ficam aqui, isolados,
 * exatamente para serem reajustados depois da validação visual
 * (`bun run promo`) sem mexer em `composicao.ts`. */

export const CANVAS = { largura: 1920, altura: 1080 };

/** Grade de 12 colunas no eixo X do canvas inteiro: 4 colunas pro painel de
 * texto (encostado na borda esquerda), 1 coluna de respiro, 6 colunas pra
 * zona dos personagens, e 1 coluna de margem na borda direita. Cada retrato
 * do pódio ocupa exatamente 2 dessas colunas. */
const GRID_COLUNAS = 12;
const LARGURA_COLUNA = CANVAS.largura / GRID_COLUNAS;
const COLUNAS_TEXTO = 4;
const COLUNAS_RESPIRO = 1;
const COLUNAS_RETRATOS = 6;
const COLUNAS_MARGEM_DIREITA = 1;
const COLUNAS_POR_RETRATO = 2;

/** Painel de texto: as 4 colunas da borda esquerda da grade, sem margem
 * antes dela — só o respiro fica entre o texto e os personagens. */
export const PAINEL = {
  largura: COLUNAS_TEXTO * LARGURA_COLUNA,
  margemEsquerda: 90,
  margemDireita: 70,
  topoTitulo: 130,
  alturaTitulo: 140,
  tamanhoTitulo: 52,
  espacoAntesLore: 40,
  tamanhoLore: 27,
  margemInferior: 100,
};

/** Largura do degradê (maior que o painel de texto — a transição continua
 * suavemente até perto da zona dos personagens, em vez de terminar num corte
 * seco na borda do texto). */
export const LARGURA_DEGRADE = 950;

/** Zona onde os 3 personagens são posicionados: as 6 colunas depois do
 * painel de texto + o respiro, até a margem direita da grade. */
export const ZONA_PERSONAGENS = {
  xMin: (COLUNAS_TEXTO + COLUNAS_RESPIRO) * LARGURA_COLUNA,
  xMax: CANVAS.largura - COLUNAS_MARGEM_DIREITA * LARGURA_COLUNA,
};

/** Altura do personagem em 1º lugar (o maior); os demais escalam a partir
 * daqui. Mesma regra do pipeline principal de portraits
 * (`scripts/generate-portraits/framing.ts`): a arte sempre alcança a borda
 * inferior do canvas, sem gap — "nunca flutuando". Como os 3 compartilham
 * essa borda como linha de base, ficam todos "de pé no mesmo chão". */
export const ALTURA_BASE_PERSONAGEM = 980;

export type Colocacao = 1 | 2 | 3;

interface RankInfo {
  colocacao: Colocacao;
  /** Escala da altura em relação a `ALTURA_BASE_PERSONAGEM` — decresce com a
   * colocação (1º maior, 3º menor), formato pódio. */
  escala: number;
  /** Centro horizontal do personagem, em fração de `ZONA_PERSONAGENS`. */
  centroXFracaoDaZona: number;
}

/** 6 colunas ÷ 2 colunas por retrato = 3 encaixes iguais dentro da zona. O
 * centro do encaixe de índice `i` (0 = mais à esquerda) cai em `(2i+1)/6` da
 * zona — a mesma conta de sempre pra achar o meio de 3 fatias iguais. */
const ENCAIXES_DE_RETRATO = COLUNAS_RETRATOS / COLUNAS_POR_RETRATO;
function centroDoEncaixe(indice: number): number {
  return (2 * indice + 1) / (2 * ENCAIXES_DE_RETRATO);
}

/** Ordem visual esquerda→direita é 2º-1º-3º — o pódio olímpico clássico
 * (prata à esquerda, ouro ao centro, bronze à direita): o 1º lugar fica
 * centralizado na zona (maior, foco da composição). */
export const RANKS: RankInfo[] = [
  { colocacao: 2, escala: 0.97, centroXFracaoDaZona: centroDoEncaixe(0) },
  { colocacao: 1, escala: 1.0, centroXFracaoDaZona: centroDoEncaixe(1) },
  { colocacao: 3, escala: 0.95, centroXFracaoDaZona: centroDoEncaixe(2) },
];

/** Ordem de composição, trás→frente: o 1º lugar é sempre desenhado por
 * último, para ficar por cima de quem estiver adjacente na cascata — ele é o
 * maior e o mais centralizado, o foco visual da composição. */
export const ORDEM_DE_DESENHO: Colocacao[] = [3, 2, 1];

export function rankDe(colocacao: Colocacao): RankInfo {
  const rank = RANKS.find((r) => r.colocacao === colocacao);
  if (rank === undefined) throw new Error(`colocação de pódio inválida: ${colocacao}`);
  return rank;
}

/** Override por espécie (campo `escalas` de species-promo.json): a escala
 * padrão de `RANKS` é calibrada visualmente numa única espécie e não cabe bem
 * em todas — a proporção do recorte de cada variante varia. Chave ausente
 * cai na escala padrão daquela colocação. */
export type EscalasOverride = Partial<Record<Colocacao, number>>;

export function rankEfetivo(colocacao: Colocacao, override: EscalasOverride | undefined): RankInfo {
  const rank = rankDe(colocacao);
  const escala = override?.[colocacao];
  return escala === undefined ? rank : { ...rank, escala };
}
