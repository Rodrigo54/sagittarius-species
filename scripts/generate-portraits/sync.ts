import { existsSync } from 'node:fs';
import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { nomesNumerados } from '../utils';
import type { SpeciesInfo } from './types';

async function limparPasta(pasta: string, esperados: Set<string>) {
  if (!existsSync(pasta)) return;

  const itens = await readdir(pasta);
  for (const item of itens) {
    if (item.endsWith('.dds') && !esperados.has(item)) {
      await rm(join(pasta, item));
      console.log(`  removido órfão: ${join(pasta, item)}`);
    }
  }
}

/** Apaga, na pasta de destino em mod/, qualquer .dds que não corresponda a um
 * PNG de origem — limpeza total, sem exceção (decisão explícita: preferimos
 * perder um retrato sem fonte a manter lixo não rastreável). */
export async function limparOrfaos(info: SpeciesInfo, pastaDestinoEspecie: string) {
  for (const [genero, arquivos] of Object.entries(info.arquivos)) {
    await limparPasta(join(pastaDestinoEspecie, genero), nomesNumerados(arquivos.length, '.dds'));
  }
}
