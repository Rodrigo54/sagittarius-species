import { $ } from 'bun';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __DIRNAME = dirname(fileURLToPath(import.meta.url));

export const MAGICK = join(__DIRNAME, '../../bin/imagemagick/magick.exe');

/** Enquadramento-alvo no canvas do `ssm_shared`, calibrado visualmente contra
 * um print do jogo — fonte: camada `guia-de-enquadramento` do
 * `assets/portraits/ssm_shared_reference.psd` (600×642 em +259+339). Se o guia
 * for recalibrado no Affinity, atualize estas constantes junto (decisão
 * consciente e versionada — o PSD não é lido em runtime). */
export const GUIA = { largura: 600, altura: 642, x: 259, y: 339 } as const;

/** Canvas de `character_textures` do rig `ssm_shared` (ver RIGS em
 * ../generate-portraits/types.ts). */
export const CANVAS = { largura: 980, altura: 976 } as const;

/** `largura` (padrão): escala pra largura do guia (600), topo no topo do
 * guia — regra padrão pra composições "busto alto e estreito" (a maioria).
 * `altura`: escala pra altura mínima (garante que a base sempre toque a
 * borda do canvas), permitindo que a largura resultante ultrapasse o guia
 * (nunca o canvas) — override pra composições atipicamente largas (ombros
 * largos, capuz), onde preencher a largura do guia deixaria a arte curta
 * demais pra alcançar a base. Escolha por espécie via `--altura` na CLI. */
export type Modo = 'largura' | 'altura';

export interface MedidaTrim {
  arquivo: string;
  /** Bounding box do conteúdo (sem a transparência em volta). */
  largura: number;
  altura: number;
}

export interface Geometria {
  /** Dimensões exatas (já arredondadas) da arte após o resize. */
  largura: number;
  altura: number;
  /** Posição do canto superior-esquerdo no canvas 980×976. */
  x: number;
  y: number;
}

const ALTURA_MINIMA = CANVAS.altura - GUIA.y;
const CENTRO_X_GUIA = GUIA.x + GUIA.largura / 2;

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

/** Única fonte de verdade da matemática de encaixe — usada tanto pela
 * validação quanto pela composição real, pra nunca divergir entre as duas. */
export function calcularGeometria(medida: MedidaTrim, modo: Modo): Geometria {
  if (modo === 'largura') {
    const altura = Math.round((GUIA.largura * medida.altura) / medida.largura);
    return { largura: GUIA.largura, altura, x: GUIA.x, y: GUIA.y };
  }

  const largura = Math.round((ALTURA_MINIMA * medida.largura) / medida.altura);
  return { largura, altura: ALTURA_MINIMA, x: Math.round(CENTRO_X_GUIA - largura / 2), y: GUIA.y };
}

/** Erros da regra de enquadramento. Modo `largura`: a arte escalada pra
 * largura do guia precisa alcançar a borda inferior do canvas (busto cortado
 * pelo quadro, nunca flutuando). Modo `altura`: a arte escalada pra altura
 * mínima não pode ultrapassar o canvas nas laterais. Em ambos os modos,
 * violação é composição atípica demais — trava a migração em vez de ser
 * acomodada silenciosamente. */
export function validarEnquadramento(medidas: MedidaTrim[], modo: Modo, slug: string): string[] {
  const erros: string[] = [];

  for (const medida of medidas) {
    const geometria = calcularGeometria(medida, modo);

    if (modo === 'largura' && geometria.altura < ALTURA_MINIMA) {
      erros.push(
        `${slug}: "${basename(medida.arquivo)}" tem conteúdo ${medida.largura}x${medida.altura} — escalado pra largura ${GUIA.largura} resulta em altura ${geometria.altura}, abaixo do mínimo ${ALTURA_MINIMA} pra alcançar a borda inferior do canvas (busto flutuaria). Arte atípica: rode de novo com --altura, ou ajuste manualmente.`
      );
    }

    if (modo === 'altura' && (geometria.x < 0 || geometria.x + geometria.largura > CANVAS.largura)) {
      erros.push(
        `${slug}: "${basename(medida.arquivo)}" tem conteúdo ${medida.largura}x${medida.altura} — escalado pra altura ${ALTURA_MINIMA} resulta em largura ${geometria.largura}, que ultrapassa o canvas (${CANVAS.largura}) mesmo centralizado. Arte atípica demais mesmo em modo altura: ajuste manualmente antes de migrar.`
      );
    }
  }

  return erros;
}

/** Reenquadra um PNG in place: trim → resize exato (dimensões já calculadas
 * por `calcularGeometria`) → composição num canvas transparente do
 * `ssm_shared`, na posição calculada. */
export async function reenquadrarPng(medida: MedidaTrim, modo: Modo) {
  const geometria = calcularGeometria(medida, modo);

  // Array interpolado: o Bun Shell escapa cada item como argumento literal —
  // essencial pros parênteses do ImageMagick, que o parser do $ não aceita
  // soltos no template. Resize com "!" força as dimensões exatas já
  // calculadas (mesmos números da validação), em vez de deixar o ImageMagick
  // re-derivar a proporção e arredondar por conta própria.
  const args = [
    '-size', `${CANVAS.largura}x${CANVAS.altura}`, 'xc:none',
    '(', medida.arquivo, '-trim', '+repage', '-resize', `${geometria.largura}x${geometria.altura}!`, ')',
    '-geometry', `+${geometria.x}+${geometria.y}`, '-composite',
    `PNG32:${medida.arquivo}`,
  ];
  await $`${MAGICK} ${args}`.quiet();
}
