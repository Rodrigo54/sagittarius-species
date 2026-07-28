/**
 * Lê os screenshots de calibração e resolve a relação entre **coordenadas do
 * sprite** (que `index.ts` deriva dos `.gui`) e **coordenadas do canvas de
 * textura** (onde a arte é pintada).
 *
 * É a única etapa que precisa do jogo, e existe porque nada nos arquivos diz
 * qual pedaço do canvas a câmera de retrato captura.
 *
 * ## Como a calibração é localizada
 *
 * Não por cor: a tolerância que o BC3 exige é larga o bastante para que ~58%
 * dos pixels de uma tela qualquer do jogo decodifiquem por acaso. O que
 * distingue a calibração é a **linearidade** — só nela o índice cresce de
 * forma monótona e constante ao longo de dezenas de pixels. É exatamente a
 * defesa prevista no desenho da codificação.
 *
 * ## Como o resultado é validado
 *
 * Duas medidas (topo e base de um contexto) bastam para resolver os dois
 * parâmetros da reta, então bater nesse contexto não prova nada. A validação
 * vem de contextos que **não** entraram no ajuste: a altura que cada região
 * deveria ter na tela, e o canvas visível em contextos de outra escala.
 *
 *   bun scripts/measure-framing/medir-prints.ts <pasta-com-prints>
 */

import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { decodificar } from '../generate-calibration/encoding';
import { decodificarPng, lerPixel, type Imagem } from '../png';

/** Altura de cada faixa da arte de calibração, em pixels de canvas. */
const FAIXA = 8;

export interface Regiao {
  /** Extensão na tela, no eixo medido. */
  tela0: number;
  tela1: number;
  /** Coordenada de canvas nas duas pontas. */
  canvas0: number;
  canvas1: number;
  /** Extensão na tela no eixo transversal (largura, para o eixo Y). */
  transversal0: number;
  transversal1: number;
  /** Pixels de canvas por pixel de tela. */
  escala: number;
}

interface Run {
  p0: number;
  p1: number;
  i0: number;
  i1: number;
}

/** Maior trecho em que o índice decodificado é não-decrescente e sobe devagar.
 * Ruído da UI não sustenta essa condição por muitos pixels seguidos. */
function melhorRun(amostras: { p: number; idx: number }[], minPontos: number, minExtensao: number): Run | null {
  let melhor: Run | null = null;
  let i = 0;

  while (i < amostras.length) {
    let j = i;
    while (j + 1 < amostras.length) {
      const a = amostras[j];
      const b = amostras[j + 1];
      if (b.p - a.p > 6) break; // buraco: o trecho acabou
      if (b.idx < a.idx) break; // tem que crescer
      if (b.idx - a.idx > 4) break; // salto grande não é a calibração
      j++;
    }

    if (
      j - i + 1 >= minPontos &&
      amostras[j].p - amostras[i].p >= minExtensao &&
      amostras[j].idx > amostras[i].idx
    ) {
      const run = { p0: amostras[i].p, p1: amostras[j].p, i0: amostras[i].idx, i1: amostras[j].idx };
      if (!melhor || run.p1 - run.p0 > melhor.p1 - melhor.p0) melhor = run;
    }
    i = j + 1;
  }

  return melhor;
}

const mediana = (valores: number[]) => {
  const v = [...valores].sort((a, b) => a - b);
  return v[Math.floor(v.length / 2)];
};

/** Acha as regiões de calibração de um eixo, agrupando linhas/colunas vizinhas
 * com geometria parecida. */
export function acharRegioes(img: Imagem, eixo: 'y' | 'x'): Regiao[] {
  const nLinhas = eixo === 'y' ? img.largura : img.altura;
  const nPontos = eixo === 'y' ? img.altura : img.largura;

  const porLinha = new Map<number, Run>();
  for (let l = 0; l < nLinhas; l++) {
    const amostras: { p: number; idx: number }[] = [];
    for (let p = 0; p < nPontos; p++) {
      const px = eixo === 'y' ? lerPixel(img, l, p) : lerPixel(img, p, l);
      if (px.a < 250) continue;
      const idx = decodificar(px);
      if (idx !== null) amostras.push({ p, idx });
    }
    const run = melhorRun(amostras, 25, 50);
    if (run) porLinha.set(l, run);
  }

  const linhas = [...porLinha.keys()].sort((a, b) => a - b);
  const grupos: { linhas: number[]; runs: Run[] }[] = [];
  for (const l of linhas) {
    const run = porLinha.get(l)!;
    const g = grupos[grupos.length - 1];
    const anterior = g ? g.runs[g.runs.length - 1] : null;
    const contiguo = g && l - g.linhas[g.linhas.length - 1] <= 3;
    const parecido =
      anterior && Math.abs(run.p0 - anterior.p0) < 25 && Math.abs(run.p1 - anterior.p1) < 25;
    if (contiguo && parecido) {
      g.linhas.push(l);
      g.runs.push(run);
    } else {
      grupos.push({ linhas: [l], runs: [run] });
    }
  }

  return grupos
    .filter((g) => g.linhas.length >= 15)
    .map((g) => {
      const tela0 = mediana(g.runs.map((r) => r.p0));
      const tela1 = mediana(g.runs.map((r) => r.p1));
      const canvas0 = mediana(g.runs.map((r) => r.i0)) * FAIXA;
      const canvas1 = mediana(g.runs.map((r) => r.i1)) * FAIXA;
      return {
        tela0,
        tela1,
        canvas0,
        canvas1,
        transversal0: g.linhas[0],
        transversal1: g.linhas[g.linhas.length - 1],
        escala: (canvas1 - canvas0) / (tela1 - tela0),
      };
    })
    .sort((a, b) => b.transversal1 - b.transversal0 - (a.transversal1 - a.transversal0));
}

async function main() {
  const pasta = process.argv[2];
  if (!pasta) throw new Error('uso: bun scripts/measure-framing/medir-prints.ts <pasta-com-prints>');

  const arquivos = (await readdir(pasta)).filter((f) => f.toLowerCase().endsWith('.png')).sort();
  if (arquivos.length === 0) throw new Error(`nenhum .png em ${pasta}`);

  for (const arquivo of arquivos) {
    const img = decodificarPng(await readFile(join(pasta, arquivo)));
    console.log(`\n=== ${basename(arquivo)} (${img.largura}x${img.altura}) ===`);

    for (const eixo of ['y', 'x'] as const) {
      const regioes = acharRegioes(img, eixo);
      if (regioes.length === 0) {
        console.log(`  eixo ${eixo}: nenhuma região`);
        continue;
      }
      console.log(`  eixo ${eixo}: ${regioes.length} região(ões)`);
      for (const r of regioes) {
        const espessura = r.transversal1 - r.transversal0 + 1;
        console.log(
          `    ${eixo === 'y' ? 'x' : 'y'} ${r.transversal0}..${r.transversal1} (${espessura}px) | ` +
            `tela ${r.tela0}..${r.tela1} (${r.tela1 - r.tela0}px) | ` +
            `canvas ${r.canvas0}..${r.canvas1} | ${r.escala.toFixed(3)} px canvas por px tela`
        );
      }
    }
  }
}

if (import.meta.main) main();
