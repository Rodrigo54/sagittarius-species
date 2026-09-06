import { Jomini } from 'jomini';
import { mkdir, writeFile } from 'node:fs/promises';
import { Command } from 'commander';
import { limparNamesOrfaos } from './sync';
import { join } from 'node:path';
import { PASTA_RAIZ, PASTA_MOD } from '../shared/paths';
import { detectarCulturasDuplicadas, gerarNameList, loadNameListFiles, readNameList } from './name-lists';
import {
  resolveSpeciesNames,
  writeSpeciesNamesFile,
  type SpeciesNameSource,
} from './species-names';
import { validateNameList } from './validation';
import { loadVanillaKeys } from '../shared/vanilla';

const PASTA_ASSETS = join(PASTA_RAIZ, 'assets/name_lists');
const PASTA_NAME_LISTS = join(PASTA_MOD, 'common/name_lists');
const PASTA_SPECIES_NAMES = join(PASTA_MOD, 'common/species_names');
const PASTA_L10N = join(PASTA_MOD, 'localisation');
const VANILLA_KEYS_PATH = join(PASTA_RAIZ, 'scripts/vanilla-keys.json');

async function main() {
  new Command().name('bun run names').description('Gera listas de nomes e localização; remove saídas de culturas excluídas.').parse();
  const parser = await Jomini.initialize();
  const vanillaKeys = await loadVanillaKeys(VANILLA_KEYS_PATH);
  const localizations = vanillaKeys.languages;
  const arquivos = await loadNameListFiles(PASTA_ASSETS);

  const parsed = await Promise.all(
    arquivos.map((arquivo) => readNameList(arquivo))
  );

  // Passo 1: valida tudo antes de escrever qualquer arquivo — erro trava a
  // geração sem deixar o mod num estado parcialmente atualizado.
  const validationErrors: string[] = [...detectarCulturasDuplicadas(parsed)];
  for (const item of parsed) {
    validationErrors.push(
      ...validateNameList(item.body, vanillaKeys, item.fileName)
    );
  }

  const speciesSources: SpeciesNameSource[] = parsed.map((item) => ({
    fileName: item.fileName,
    entries: item.speciesNames,
  }));
  const { resolved: resolvedSpecies, errors: speciesErrors } =
    resolveSpeciesNames(speciesSources);
  validationErrors.push(...speciesErrors);

  if (validationErrors.length > 0) {
    console.error(
      `${validationErrors.length} erro(s) de validação encontrado(s) — nada foi escrito:`
    );
    for (const err of validationErrors) console.error(` - ${err}`);
    process.exit(1);
  }

  const geradas = parsed.map(item => ({ item, saida: gerarNameList(parser, item, localizations) }));
  await mkdir(PASTA_NAME_LISTS, { recursive: true });
  await mkdir(PASTA_SPECIES_NAMES, { recursive: true });
  for (const loc of localizations) await mkdir(join(PASTA_L10N, loc, 'name_lists'), { recursive: true });
  for (const { item, saida } of geradas) {
    await writeFile(join(PASTA_NAME_LISTS, item.fileName + '.txt'), saida.txt);
    for (const [loc, texto] of Object.entries(saida.localizations)) {
      await writeFile(join(PASTA_L10N, loc, 'name_lists', item.fileName + '_l_' + loc + '.yml'), texto);
    }
  }

  // Passo 3: escreve o species_names.txt agregado.
  await writeSpeciesNamesFile(resolvedSpecies, parser, PASTA_SPECIES_NAMES);

  await limparNamesOrfaos(PASTA_NAME_LISTS, PASTA_L10N, parsed.map(item => item.fileName));

  console.log(
    `Gerado: ${parsed.length} name_list(s), ${resolvedSpecies.length} species_names.`
  );
}

main().catch(erro => { console.error('Falha na geração de nomes: ' + (erro instanceof Error ? erro.message : erro)); process.exitCode = 1; });
