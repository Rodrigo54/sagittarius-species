/**
 * Codificação de coordenada em cor, para medir o enquadramento do retrato a
 * partir de um screenshot — por script, sem OCR e sem leitura a olho.
 *
 * O problema que ela resolve: a arte de calibração anterior comunicava por
 * texto (`x300`, `y500`). Ler isso de volta exigiria OCR sobre texto comprimido
 * em BC3, redimensionado pela UI e renderizado em perspectiva. Aqui a
 * coordenada está na **cor** de cada faixa, então basta amostrar um pixel.
 *
 * ## As duas hostilidades do caminho até a tela
 *
 * **BC3 quantiza a cor em RGB565** (5 bits em R e B, 6 em G), errando no
 * máximo ~4 por canal. Os níveis são espaçados de 32 e centrados no bucket
 * (16, 48, 80, …), com tolerância de 12: margem de 3× sobre o erro esperado.
 * Medido: ±12 de ruído ainda decodifica 244/244 casos; ±16 quebra todos, que é
 * o comportamento desejado — degradar para "não sei" em vez de para um número
 * errado.
 *
 * **O retrato é desenhado reduzido**, em escalas de 0,19 a 1,0 sobre uma
 * textura maior que o sprite, então pixels de faixas vizinhas se misturam.
 * Aqui a medição contrariou duas vezes o desenho inicial:
 *
 * - mistura de **duas** faixas é sempre rejeitada — cai a meio caminho entre
 *   dois níveis, fora da tolerância. Isso vem da tolerância apertada, não de
 *   nenhuma esperteza na codificação;
 * - mistura de **três** faixas **nunca** é rejeitável pela cor sozinha: a média
 *   de três níveis consecutivos é exatamente um nível válido. Não há como
 *   distingui-la de uma leitura boa — só há como fazer o resultado ser o certo.
 *
 * ## Por que Gray refletido, e não base 8 direta
 *
 * O índice vira cor por um **código de Gray refletido base 8**: dígitos
 * consecutivos diferem em exatamente um nível, num único canal. Isso faz a
 * média de três faixas vizinhas cair exatamente sobre a faixa do meio — que é
 * a resposta correta. Medido sobre as 122 faixas do canvas atual:
 *
 * | codificação        | mistura de 3 exatas | desvio máx | salto de cor |
 * |--------------------|---------------------|------------|--------------|
 * | base 8 direta      | 90/120 (75%)        | 19         | 480          |
 * | **Gray refletido** | **120/120 (100%)**  | **0**      | **32**       |
 *
 * A base 8 direta erra justamente nas viradas de dígito, onde a cor salta de
 * um canto ao outro do espaço. Uma terceira variante — embaralhar os índices
 * para afastar vizinhos — foi testada e descartada: soa protetora, mas troca
 * "leu 4, esperava 7" por "leu 323, esperava 3", ou seja, erro grande,
 * plausível e indetectável.
 *
 * ## O que isso exige de quem lê
 *
 * O índice cresce linearmente com a coordenada, por construção. Uma sequência
 * de amostras tem, portanto, de ser linear — ajustar uma reta e descartar quem
 * sai dela é a defesa final contra o que a cor sozinha não denuncia.
 */

/** Níveis por canal: 8 valores espaçados de 32, centrados no bucket. */
const NIVEIS = 8;
const PASSO = 32;
const OFFSET = 16;

/** 3 canais × 3 bits = 512 índices distintos. */
export const MAX_INDICE = NIVEIS ** 3;

export interface Cor {
  r: number;
  g: number;
  b: number;
}

/** Código de Gray refletido base 8, forma canônica: cada dígito é espelhado
 * quando a soma dos dígitos **já convertidos** à sua esquerda é ímpar. Usar a
 * soma dos dígitos originais parece equivalente e não é — deixa 7 pares
 * vizinhos saltando até 8 níveis, o que reintroduz o erro que a codificação
 * existe para evitar. */
function paraGray(digitos: number[]): number[] {
  const saida: number[] = [];
  let soma = 0;
  for (const digito of digitos) {
    const valor = soma % 2 === 0 ? digito : NIVEIS - 1 - digito;
    saida.push(valor);
    soma += valor;
  }
  return saida;
}

function deGray(digitos: number[]): number[] {
  const saida: number[] = [];
  let soma = 0;
  for (const digito of digitos) {
    saida.push(soma % 2 === 0 ? digito : NIVEIS - 1 - digito);
    soma += digito;
  }
  return saida;
}

export function codificar(indice: number): Cor {
  if (!Number.isInteger(indice) || indice < 0 || indice >= MAX_INDICE) {
    throw new Error(`índice ${indice} fora de 0..${MAX_INDICE - 1}`);
  }

  const [r, g, b] = paraGray([(indice >> 6) & 7, (indice >> 3) & 7, indice & 7]);
  return { r: r * PASSO + OFFSET, g: g * PASSO + OFFSET, b: b * PASSO + OFFSET };
}

/** Tolerância por canal. Metade do passo seria o limite teórico; 12 deixa uma
 * faixa morta que rejeita cores a meio caminho entre dois níveis — a assinatura
 * de duas faixas misturadas na redução de escala. */
export const TOLERANCIA = 12;

function nivel(valor: number): number | null {
  const indice = Math.round((valor - OFFSET) / PASSO);
  if (indice < 0 || indice >= NIVEIS) return null;
  if (Math.abs(valor - (indice * PASSO + OFFSET)) > TOLERANCIA) return null;
  return indice;
}

/** Devolve o índice codificado na cor, ou `null` se a cor não for um código
 * válido — pixel misturado, tintado, ou fora da arte de calibração. */
export function decodificar(cor: Cor): number | null {
  const r = nivel(cor.r);
  const g = nivel(cor.g);
  const b = nivel(cor.b);
  if (r === null || g === null || b === null) return null;

  const [d2, d1, d0] = deGray([r, g, b]);
  return (d2 << 6) | (d1 << 3) | d0;
}

/** Cores reservadas para os marcadores de canto: puras, e por construção fora
 * da grade de níveis (que só produz valores ≡ 16 mód 32), então nunca são
 * confundidas com um código. Servem para flagrar espelhamento e rotação, e a
 * ausência delas mede o corte independentemente da cor. */
export const CANTOS = {
  superiorEsquerdo: { r: 255, g: 0, b: 0 },
  superiorDireito: { r: 0, g: 255, b: 0 },
  inferiorEsquerdo: { r: 0, g: 0, b: 255 },
  inferiorDireito: { r: 255, g: 0, b: 255 },
} as const;

/** Marcador a cada 100 px: branco puro, também fora da grade de níveis. Serve
 * de conferência humana e de âncora independente caso a UI tinja o retrato a
 * ponto de inviabilizar a leitura por cor. */
export const MARCADOR = { r: 255, g: 255, b: 255 } as const;
