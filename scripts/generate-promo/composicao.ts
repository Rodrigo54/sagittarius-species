import { $ } from 'bun';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PASTA_RAIZ } from '../converter';
import { medirTrims, type MedidaTrim } from '../generate-portraits/framing';
import type { EspeciePromo } from '../promo-schema';
import {
  ALTURA_BASE_PERSONAGEM,
  CANVAS,
  LARGURA_DEGRADE,
  ORDEM_DE_DESENHO,
  PAINEL,
  rankEfetivo,
  ZONA_PERSONAGENS,
  type Colocacao,
  type EscalasOverride,
} from './layout';
import type { VariantePodio } from './selecao';
import { FONTE_CORPO, FONTE_TITULO } from './types';

const __DIRNAME = dirname(fileURLToPath(import.meta.url));
const MAGICK = join(__DIRNAME, '../../bin/imagemagick/magick.exe');

/** Onde os `.txt` que alimentam `caption:@arquivo` ficam antes da composição
 * — fora do git (ver .gitignore), regenerados a cada execução. Passar o
 * texto por arquivo em vez de argv evita todo o escaping de `%`/`@`/aspas que
 * `caption:<texto>` direto na linha de comando exigiria. */
const PASTA_STAGING = join(PASTA_RAIZ, '.promo-staging');

/** `-font` e `caption:@arquivo` passam pelo parser de texto do ImageMagick,
 * que trata `\x` como início de escape e engole a barra — corrompendo em
 * silêncio um caminho Windows (`path.join` usa `\`), sem erro fatal: o aviso
 * `unable to read font`/de leitura do arquivo vai pro stderr e a composição
 * segue com a fonte padrão. Barra normal não sofre esse tratamento. */
function paraArgumentoDeTexto(caminho: string): string {
  return caminho.replaceAll('\\', '/');
}

interface GeometriaPersonagem {
  largura: number;
  altura: number;
  x: number;
  y: number;
}

/** Única fonte de verdade da matemática do pódio: altura por colocação
 * (fração de `ALTURA_BASE_PERSONAGEM`), largura derivada da proporção do
 * recorte, todos com a base na mesma linha (o rodapé do canvas). */
function calcularGeometriaPersonagem(
  medida: MedidaTrim,
  colocacao: Colocacao,
  override: EscalasOverride | undefined
): GeometriaPersonagem {
  const rank = rankEfetivo(colocacao, override);
  const altura = Math.round(ALTURA_BASE_PERSONAGEM * rank.escala);
  const largura = Math.round((altura * medida.largura) / medida.altura);
  const centroX = Math.round(
    ZONA_PERSONAGENS.xMin + (ZONA_PERSONAGENS.xMax - ZONA_PERSONAGENS.xMin) * rank.centroXFracaoDaZona
  );
  // A proporção do recorte varia por espécie (largura depende da altura fixa
  // + aspect ratio do PNG) — mesmo com `centroXFracaoDaZona` calibrado a
  // olho, uma variante mais larga que a esperada pode empurrar a borda do
  // personagem pra fora do canvas. Prende dentro de [0, CANVAS.largura].
  const xIdeal = Math.round(centroX - largura / 2);
  const x = Math.min(Math.max(xIdeal, 0), CANVAS.largura - largura);
  // Mesma regra do pipeline de portraits: a arte sempre alcança a borda
  // inferior do canvas, sem gap — nunca flutuando acima do rodapé.
  return {
    largura,
    altura,
    x,
    y: CANVAS.altura - altura,
  };
}

/** Monta a imagem de divulgação inteira numa única invocação do ImageMagick:
 * fundo (cover + crop centralizado ao canvas) → degradê escuro sobre o painel
 * de texto → os 3 personagens do pódio, trás→frente → título → lore.
 * Nenhuma etapa escreve arquivo intermediário além dos `.txt` de legenda. */
