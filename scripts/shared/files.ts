import { readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';

export async function listarEntradas(pasta: string) {
  try { return await readdir(pasta, { withFileTypes: true }); }
  catch (erro) { if ((erro as NodeJS.ErrnoException).code === 'ENOENT') return []; throw erro; }
}

/** Remove somente arquivos regulares reconhecidos como saída do gerador. */
export async function limparArquivos(pasta: string, pertence: (nome: string) => boolean, esperados: Set<string>) {
  for (const item of await listarEntradas(pasta)) {
    if (item.isFile() && pertence(item.name) && !esperados.has(item.name)) {
      await unlink(join(pasta, item.name));
      console.log('Removido órfão: ' + join(pasta, item.name));
    }
  }
}
