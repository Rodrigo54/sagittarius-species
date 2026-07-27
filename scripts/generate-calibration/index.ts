/**
 * Gera a arte de calibração legível por máquina do rig `ssm_shared`.
 *
 * Para que serve: o corte superior do quadro de retrato só é conhecido em
 * coordenadas do **sprite** (ver `scripts/measure-framing/`). Converter isso
 * para coordenadas do **canvas de textura** exige uma âncora empírica — e é
 * ela que estas imagens fornecem, ao pintar a coordenada dentro da própria cor
 * de cada faixa.
 *
 * São **duas** imagens, uma por eixo, em vez de uma que codifique ambos: um
 * único esquema teria de reservar bits para dizer "esta faixa é X ou Y", o que
 * custa metade dos níveis disponíveis e torna a decodificação frágil
 * justamente onde ela já é hostilizada pela compressão e pela redução de
 * escala. Duas imagens simples valem mais que uma engenhosa.
 *
 * Ambas são **opacas de borda a borda** de propósito: borda transparente não
 * revelaria onde o quadro corta.
 *
 *   bun scripts/generate-calibration/index.ts
 */

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PASTA_ASSETS } from '../converter';
import { RIGS } from '../generate-portraits/types';
import { CANTOS, MARCADOR, MAX_INDICE, codificar } from './encoding';
import { codificarPng, criarImagem, pintarRetangulo, type Imagem } from './png';

/** Altura (ou largura) de cada faixa, em pixels de canvas.
 *
 * É o compromisso central da arte: faixas finas medem com mais precisão, mas
 * desaparecem quando a UI desenha o retrato a 19% do tamanho. 8 px de canvas
 * dão cerca de 3 px de tela no contexto de calibração (escala 1,0), o que
 * sobrevive à redução — e a precisão resultante (±8 px de canvas) é bem mais
 * fina que o espaçamento de ~98 px entre linhas da grade do mesh, que é o que
 * a decisão de corte precisa distinguir. */
const FAIXA = 8;

/** Marcadores de canto: flagram espelhamento e rotação, e a ausência deles
 * mede o corte de forma independente da cor. */
const CANTO = 32;

/** A cada 100 px, um pip branco na borda — conferência humana, e âncora que
 * sobrevive mesmo se a UI tintar o retrato a ponto de inviabilizar a cor. */
const PASSO_MARCADOR = 100;
const PIP = 10;

export function gerarCalibracao(
  largura: number,
  altura: number,
  eixo: 'x' | 'y'
): Imagem {
  const img = criarImagem(largura, altura);
  const extensao = eixo === 'y' ? altura : largura;
  const faixas = Math.ceil(extensao / FAIXA);

  if (faixas > MAX_INDICE) {
    throw new Error(
      `${faixas} faixas de ${FAIXA}px em ${extensao}px excedem os ${MAX_INDICE} índices codificáveis`
    );
  }

  for (let indice = 0; indice < faixas; indice++) {
    const cor = codificar(indice);
    const inicio = indice * FAIXA;
    if (eixo === 'y') {
      pintarRetangulo(img, 0, inicio, largura, Math.min(FAIXA, altura - inicio), cor);
    } else {
      pintarRetangulo(img, inicio, 0, Math.min(FAIXA, largura - inicio), altura, cor);
    }
  }

  // Pips de 100 em 100, encostados nas duas bordas transversais ao eixo, para
  // não cobrir a faixa inteira e continuarem legíveis por código.
  for (let p = 0; p < extensao; p += PASSO_MARCADOR) {
    if (eixo === 'y') {
      pintarRetangulo(img, 0, p, PIP, 2, MARCADOR);
      pintarRetangulo(img, largura - PIP, p, PIP, 2, MARCADOR);
    } else {
      pintarRetangulo(img, p, 0, 2, PIP, MARCADOR);
      pintarRetangulo(img, p, altura - PIP, 2, PIP, MARCADOR);
    }
  }

  pintarRetangulo(img, 0, 0, CANTO, CANTO, CANTOS.superiorEsquerdo);
  pintarRetangulo(img, largura - CANTO, 0, CANTO, CANTO, CANTOS.superiorDireito);
  pintarRetangulo(img, 0, altura - CANTO, CANTO, CANTO, CANTOS.inferiorEsquerdo);
  pintarRetangulo(img, largura - CANTO, altura - CANTO, CANTO, CANTO, CANTOS.inferiorDireito);

  return img;
}

async function main() {
  const { canvas } = RIGS.ssm_shared;

  for (const eixo of ['y', 'x'] as const) {
    const img = gerarCalibracao(canvas.largura, canvas.altura, eixo);
    // Solto na raiz de assets/portraits/: o pipeline lista só diretórios
    // `ssm_*`, então arquivos aqui são ignorados pela geração.
    const destino = join(PASTA_ASSETS, 'portraits', `ssm_shared_calibracao_${eixo}.png`);
    await writeFile(destino, codificarPng(img));
    const faixas = Math.ceil((eixo === 'y' ? canvas.altura : canvas.largura) / FAIXA);
    console.log(`${destino}  ${canvas.largura}x${canvas.altura}  ${faixas} faixas de ${FAIXA}px`);
  }
}

if (import.meta.main) main();
