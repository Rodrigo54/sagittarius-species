import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { PASTA_RAIZ } from '../shared/paths';
import { gerarJsonSchema as portrait } from '../portrait-schema/gerar-json-schema';
import { gerarJsonSchema as promo } from '../promo-schema/gerar-json-schema';
import { gerarJsonSchema as names } from '../name-list-schema/gerar-json-schema';

export async function conferirSchemas(): Promise<string[]> {
  const erros: string[] = [];
  for (const [pasta, nome, gerar] of [
    ['portrait-schema', 'portrait', portrait], ['promo-schema', 'promo', promo], ['name-list-schema', 'name-list', names],
  ] as const) {
    const caminho = join(PASTA_RAIZ, 'scripts', pasta, nome + '.schema.json');
    try {
      if (!isDeepStrictEqual(JSON.parse(await readFile(caminho, 'utf8')), gerar())) {
        erros.push(caminho + ' desatualizado. Rode bun scripts/' + pasta + '/gerar-json-schema.ts');
      }
    } catch (erro) { erros.push(caminho + ': ' + (erro instanceof Error ? erro.message : erro)); }
  }
  return erros;
}
async function main() {
  new Command().name('bun run check:schemas').description('Confere os JSON Schemas sem reescrevê-los.').parse();
  const erros = await conferirSchemas();
  if (erros.length) throw new Error(erros.join('\n'));
  console.log('JSON Schemas consistentes.');
}
if (import.meta.main) main().catch(erro => { console.error(erro.message); process.exitCode = 1; });
