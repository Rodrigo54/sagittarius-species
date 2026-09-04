/** Monta o HTML/CSS Grid que o Playwright renderiza — a composição final da
 * imagem de divulgação inteira. Fundo, degradê e personagens são camadas
 * absolutas sobre o canvas (1920×1080); só o texto usa `display: grid` de
 * verdade, espelhando a grade de 12×12 decidida em `layout.ts`. */

import { pathToFileURL } from 'node:url';
import { ESTILO_LORE, ESTILO_SUBTITULO, ESTILO_TITULO, type FontesCalibradas } from './calibracao';
import { CANVAS, GRID, LARGURA_DEGRADE } from './layout';
import { FONTE_CORPO, FONTE_TITULO } from './types';

function urlDeArquivo(caminho: string): string {
  return pathToFileURL(caminho).href;
}

function escaparHtml(texto: string): string {
  return texto.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** Font-size em `rem`, não `px` — a base é o `font-size: 16px` padrão do
 * `html` (não sobrescrito em lugar nenhum deste template), então `1rem` vale
 * exatamente `16px`. Os valores calibrados em `calibracao.ts` continuam em
 * px (medidos contra o motor real de renderização); só a saída no CSS final
 * converte. */
function paraRem(px: number): string {
  return `${(px / 16).toFixed(4)}rem`;
}

/** As duas `@font-face` do template — extraídas pra serem reaproveitadas
 * também pela página de calibração (`paginaDeCalibracaoHtml`), que precisa
 * das mesmas fontes carregadas antes de medir font-size, sem duplicar as
 * duas declarações em dois lugares. */
function blocoFontFace(): string {
  return `
  @font-face { font-family: 'PromoTitulo'; src: url('${urlDeArquivo(FONTE_TITULO)}'); font-weight: 700; }
  @font-face { font-family: 'PromoCorpo'; src: url('${urlDeArquivo(FONTE_CORPO)}'); font-weight: 400; }`;
}

/** HTML mínimo, sem conteúdo visível — só o bastante pra `document.fonts`
 * carregar Orbitron/Exo2 antes da calibração de font-size medir contra elas. */
export function paginaDeCalibracaoHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>${blocoFontFace()}</style>
</head>
<body></body>
</html>`;
}

/** Geometria final de um personagem no canvas (`x`/`y`/`largura`/`altura`)
 * mais o recorte CSS que reproduz o "trim + resize!" físico do ImageMagick
 * (`cropLeft`/`cropTop` = offset do trim já escalado, `cropLargura`/
 * `cropAltura` = dimensão do PNG inteiro já escalada) — ver `medirRecortes`
 * em `trim.ts` e o cálculo em `composicao.ts`. */
export interface PersonagemRenderizado {
  caminhoArquivo: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
  cropLeft: number;
  cropTop: number;
  cropLargura: number;
  cropAltura: number;
}

export interface DadosTemplate {
  fundo: string;
  titulo: string;
  subtitulo: string;
  lore: string;
  personagens: PersonagemRenderizado[];
  fontes: FontesCalibradas;
}

export function montarHtml(dados: DadosTemplate): string {
  const personagensHtml = dados.personagens
    .map(
      (p) => `
    <div style="position:absolute; left:${p.x}px; top:${p.y}px; width:${p.largura}px; height:${p.altura}px; overflow:hidden;">
      <img src="${urlDeArquivo(p.caminhoArquivo)}" style="position:absolute; left:${-p.cropLeft}px; top:${-p.cropTop}px; width:${p.cropLargura}px; height:${p.cropAltura}px; max-width:none;">
    </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>${blocoFontFace()}
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${CANVAS.largura}px; height: ${CANVAS.altura}px; }
  .canvas {
    position: relative; width: ${CANVAS.largura}px; height: ${CANVAS.altura}px;
    overflow: hidden; background: #000;
  }
  .fundo {
    position: absolute; inset: 0; width: 100%; height: 100%;
    object-fit: cover; object-position: center;
  }
  .degrade {
    position: absolute; inset: 0;
    background: linear-gradient(to right, rgba(0,0,0,1) 0px, rgba(0,0,0,0) ${LARGURA_DEGRADE}px);
  }
  .grid {
    position: absolute; inset: 0;
    display: grid;
    grid-template-columns: repeat(${GRID.colunas}, 1fr);
    grid-template-rows: repeat(${GRID.linhas}, 1fr);
  }
  .titulo, .subtitulo, .lore { overflow-wrap: break-word; }
  .titulo {
    grid-column: ${GRID.titulo.colunaCss}; grid-row: ${GRID.titulo.linhaCss};
    /* A célula reserva 2 linhas pro pior caso (título mais longo do JSON,
       que quebra em 2 linhas) — um título curto de 1 linha só, alinhado ao
       topo por padrão, sobraria espaço vazio embaixo dele, afastando-o do
       subtítulo na célula seguinte. justify-content: flex-end cola o texto
       na base da célula em vez do topo, ficando sempre colado ao subtítulo. */
    display: flex; flex-direction: column; justify-content: flex-end;
    font-family: 'PromoTitulo', sans-serif; font-weight: ${ESTILO_TITULO.fontWeight};
    font-size: ${paraRem(dados.fontes.tituloPx)}; line-height: ${ESTILO_TITULO.lineHeight};
    color: #ffffff; text-shadow: 0 2px 10px rgba(0,0,0,0.85), 0 0 22px rgba(0,0,0,0.6);
  }
  .subtitulo {
    grid-column: ${GRID.subtitulo.colunaCss}; grid-row: ${GRID.subtitulo.linhaCss};
    font-family: 'PromoCorpo', sans-serif; font-weight: ${ESTILO_SUBTITULO.fontWeight};
    font-size: ${paraRem(dados.fontes.subtituloPx)}; line-height: ${ESTILO_SUBTITULO.lineHeight};
    color: #c9d2e0; text-shadow: 0 2px 8px rgba(0,0,0,0.85);
  }
  .lore {
    grid-column: ${GRID.lore.colunaCss}; grid-row: ${GRID.lore.linhaCss};
    font-family: 'PromoCorpo', sans-serif; font-weight: ${ESTILO_LORE.fontWeight};
    font-size: ${paraRem(dados.fontes.lorePx)}; line-height: ${ESTILO_LORE.lineHeight};
    color: #d8d8d8; text-shadow: 0 2px 6px rgba(0,0,0,0.7);
  }
</style>
</head>
<body>
  <div class="canvas">
    <img class="fundo" src="${urlDeArquivo(dados.fundo)}">
    <div class="degrade"></div>
    ${personagensHtml}
    <div class="grid">
      <div class="titulo">${escaparHtml(dados.titulo)}</div>
      <div class="subtitulo">${escaparHtml(dados.subtitulo)}</div>
      <div class="lore">${escaparHtml(dados.lore)}</div>
    </div>
  </div>
</body>
</html>`;
}
