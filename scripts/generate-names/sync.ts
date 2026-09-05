import { join } from 'node:path';
import { limparArquivos, listarEntradas } from '../shared/files';

export async function limparNamesOrfaos(pastaTxt: string, pastaL10n: string, culturas: string[]) {
  await limparArquivos(pastaTxt, nome => /^ssm_[a-z0-9_]+\.txt$/.test(nome), new Set(culturas.map(c => c + '.txt')));
  for (const idioma of await listarEntradas(pastaL10n)) {
    if (!idioma.isDirectory() || !/^[a-z][a-z_]*$/.test(idioma.name)) continue;
    const sufixo = '_l_' + idioma.name + '.yml';
    await limparArquivos(join(pastaL10n, idioma.name, 'name_lists'),
      nome => /^ssm_[a-z0-9_]+_l_[a-z_]+\.yml$/.test(nome) && nome.endsWith(sufixo),
      new Set(culturas.map(c => c + sufixo)));
  }
}
