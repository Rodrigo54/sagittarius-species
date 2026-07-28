import { $ } from 'bun';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __DIRNAME = dirname(fileURLToPath(import.meta.url));

export const PASTA_RAIZ = join(__DIRNAME, '..');
export const PASTA_ASSETS = join(PASTA_RAIZ, 'assets');
export const PASTA_MOD = join(PASTA_RAIZ, 'mod/sagittarius-species');

const TEXCONV = join(__DIRNAME, '../bin/texconv/texconv.exe');

// Só os formatos usados pelo pipeline (linear/UNORM — o Stellaris não suporta as variantes sRGB, ver image.md)
const FORMATOS = {
  bc3: 'BC3_UNORM',
  bc1: 'BC1_UNORM',
} as const;

export type ConverterOptions = {
  format: keyof typeof FORMATOS;
  noMips: boolean;
  /** Pasta raiz de origem a ser trocada por pastaDestino (ex.: assets/portraits) */
  pastaOrigem: string;
  /** Pasta raiz de destino final dentro do mod (ex.: mod/.../gfx/models/portraits) */
  pastaDestino: string;
};

function agruparPorPastaDestino(
  arquivos: string[],
  pastaOrigem: string,
  pastaDestino: string
) {
  const grupos = new Map<string, string[]>();

  for (const arquivo of arquivos) {
    const caminhoRelativo = arquivo.replace(pastaOrigem, '');
    const pastaDestinoArquivo = join(pastaDestino, dirname(caminhoRelativo));
    const grupo = grupos.get(pastaDestinoArquivo) ?? [];
    grupo.push(arquivo);
    grupos.set(pastaDestinoArquivo, grupo);
  }

  return grupos;
}

/** Agrupa os arquivos por pasta de destino e invoca o texconv uma vez por
 * pasta (só aceita um -o por invocação, ao contrário do nvtt antigo). */
export async function converter(arquivos: string[], options: ConverterOptions) {
  const formato = FORMATOS[options.format];
  const grupos = agruparPorPastaDestino(
    arquivos,
    options.pastaOrigem,
    options.pastaDestino
  );

  for (const [pastaDestino, arquivosDoGrupo] of grupos) {
    if (!existsSync(pastaDestino)) {
      await mkdir(pastaDestino, { recursive: true });
    }

    const args = [
      '-f',
      formato,
      ...(options.noMips ? ['-m', '1'] : []),
      '-ft',
      'dds',
      '-y',
      '-o',
      pastaDestino,
      '--',
      ...arquivosDoGrupo,
    ];

    // Silencioso no sucesso (o texconv narra arquivo por arquivo, o que
    // enterra a saída útil do pipeline); no erro, o $ lança com o stderr.
    await $`${TEXCONV} ${args}`.quiet();
    console.log(`  ${String(arquivosDoGrupo.length).padStart(3)} -> ${pastaDestino}`);
  }
}
