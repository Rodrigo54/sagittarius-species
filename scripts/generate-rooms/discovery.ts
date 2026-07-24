import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { RoomsInfo } from './types';

const ordenarNumericamente = (arquivos: string[]) =>
  [...arquivos].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

export async function carregarRooms(pastaCitySets: string): Promise<RoomsInfo> {
  if (!existsSync(pastaCitySets)) return { arquivos: [] };

  const itens = await readdir(pastaCitySets);
  const arquivos = ordenarNumericamente(
    itens.filter((item) => item.endsWith('.png'))
  ).map((item) => join(pastaCitySets, item));

  return { arquivos };
}
