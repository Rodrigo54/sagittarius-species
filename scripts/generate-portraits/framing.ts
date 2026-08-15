/** Enquadramento da arte-fonte no canvas do rig.
 *
 * `assets/` guarda master nativo e o enquadramento é derivado a cada
 * `bun run portrait`, aqui no pipeline — a arte-fonte nunca é reescrita.
 * Consequência prática: trocar o canvas do rig é mudar uma constante em
 * `types.ts`, sem reprocessar (e degradar) a arte-fonte.
 */

import { $ } from 'bun';
import { readFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodificarPng, type Imagem } from '../png';
import type { GuiaEnquadramento, ModoEnquadramento, RigInfo } from './types';

const __DIRNAME = dirname(fileURLToPath(import.meta.url));

const MAGICK = join(__DIRNAME, '../../bin/imagemagick/magick.exe');

export interface MedidaTrim {
  arquivo: string;
  /** Bounding box do conteúdo (sem a transparência em volta). */
  largura: number;
  altura: number;
  /** Onde a silhueta fica sólida, em fração da altura do conteúdo. Só é
   * medido quando a espécie ancora pela cabeça; `0` significa "o topo do
   * conteúdo já é sólido", que é o comportamento padrão. */
  inicioDoCorpo?: number;
}

export interface Geometria {
  /** Dimensões exatas (já arredondadas) da arte após o resize. */
  largura: number;
  altura: number;
  /** Posição do canto superior-esquerdo no canvas do rig. */
  x: number;
  y: number;
}

/** O guia resolvido em pixels do canvas. Calculado uma vez por rig e passado
 * adiante, para que validação e composição usem exatamente os mesmos
 * inteiros — divergir entre as duas foi o que já produziu arte fora do lugar. */
export interface GuiaEmPx {
  largura: number;
  topo: number;
  centroX: number;
  /** Altura que a arte precisa alcançar pra tocar a borda inferior do canvas. */
  alturaMinima: number;
  /** Canto esquerdo da arte no modo `largura`. */
  x: number;
  canvas: { largura: number; altura: number };
}

export function resolverGuia(canvas: RigInfo['canvas'], guia: GuiaEnquadramento): GuiaEmPx {
  const largura = Math.round(guia.largura * canvas.largura);
  const topo = Math.round(guia.topo * canvas.altura);
  const centroX = Math.round(guia.centroX * canvas.largura);

  return {
    largura,
    topo,
    centroX,
    alturaMinima: canvas.altura - topo,
    x: Math.round(centroX - largura / 2),
    canvas,
  };
}

/** Mede o bounding box de conteúdo (`%@` = trim box) de cada PNG numa única
 * invocação do ImageMagick, sem escrever nada. */
export async function medirTrims(arquivos: string[]): Promise<MedidaTrim[]> {
  if (arquivos.length === 0) return [];

  const saida = await $`${MAGICK} identify -format ${'%@\n'} ${arquivos}`.text();
  const linhas = saida.trim().split('\n');
  if (linhas.length !== arquivos.length) {
    throw new Error(
      `identify retornou ${linhas.length} medida(s) para ${arquivos.length} arquivo(s)`
    );
  }

  return linhas.map((linha, i) => {
    const match = linha.trim().match(/^(\d+)x(\d+)[+-]\d+[+-]\d+$/);
    if (!match) {
      throw new Error(`trim box ilegível para "${arquivos[i]}": "${linha}"`);
    }
    return { arquivo: arquivos[i], largura: Number(match[1]), altura: Number(match[2]) };
  });
}

/** Fração do máximo de densidade a partir da qual a silhueta conta como
 * "sólida". Medido no acervo: com este limiar, composições de cabelo normal
 * ficam entre 2,6% e 10% da altura, e as que têm chifre/penacho/antena entre
 * 12,7% e 25,2% — separação larga o bastante para o limiar não ser crítico. */
const LIMIAR_DE_SOLIDEZ = 0.35;

/** Onde a silhueta passa a ser sólida, em fração da altura.
 *
 * Mede **densidade** (quantos pixels opacos por linha), não largura. A
 * tentativa óbvia — "estrutura fina é estreita" — foi medida e é falsa: os
 * chifres de veado dos `ssm_green_elves` se espalham horizontalmente e ocupam
 * 82% da largura logo na primeira linha, mais que a própria cabeça. O que os
 * distingue é cobrirem pouca área dentro desse bounding box largo. */
export function detectarInicioDoCorpo(img: Imagem): number {
  const densidade: number[] = [];
  for (let y = 0; y < img.altura; y++) {
    let opacos = 0;
    for (let x = 0; x < img.largura; x++) {
      if (img.pixels[(y * img.largura + x) * 4 + 3] > 128) opacos++;
    }
    densidade.push(opacos);
  }

  const alvo = Math.max(...densidade) * LIMIAR_DE_SOLIDEZ;
  const linha = densidade.findIndex((d) => d >= alvo);
  return linha <= 0 ? 0 : linha / img.altura;
}

/** Preenche `inicioDoCorpo` nas medidas, lendo os pixels de cada master. */
export async function medirInicioDoCorpo(medidas: MedidaTrim[]): Promise<MedidaTrim[]> {
  return Promise.all(
    medidas.map(async (medida) => ({
      ...medida,
      inicioDoCorpo: detectarInicioDoCorpo(decodificarPng(await readFile(medida.arquivo))),
    }))
  );
}

