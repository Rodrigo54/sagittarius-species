import { existsSync } from 'node:fs';
import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { RoomsInfo } from './types';

function nomesEsperados(quantidade: number): Set<string> {
  return new Set(
    Array.from({ length: quantidade }, (_, i) => `${String(i + 1).padStart(3, '0')}_room.dds`)
  );
}

/** Apaga, na pasta de destino em mod/, qualquer .dds que não corresponda a um
 * PNG de origem — limpeza total, sem exceção, mesma política dos portraits. */
export async function limparOrfaos(info: RoomsInfo, pastaDestino: string) {
  if (!existsSync(pastaDestino)) return;

  const esperados = nomesEsperados(info.arquivos.length);
  const itens = await readdir(pastaDestino);
  for (const item of itens) {
    if (item.endsWith('.dds') && !esperados.has(item)) {
      await rm(join(pastaDestino, item));
      console.log(`  removido órfão: ${join(pastaDestino, item)}`);
    }
  }
}
