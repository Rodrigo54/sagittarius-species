/**
 * Gera scripts/vanilla-keys.json: um snapshot congelado das chaves reservadas
 * do Stellaris vanilla (army, ship_size, planet_class) usadas pra validar os
 * JSONs de name_lists antes de gerar o mod. Rode de novo manualmente quando o
 * jogo receber patch relevante (raro, já que o mod trava supported_version em
 * descriptor.mod). Mesma filosofia do FERRAMENTAS pinado em download-bin.ts:
 * reprodutibilidade > always-fresh.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { caminhoStellaris } from './shared/paths';
import { extrairIdiomas } from './shared/vanilla';

const __DIRNAME = dirname(fileURLToPath(import.meta.url));


const DESTINO = join(__DIRNAME, 'vanilla-keys.json');

async function listarTxt(pasta: string): Promise<string[]> {
  const itens = await readdir(pasta, { withFileTypes: true });
  return itens
    .filter((item) => item.isFile() && item.name.endsWith('.txt'))
    .map((item) => join(pasta, item.name));
}

async function extrairChavesDeNivelSuperior(
  pasta: string,
  filtro?: RegExp
): Promise<string[]> {
  const arquivos = await listarTxt(pasta);
  const chaves = new Set<string>();

  for (const arquivo of arquivos) {
    const conteudo = await readFile(arquivo, 'utf-8');
    const regex = /^([a-z][a-z_0-9]*)\s*=\s*\{/gm;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(conteudo))) {
      const chave = match[1];
      if (!filtro || filtro.test(chave)) {
        chaves.add(chave);
      }
    }
  }

  return Array.from(chaves).sort();
}

async function main() {
  const programa = new Command().name('bun run extract-vanilla')
    .description('Extrai chaves e idiomas da instalação do Stellaris.')
    .argument('[instalacao]', 'Pasta do Stellaris; padrão: STELLARIS_PATH do .env.').parse();
  const STELLARIS_PATH = caminhoStellaris(programa.args[0]);
  const languages = await extrairIdiomas(STELLARIS_PATH);
  const army = await extrairChavesDeNivelSuperior(
    join(STELLARIS_PATH, 'common/armies')
  );
  const shipSize = await extrairChavesDeNivelSuperior(
    join(STELLARIS_PATH, 'common/ship_sizes')
  );
  const planetClass = await extrairChavesDeNivelSuperior(
    join(STELLARIS_PATH, 'common/planet_classes'),
    /^pc_/
  );

  const snapshot = {
    _comment:
      'Gerado por scripts/extract-vanilla-keys.ts a partir da instalação local do Stellaris. Não editar à mão — rode "bun scripts/extract-vanilla-keys.ts" de novo pra atualizar.',
    generatedAt: new Date().toISOString(),
    stellarisPath: STELLARIS_PATH,
    army,
    shipSize,
    planetClass,
    languages,
  };

  await writeFile(DESTINO, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');

  console.log(
    `vanilla-keys.json gerado: ${army.length} army, ${shipSize.length} ship_size, ${planetClass.length} planet_class.`
  );
}

main().catch(erro => { console.error(erro instanceof Error ? erro.message : erro); process.exitCode = 1; });
