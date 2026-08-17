import { Jomini } from 'jomini';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createTranslation,
  createTXT,
  loadLocalization,
  loadNameListFiles,
  readNameList,
} from './name-lists';
import {
  resolveSpeciesNames,
  writeSpeciesNamesFile,
  type SpeciesNameSource,
} from './species-names';
import { loadVanillaKeys, validateNameList } from './validation';

const __DIRNAME = dirname(fileURLToPath(import.meta.url));

const PASTA_ASSETS = join(__DIRNAME, '../../assets/name_lists');
const PASTA_MOD = join(__DIRNAME, '../../mod/sagittarius-species');
const PASTA_NAME_LISTS = join(PASTA_MOD, 'common/name_lists');
const PASTA_SPECIES_NAMES = join(PASTA_MOD, 'common/species_names');
const PASTA_L10N = join(PASTA_MOD, 'localisation');
const VANILLA_KEYS_PATH = join(__DIRNAME, '../vanilla-keys.json');

async function main() {
  const parser = await Jomini.initialize();
  const vanillaKeys = await loadVanillaKeys(VANILLA_KEYS_PATH);
  const localizations = await loadLocalization(PASTA_L10N);
  const arquivos = await loadNameListFiles(PASTA_ASSETS);

  const parsed = await Promise.all(
    arquivos.map((arquivo) => readNameList(arquivo))
  );

  // Passo 1: valida tudo antes de escrever qualquer arquivo — erro trava a
  // geração sem deixar o mod num estado parcialmente atualizado.
  const validationErrors: string[] = [];
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

  // Passo 2: escreve name_lists (.txt + .yml por idioma).
  for (const item of parsed) {
    for (const loc of localizations) {
      const tokens = await createTranslation(
        item.data,
        { name: item.name, desc: item.desc, fileName: item.fileName, l10n: loc },
        PASTA_L10N
      );
      if (loc === 'braz_por') {
        await createTXT(
          parser,
          item.data,
          tokens,
          item.fileName,
          PASTA_NAME_LISTS
        );
      }
    }
  }

  // Passo 3: escreve o species_names.txt agregado.
  await writeSpeciesNamesFile(resolvedSpecies, parser, PASTA_SPECIES_NAMES);

  console.log(
    `Gerado: ${parsed.length} name_list(s), ${resolvedSpecies.length} species_names.`
  );
}

main();
