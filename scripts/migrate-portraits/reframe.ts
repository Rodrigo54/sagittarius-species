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

export interface MedidaTrim {
  arquivo: string;
  /** Bounding box do conteúdo (sem a transparência em volta). */
  largura: number;
  altura: number;
  /** Altura resultante após escalar o trim pra largura do guia. */
  alturaEscalada: number;
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
    const largura = Number(match[1]);
    const altura = Number(match[2]);
    return {
      arquivo: arquivos[i],
      largura,
      altura,
      alturaEscalada: Math.round((GUIA.largura * altura) / largura),
    };
  });
}

/** Erros da regra de enquadramento: a arte escalada pra largura do guia
 * precisa alcançar a borda inferior do canvas (busto cortado pelo quadro,
 * nunca flutuando sobre transparência). Arte que não alcança é composição
 * atípica — trava a migração em vez de ser acomodada silenciosamente. */
export function validarEnquadramento(medidas: MedidaTrim[], slug: string): string[] {
  const alturaMinima = CANVAS.altura - GUIA.y;
  const erros: string[] = [];

  for (const medida of medidas) {
    if (medida.alturaEscalada < alturaMinima) {
      erros.push(
        `${slug}: "${basename(medida.arquivo)}" tem conteúdo ${medida.largura}x${medida.altura} — escalado pra largura ${GUIA.largura} resulta em altura ${medida.alturaEscalada}, abaixo do mínimo ${alturaMinima} pra alcançar a borda inferior do canvas (busto flutuaria). Arte atípica: ajuste manualmente antes de migrar.`
      );
    }
  }

  return erros;
}

/** Reenquadra um PNG in place: trim → escala pra largura do guia → composição
 * num canvas transparente do `ssm_shared`, topo no topo do guia, centrado na
 * horizontal; a sobra desce e o que passa da borda inferior é cortado. */
export async function reenquadrarPng(arquivo: string) {
  // Array interpolado: o Bun Shell escapa cada item como argumento literal —
  // essencial pros parênteses do ImageMagick, que o parser do $ não aceita
  // soltos no template.
  const args = [
    '-size', `${CANVAS.largura}x${CANVAS.altura}`, 'xc:none',
    '(', arquivo, '-trim', '+repage', '-resize', `${GUIA.largura}x`, ')',
    '-geometry', `+${GUIA.x}+${GUIA.y}`, '-composite',
    `PNG32:${arquivo}`,
  ];
  await $`${MAGICK} ${args}`.quiet();
}
