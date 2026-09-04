/** Geometria da imagem de divulgação. O eixo X segue uma grade de 12 colunas
 * e o eixo Y uma grade de 12 linhas, ambas do canvas inteiro (1920×1080) —
 * `GRID` é literalmente a grade CSS (`grid-column`/`grid-row`) usada pelo
 * template HTML; `ZONA_PERSONAGENS`/`RANKS` continuam derivados das mesmas
 * colunas, mas resolvidos aqui em px porque os personagens são posicionados
 * livremente (não encaixados em células inteiras) dentro da zona. Isolado de
 * `template.ts`/`composicao.ts` exatamente para serem reajustados depois da
 * validação visual (`bun run promo`) sem mexer em como o HTML é montado. */

export const CANVAS = { largura: 1920, altura: 1080 };

const GRID_COLUNAS = 12;
const GRID_LINHAS = 12;
const LARGURA_COLUNA = CANVAS.largura / GRID_COLUNAS;
const ALTURA_LINHA = CANVAS.altura / GRID_LINHAS;

/** Uma faixa de linhas de grid CSS: 1-based, `fim` exclusivo (mesma
 * convenção de `grid-column`/`grid-row`). */
interface FaixaGrid {
  inicio: number;
  fim: number;
}

function paraCss(faixa: FaixaGrid): string {
  return `${faixa.inicio} / ${faixa.fim}`;
}

/** Um bloco de texto: a faixa em CSS (pro template) e a mesma faixa já
 * resolvida em px (pra calibração de font-size, que mede contra o motor real
 * de renderização, não pode divergir do que o CSS realmente ocupa). */
function resolverBloco(coluna: FaixaGrid, linha: FaixaGrid) {
  return {
    colunaCss: paraCss(coluna),
    linhaCss: paraCss(linha),
    larguraPx: (coluna.fim - coluna.inicio) * LARGURA_COLUNA,
    alturaPx: (linha.fim - linha.inicio) * ALTURA_LINHA,
  };
}

/** Blocos de texto em coordenadas de grid CSS. Eixo Y: 1 linha de margem
 * superior → 2 linhas de título → 1 linha de subtítulo → 1 linha de
 * espaçamento → 6 linhas de lore → 1 linha de margem inferior (12 no
 * total). Eixo X: todo bloco compartilha a coluna 1 como margem esquerda;
 * a largura de conteúdo decresce do título (banner cheio, estica por cima da
 * zona dos personagens) pro lore (só a coluna de texto tradicional). */
export const GRID = {
  colunas: GRID_COLUNAS,
  linhas: GRID_LINHAS,
  titulo: resolverBloco({ inicio: 2, fim: 12 }, { inicio: 2, fim: 4 }),
  subtitulo: resolverBloco({ inicio: 2, fim: 8 }, { inicio: 4, fim: 5 }),
  lore: resolverBloco({ inicio: 2, fim: 6 }, { inicio: 6, fim: 12 }),
};

/** Largura do degradê (maior que o bloco de lore — a transição continua
 * suavemente até perto da zona dos personagens, em vez de terminar num corte
 * seco na borda do texto). */
export const LARGURA_DEGRADE = 950;

/** Zona onde os 3 personagens são posicionados: as 6 colunas depois da
 * margem esquerda + o respiro (colunas 6-11), até a margem direita da
 * grade — mesmas colunas de sempre, independentes da largura de cada bloco
 * de texto (o título, banner cheio, passa por cima delas na vertical). */
export const ZONA_PERSONAGENS = {
  xMin: 5 * LARGURA_COLUNA,
  xMax: CANVAS.largura - 1 * LARGURA_COLUNA,
};

/** Altura do personagem em 1º lugar (o maior); os demais escalam a partir
 * daqui. Mesma regra do pipeline principal de portraits
 * (`scripts/generate-portraits/framing.ts`): a arte sempre alcança a borda
 * inferior do canvas, sem gap — "nunca flutuando". 8 das 12 linhas da grade
 * (as linhas 5-12, a metade inferior do canvas): deixa as 4 linhas do topo
 * livres para o banner de título não colidir com as cabeças. */
export const ALTURA_BASE_PERSONAGEM = 8 * ALTURA_LINHA;

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
const COLUNAS_RETRATOS = 6;
const COLUNAS_POR_RETRATO = 2;
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
