/** Monta a imagem de divulgação inteira renderizando HTML/CSS Grid num
 * Chromium/Edge headless (Playwright) e tirando um screenshot do canvas —
 * substitui a composição antes feita inteiramente em ImageMagick. A `Page`
 * é aberta uma única vez em `index.ts` e reaproveitada entre as 19 espécies
 * (abrir um browser por espécie seria custo repetido à toa). */

// O projeto compila sem lib DOM (scripts/tsconfig.json — código Bun
// server-side); esta referência traz `document` só pro corpo da função que o
// Playwright serializa e roda dentro do browser (`page.evaluate`).
/// <reference lib="dom" />

import type { Page } from 'playwright';
import type { EspeciePromo } from '../promo-schema';
import type { FontesCalibradas } from './calibracao';
import {
  ALTURA_BASE_PERSONAGEM,
  CANVAS,
  ORDEM_DE_DESENHO,
  rankEfetivo,
  ZONA_PERSONAGENS,
  type Colocacao,
  type EscalasOverride,
} from './layout';
import { renderizarHtml } from './renderizacao';
import type { VariantePodio } from './selecao';
import { montarHtml, type PersonagemRenderizado } from './template';
import { medirRecortes, type MedidaRecorte } from './trim';

/** A Steam rejeita imagem de galeria do Workshop acima de 1MB — a saída sai
 * como JPEG (não PNG) por causa disso; 85 é o ponto onde a compressão fica
 * imperceptível a olho nessa composição (foto/gradiente, sem texto miúdo nem
 * bordas duras de pixel art) e ainda cai bem abaixo do limite. */
const QUALIDADE_JPEG = 85;

/** Geometria final de um personagem (posição/tamanho no canvas) mais o
 * recorte CSS que reproduz o "trim + resize!" físico que o ImageMagick fazia
 * antes — escala a bounding box do trim pra caber exatamente em
 * `largura`×`altura`, e aplica essa mesma escala ao offset e à dimensão
 * total do PNG original, pra recortar via `object-position` sem nunca
 * reescrever o arquivo. */
function calcularPersonagemRenderizado(
  caminho: string,
  medida: MedidaRecorte,
  colocacao: Colocacao,
  override: EscalasOverride | undefined
): PersonagemRenderizado {
  const rank = rankEfetivo(colocacao, override);
  const altura = Math.round(ALTURA_BASE_PERSONAGEM * rank.escala);
  const largura = Math.round((altura * medida.trimLargura) / medida.trimAltura);
  const centroX = Math.round(
    ZONA_PERSONAGENS.xMin + (ZONA_PERSONAGENS.xMax - ZONA_PERSONAGENS.xMin) * rank.centroXFracaoDaZona
  );
  // A proporção do recorte varia por espécie — mesmo com `centroXFracaoDaZona`
  // calibrado a olho, uma variante mais larga que a esperada pode empurrar a
  // borda do personagem pra fora do canvas. Prende dentro de [0, largura].
  const xIdeal = Math.round(centroX - largura / 2);
  const x = Math.min(Math.max(xIdeal, 0), CANVAS.largura - largura);
  // Mesma regra do pipeline de portraits: a arte sempre alcança a borda
  // inferior do canvas, sem gap — nunca flutuando acima do rodapé.
  const y = CANVAS.altura - altura;

  const escala = largura / medida.trimLargura;
  return {
    caminhoArquivo: caminho,
    x,
    y,
    largura,
    altura,
    cropLeft: Math.round(medida.offsetX * escala),
    cropTop: Math.round(medida.offsetY * escala),
    cropLargura: Math.round(medida.larguraOriginal * escala),
    cropAltura: Math.round(medida.alturaOriginal * escala),
  };
}

export async function montarImagem(
  page: Page,
  slug: string,
  especie: EspeciePromo,
  variantes: VariantePodio[],
  fundo: string,
  destino: string,
  fontes: FontesCalibradas
) {
  const medidas = await medirRecortes(variantes.map((v) => v.caminho));
  const medidaPorColocacao = new Map(variantes.map((v, i) => [v.colocacao, medidas[i]]));

  // `especie.escalas` vem do JSON com chave string ("1".."3") — layout.ts
  // trabalha com `Colocacao` numérica.
  const overrideEscalas: EscalasOverride | undefined =
    especie.escalas === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(especie.escalas).map(([colocacao, escala]) => [Number(colocacao), escala])
        );

  const personagens = ORDEM_DE_DESENHO.map((colocacao) => {
    const variante = variantes.find((v) => v.colocacao === colocacao);
    const medida = medidaPorColocacao.get(colocacao);
    if (variante === undefined || medida === undefined) {
      throw new Error(`${slug}: nenhuma variante selecionada para a colocação ${colocacao}`);
    }
    return calcularPersonagemRenderizado(variante.caminho, medida, colocacao, overrideEscalas);
  });

  const html = montarHtml({
    fundo,
    titulo: especie.titulo,
    subtitulo: especie.subtitulo,
    lore: especie.lore,
    personagens,
    fontes,
  });

  await renderizarHtml(page, html, `${slug}.html`);
  // `waitUntil: 'load'` já espera as <img> carregarem, mas as @font-face não
  // bloqueiam o evento `load` — sem isso o screenshot pode sair com a fonte
  // de fallback do sistema em vez de Orbitron/Exo2.
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: destino, type: 'jpeg', quality: QUALIDADE_JPEG });
}
