import { basename } from 'node:path';
import type { SpeciesInfo } from './types';

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

export function validarEspecie(info: SpeciesInfo): string[] {
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

  return erros;
}