export async function montarImagem(
  slug: string,
  especie: EspeciePromo,
  variantes: VariantePodio[],
  fundo: string,
  destino: string
) {
  await mkdir(PASTA_STAGING, { recursive: true });
  const caminhoTitulo = join(PASTA_STAGING, `${slug}-titulo.txt`);
  const caminhoLore = join(PASTA_STAGING, `${slug}-lore.txt`);
  await writeFile(caminhoTitulo, especie.nome, 'utf-8');
  await writeFile(caminhoLore, especie.lore, 'utf-8');

  const medidas = await medirTrims(variantes.map((v) => v.caminho));
  const medidaPorColocacao = new Map(variantes.map((v, i) => [v.colocacao, medidas[i]]));

  // `especie.escalas` vem do JSON com chave string ("1".."4") — layout.ts
  // trabalha com `Colocacao` numérica.
  const overrideEscalas: EscalasOverride | undefined =
    especie.escalas === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(especie.escalas).map(([colocacao, escala]) => [Number(colocacao), escala])
        );

  const argsPersonagens = ORDEM_DE_DESENHO.flatMap((colocacao) => {
    const variante = variantes.find((v) => v.colocacao === colocacao);
    const medida = medidaPorColocacao.get(colocacao);
    if (variante === undefined || medida === undefined) {
      throw new Error(`${slug}: nenhuma variante selecionada para a colocação ${colocacao}`);
    }
    const geo = calcularGeometriaPersonagem(medida, colocacao, overrideEscalas);
    return [
      '(', variante.caminho, '-trim', '+repage', '-resize', `${geo.largura}x${geo.altura}!`, ')',
      '-geometry', `+${geo.x}+${geo.y}`, '-composite',
    ];
  });

  const larguraUtilTexto = PAINEL.largura - PAINEL.margemEsquerda - PAINEL.margemDireita;
  const topoLore = PAINEL.topoTitulo + PAINEL.alturaTitulo + PAINEL.espacoAntesLore;
  const alturaLore = CANVAS.altura - PAINEL.margemInferior - topoLore;

  // Degradê preto→transparente, esquerda opaca: um gradient: vertical
  // (`black-none`) girado -90° vira horizontal com a orientação certa (ver
  // docs/pipeline-promo.md para a verificação empírica do sentido do giro).
  const args = [
    '-size', `${CANVAS.largura}x${CANVAS.altura}`, 'xc:black',
    '(', fundo, '-resize', `${CANVAS.largura}x${CANVAS.altura}^`, '-gravity', 'center', '-extent', `${CANVAS.largura}x${CANVAS.altura}`, ')',
    // `-gravity` é um "setting", não escopado pelos parênteses acima — sem
    // resetar aqui, o `center` usado no -extent do fundo vazaria pros
    // `-geometry +x+y` seguintes (gradiente e personagens, todos calculados
    // como offset a partir do canto superior esquerdo).
    '-gravity', 'NorthWest',
    '-geometry', '+0+0', '-composite',
    '(', '-size', `${CANVAS.altura}x${LARGURA_DEGRADE}`, 'gradient:black-none', '-rotate', '-90', ')',
    '-geometry', '+0+0', '-composite',
    ...argsPersonagens,
    '(', '-size', `${larguraUtilTexto}x${PAINEL.alturaTitulo}`, '-background', 'none', '-fill', 'white',
      '-font', paraArgumentoDeTexto(FONTE_TITULO), '-pointsize', String(PAINEL.tamanhoTitulo), '-gravity', 'NorthWest',
      `caption:@${paraArgumentoDeTexto(caminhoTitulo)}`, ')',
    '-geometry', `+${PAINEL.margemEsquerda}+${PAINEL.topoTitulo}`, '-composite',
    '(', '-size', `${larguraUtilTexto}x${alturaLore}`, '-background', 'none', '-fill', '#d8d8d8',
      '-font', paraArgumentoDeTexto(FONTE_CORPO), '-pointsize', String(PAINEL.tamanhoLore), '-gravity', 'NorthWest',
      `caption:@${paraArgumentoDeTexto(caminhoLore)}`, ')',
    '-geometry', `+${PAINEL.margemEsquerda}+${topoLore}`, '-composite',
    `PNG32:${destino}`,
  ];

  await $`${MAGICK} ${args}`.quiet();
}
