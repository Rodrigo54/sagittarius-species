import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

/** Índice zero-padded a 3 dígitos — a convenção de numeração de toda arte do
 * mod (`001.png`, `007_room.dds`), compartilhada por portraits, rooms e pelas
 * chaves de variante do `portrait.json`. */
export const pad = (n: number) => String(n).padStart(3, '0');

/** Ordena "10" depois de "9", não antes — sem isso a lista de texturas gerada
 * sairia fora de ordem a partir da décima variante. */
export const ordenarNumericamente = (arquivos: string[]) =>
  [...arquivos].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

/** Os nomes que uma sequência completa de `quantidade` arquivos deve ter
 * (`001<sufixo>`..`NNN<sufixo>`) — usado pela limpeza de órfãos dos dois
 * pipelines para decidir o que sobra em `mod/` sem origem em `assets/`. */
export function nomesNumerados(quantidade: number, sufixo: string): Set<string> {
  return new Set(Array.from({ length: quantidade }, (_, i) => `${pad(i + 1)}${sufixo}`));
}

export async function listar(pastaInicial: string, extension: string = '.png') {
  const arquivos: string[] = [];
  const pastas: string[] = [];

  async function buscar(pastaAtual: string) {
    const itens = await readdir(pastaAtual);

    for (const item of itens) {
      const caminhoCompleto = join(pastaAtual, item);
      const file = await stat(caminhoCompleto);

      if (file.isDirectory()) {
        pastas.push(caminhoCompleto);
        await buscar(caminhoCompleto);
      }
      if (item.endsWith(extension)) {
        arquivos.push(caminhoCompleto);
      }
    }
  }

  await buscar(pastaInicial);

  return { arquivos, pastas };
}
