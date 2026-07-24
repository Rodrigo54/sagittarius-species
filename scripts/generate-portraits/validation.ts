import { open } from 'node:fs/promises';
import { basename } from 'node:path';
import { RIGS, RIG_PADRAO, type SpeciesInfo } from './types';

/** Confere que os arquivos são exatamente "001.png".."NNN.png", zero-padded a 3
 * dígitos, sequenciais e sem buracos — é a convenção que a lista
 * character_textures gerada assume ao numerar as texturas. */
function validarSequencia(
  arquivos: string[],
  esperado: number,
  rotulo: string,
  slug: string
): string[] {
  const erros: string[] = [];

  if (arquivos.length !== esperado) {
    erros.push(
      `${slug}: contagem declarada (${esperado}) para "${rotulo}" não bate com os PNGs encontrados (${arquivos.length})`
    );
    return erros;
  }

  arquivos.forEach((arquivo, index) => {
    const nomeEsperado = `${String(index + 1).padStart(3, '0')}.png`;
    if (basename(arquivo) !== nomeEsperado) {
      erros.push(
        `${slug}: esperava "${nomeEsperado}" na posição ${index} de "${rotulo}", encontrou "${basename(arquivo)}" — numeração precisa ser sequencial e zero-padded a 3 dígitos, sem buracos`
      );
    }
  });

  return erros;
}

/** Lê só o cabeçalho IHDR do PNG (24 bytes) pra pegar largura/altura, sem
 * carregar o arquivo inteiro. */
async function lerDimensoesPng(caminho: string): Promise<{ largura: number; altura: number }> {
  const handle = await open(caminho, 'r');
  try {
    const buffer = Buffer.alloc(24);
    await handle.read(buffer, 0, 24, 0);
    return { largura: buffer.readUInt32BE(16), altura: buffer.readUInt32BE(20) };
  } finally {
    await handle.close();
  }
}

/** Confere que todo PNG bate com o canvas esperado pelo rig compartilhado da
 * espécie (825×1650 pro `sl_shared` legado, 980×976 pro `ssm_shared`) —
 * sem isso, uma espécie nova pintada com o template errado só seria
 * descoberta olhando o retrato deformado in-game. */
async function validarDimensoes(
  arquivos: string[],
  rig: SpeciesInfo['config']['rig'],
  rotulo: string,
  slug: string
): Promise<string[]> {
  const esperado = RIGS[rig ?? RIG_PADRAO];
  const erros: string[] = [];

  for (const arquivo of arquivos) {
    const { largura, altura } = await lerDimensoesPng(arquivo);
    if (largura !== esperado.largura || altura !== esperado.altura) {
      erros.push(
        `${slug}: "${basename(arquivo)}" (${rotulo}) tem ${largura}x${altura}, esperado ${esperado.largura}x${esperado.altura} para o rig "${rig ?? RIG_PADRAO}"`
      );
    }
  }

  return erros;
}

export async function validarEspecie(info: SpeciesInfo): Promise<string[]> {
  const { slug, config } = info;
  const erros: string[] = [];

  const nomeEsperado = slug.replace(/^ssm_/, '');
  if (config.name !== nomeEsperado) {
    erros.push(
      `${slug}: campo "name" do portrait.json ("${config.name}") não bate com o nome da pasta ("${nomeEsperado}")`
    );
  }

  if (config.gendered) {
    erros.push(
      ...validarSequencia(info.arquivosMale, config.counts.male ?? -1, 'male', slug)
    );
    erros.push(
      ...validarSequencia(info.arquivosFemale, config.counts.female ?? -1, 'female', slug)
    );
  } else {
    erros.push(
      ...validarSequencia(info.arquivosFlat, config.counts.flat ?? -1, 'flat', slug)
    );
  }

  // só confere dimensão se a sequência já bateu — evita erro de dimensão
  // confuso/redundante quando o problema real é contagem/numeração.
  if (erros.length === 0) {
    if (config.gendered) {
      erros.push(...(await validarDimensoes(info.arquivosMale, config.rig, 'male', slug)));
      erros.push(...(await validarDimensoes(info.arquivosFemale, config.rig, 'female', slug)));
    } else {
      erros.push(...(await validarDimensoes(info.arquivosFlat, config.rig, 'flat', slug)));
    }
  }

  return erros;
}
