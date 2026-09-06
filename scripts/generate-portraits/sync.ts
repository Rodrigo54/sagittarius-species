import { join } from 'node:path';
import { nomesNumerados } from '../utils';
import { limparArquivos, listarEntradas } from '../shared/files';
import type { SpeciesInfo } from '../shared/species';

const generos = ['male', 'female', 'genderless'] as const;
const ddsNumerado = (nome: string) => /^\d{3,}\.dds$/.test(nome);

export async function limparOrfaos(info: SpeciesInfo, pastaDestinoEspecie: string) {
  for (const [genero, arquivos] of Object.entries(info.arquivos)) {
    await limparArquivos(join(pastaDestinoEspecie, genero), ddsNumerado, nomesNumerados(arquivos.length, '.dds'));
  }
}

/** A limpeza global pertence somente à execução sem filtro de espécie. */
export async function limparOrfaosGlobais(especies: SpeciesInfo[], pastaModelos: string, pastaTxt: string) {
  const atuais = new Map(especies.map(info => [info.slug, info]));
  for (const entrada of await listarEntradas(pastaModelos)) {
    if (!entrada.isDirectory() || !/^ssm_[a-z0-9_]+$/.test(entrada.name) || entrada.name === 'ssm_shared') continue;
    const info = atuais.get(entrada.name);
    for (const genero of generos) {
      if (info?.arquivos[genero] !== undefined) continue;
      await limparArquivos(join(pastaModelos, entrada.name, genero), ddsNumerado, new Set());
    }
  }
  await limparArquivos(pastaTxt, nome => /^ssm_[a-z0-9_]+_portrait\.txt$/.test(nome),
    new Set(especies.map(info => info.slug + '_portrait.txt')));
}
