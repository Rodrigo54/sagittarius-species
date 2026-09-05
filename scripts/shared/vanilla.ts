import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
const idiomas = z.array(z.string().regex(/^[a-z][a-z_]*$/)).nonempty()
  .refine(v => new Set(v).size === v.length, 'Idiomas duplicados no snapshot.')
  .refine(v => v.includes('braz_por'), 'O snapshot precisa incluir braz_por.');
const zVanillaKeys = z.object({
  army: z.array(z.string()).nonempty(), shipSize: z.array(z.string()).nonempty(),
  planetClass: z.array(z.string()).nonempty(), languages: idiomas,
});
export type VanillaKeys = z.infer<typeof zVanillaKeys>;
export async function loadVanillaKeys(path: string): Promise<VanillaKeys> {
  const result = zVanillaKeys.safeParse(JSON.parse(await readFile(path, 'utf8')));
  if (!result.success) throw new Error(path + ': snapshot inválido. Rode bun run extract-vanilla.\n' + result.error.message);
  return result.data;
}
/** Diretórios de idioma com arquivos de localização do próprio jogo. */
export async function extrairIdiomas(pastaJogo: string): Promise<string[]> {
  const pasta = join(pastaJogo, 'localisation');
  const entries = await readdir(pasta, { withFileTypes: true });
  const encontrados: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !/^[a-z][a-z_]*$/.test(entry.name)) continue;
    const arquivos = await readdir(join(pasta, entry.name), { withFileTypes: true });
    if (arquivos.some(f => f.isFile() && f.name.endsWith('_l_' + entry.name + '.yml'))) encontrados.push(entry.name);
  }
  return idiomas.parse(encontrados.sort());
}
