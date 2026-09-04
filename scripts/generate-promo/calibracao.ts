// O projeto compila sem lib DOM (scripts/tsconfig.json — código Bun
// server-side); esta referência traz `document` só pro corpo das funções que
// o Playwright serializa e roda dentro do browser (`page.evaluate`).
/// <reference lib="dom" />

/** Acha o maior font-size que ainda cabe, sem estourar, em cada bloco de
 * texto — medido contra o pior caso real (todas as 19 espécies do config,
 * não uma aproximação por comprimento de string) e contra o motor real de
 * renderização (o mesmo Chromium/Edge que depois tira o screenshot), pra
 * calibração e resultado final nunca divergirem. Roda uma única vez, sobre o
 * config inteiro — inclusive quando `bun run promo <slug>` filtra uma
 * espécie só — porque o font-size é global: cada imagem calibrada isoladamente
 * ficaria com um tamanho de texto diferente das outras, quebrando a
 * identidade visual entre as 19. */

import type { Page } from 'playwright';
import type { SpeciesPromoFile } from '../promo-schema';
import { GRID } from './layout';

export interface FontesCalibradas {
  tituloPx: number;
  subtituloPx: number;
  lorePx: number;
}

/** Família/peso/entrelinha de cada bloco — os mesmos valores usados depois
 * em `template.ts` pra montar o CSS de verdade. */
export const ESTILO_TITULO = { fontWeight: '700', lineHeight: 1.15 };
export const ESTILO_SUBTITULO = { fontWeight: '400', lineHeight: 1.25 };
export const ESTILO_LORE = { fontWeight: '400', lineHeight: 1.45 };

const MIN_PX = 16;
const MAX_PX = 140;

interface EspecificacaoBloco {
  larguraPx: number;
  alturaPx: number;
  fontFamily: string;
  fontWeight: string;
  lineHeight: number;
}

/** Busca binária no maior font-size comum que ainda cabe pra TODOS os
 * textos informados, medindo com um `<div>` fora de tela na própria página
 * (que já precisa ter as `@font-face` carregadas — ver `calibrar`). */
async function maiorFontSizeQueCabe(
  page: Page,
  textos: string[],
  spec: EspecificacaoBloco
): Promise<number> {
  let lo = MIN_PX;
  let hi = MAX_PX;
  let melhor = MIN_PX;

  while (lo <= hi) {
    const meio = Math.floor((lo + hi) / 2);
    const estoura = await page.evaluate(
      ({ textos, spec, meio }) => {
        return textos.some((texto) => {
          const div = document.createElement('div');
          div.style.position = 'absolute';
          div.style.visibility = 'hidden';
          div.style.width = `${spec.larguraPx}px`;
          div.style.fontFamily = spec.fontFamily;
          div.style.fontWeight = spec.fontWeight;
          div.style.fontSize = `${meio}px`;
          div.style.lineHeight = String(spec.lineHeight);
          div.textContent = texto;
          document.body.appendChild(div);
          const estourou = div.scrollHeight > spec.alturaPx;
          document.body.removeChild(div);
          return estourou;
        });
      },
      { textos, spec, meio }
    );
    if (estoura) {
      hi = meio - 1;
    } else {
      melhor = meio;
      lo = meio + 1;
    }
  }

  return melhor;
}

/** `page` precisa já ter `document.fonts.ready` resolvido — ver
 * `carregarPaginaDeCalibracao` em `composicao.ts`. */
export async function calibrar(
  page: Page,
  config: SpeciesPromoFile,
  fontFamilyTitulo: string,
  fontFamilyCorpo: string
): Promise<FontesCalibradas> {
  const especies = Object.values(config);

  const tituloPx = await maiorFontSizeQueCabe(
    page,
    especies.map((e) => e.titulo),
    { larguraPx: GRID.titulo.larguraPx, alturaPx: GRID.titulo.alturaPx, fontFamily: fontFamilyTitulo, ...ESTILO_TITULO }
  );
  const subtituloPx = await maiorFontSizeQueCabe(
    page,
    especies.map((e) => e.subtitulo),
    { larguraPx: GRID.subtitulo.larguraPx, alturaPx: GRID.subtitulo.alturaPx, fontFamily: fontFamilyCorpo, ...ESTILO_SUBTITULO }
  );
  const lorePx = await maiorFontSizeQueCabe(
    page,
    especies.map((e) => e.lore),
    { larguraPx: GRID.lore.larguraPx, alturaPx: GRID.lore.alturaPx, fontFamily: fontFamilyCorpo, ...ESTILO_LORE }
  );

  return { tituloPx, subtituloPx, lorePx };
}