/** Única fonte de verdade da matemática de encaixe — usada tanto pela
 * validação quanto pela composição real, pra nunca divergir entre as duas. */
export function calcularGeometria(
  medida: MedidaTrim,
  modo: ModoEnquadramento,
  guia: GuiaEmPx
): Geometria {
  const base =
    modo === 'largura'
      ? {
          largura: guia.largura,
          altura: Math.round((guia.largura * medida.altura) / medida.largura),
          x: guia.x,
        }
      : (() => {
          const largura = Math.round((guia.alturaMinima * medida.largura) / medida.altura);
          return {
            largura,
            altura: guia.alturaMinima,
            x: Math.round(guia.centroX - largura / 2),
          };
        })();

  // Ancorar pela cabeça sobe a arte, para que o ornamento fino fique acima do
  // guia em vez de empurrar o personagem para baixo. O limite é o topo do
  // canvas: acima dele não existe plano, então subir mais só apagaria arte.
  const recuo = Math.round((medida.inicioDoCorpo ?? 0) * base.altura);
  const y = Math.max(0, guia.topo - recuo);

  return { ...base, y };
}

/** Erros da regra de enquadramento. Modo `largura`: a arte escalada pra
 * largura do guia precisa alcançar a borda inferior do canvas (busto cortado
 * pelo quadro, nunca flutuando). Modo `altura`: a arte escalada pra altura
 * mínima não pode ultrapassar o canvas nas laterais. Em ambos os modos,
 * violação é composição atípica demais — trava a geração em vez de ser
 * acomodada silenciosamente. */
export function validarEnquadramento(
  medidas: MedidaTrim[],
  modo: ModoEnquadramento,
  guia: GuiaEmPx,
  slug: string
): string[] {
  const erros: string[] = [];

  for (const medida of medidas) {
    if (medida.largura === 0 || medida.altura === 0) {
      erros.push(
        `${slug}: "${basename(medida.arquivo)}" não tem conteúdo (canvas 100% transparente)`
      );
      continue;
    }

    const geometria = calcularGeometria(medida, modo, guia);

    // A arte precisa alcançar a borda inferior do canvas — busto cortado pelo
    // quadro, nunca flutuando. Confere sobre a geometria final, e não sobre a
    // altura isolada, porque ancorar pela cabeça sobe a arte e portanto sobe
    // também a base.
    if (modo === 'largura' && geometria.y + geometria.altura < guia.canvas.altura) {
      // Duas causas distintas levam à mesma geometria, e a saída de cada uma é
      // o oposto da outra: se a âncora subiu a arte até o teto, trocar o modo
      // só encolheria o personagem sem necessidade.
      const culpaDaAncora = geometria.y === 0 && (medida.inicioDoCorpo ?? 0) > 0;
      const saida = culpaDaAncora
        ? `a âncora "cabeca" subiu a arte ${Math.round((medida.inicioDoCorpo ?? 0) * geometria.altura)}px, até o topo do canvas, e a base subiu junto. Reveja "ancora" no portrait.json: essa arte não tem estrutura fina a sacrificar acima da cabeça, ou o detector de densidade não a está enxergando como tal.`
        : `o busto flutuaria. Arte larga demais pro guia: declare "modo": "altura" no portrait.json, ou ajuste a arte.`;
      erros.push(
        `${slug}: "${basename(medida.arquivo)}" tem conteúdo ${medida.largura}x${medida.altura} — escalado pra largura ${guia.largura} resulta em altura ${geometria.altura} a partir de y=${geometria.y}, terminando em ${geometria.y + geometria.altura}, antes da borda inferior do canvas (${guia.canvas.altura}); ${saida}`
      );
    }

    if (
      modo === 'altura' &&
      (geometria.x < 0 || geometria.x + geometria.largura > guia.canvas.largura)
    ) {
      erros.push(
        `${slug}: "${basename(medida.arquivo)}" tem conteúdo ${medida.largura}x${medida.altura} — escalado pra altura ${guia.alturaMinima} resulta em largura ${geometria.largura}, que ultrapassa o canvas (${guia.canvas.largura}) mesmo centralizado. Arte atípica demais mesmo em modo altura: ajuste a arte antes de gerar.`
      );
    }
  }

  return erros;
}

/** Enquadra um master **para um destino derivado**, nunca in place: trim →
 * resize exato (dimensões já calculadas por `calcularGeometria`) → composição
 * num canvas transparente do rig, na posição calculada. A arte-fonte em
 * `assets/` não é tocada. */
export async function enquadrarPng(
  medida: MedidaTrim,
  modo: ModoEnquadramento,
  guia: GuiaEmPx,
  destino: string
) {
  const geometria = calcularGeometria(medida, modo, guia);

  // Array interpolado: o Bun Shell escapa cada item como argumento literal —
  // essencial pros parênteses do ImageMagick, que o parser do $ não aceita
  // soltos no template. Resize com "!" força as dimensões exatas já
  // calculadas (mesmos números da validação), em vez de deixar o ImageMagick
  // re-derivar a proporção e arredondar por conta própria.
  const args = [
    '-size', `${guia.canvas.largura}x${guia.canvas.altura}`, 'xc:none',
    '(', medida.arquivo, '-trim', '+repage', '-resize', `${geometria.largura}x${geometria.altura}!`, ')',
    '-geometry', `+${geometria.x}+${geometria.y}`, '-composite',
    `PNG32:${destino}`,
  ];
  await $`${MAGICK} ${args}`.quiet();
}
