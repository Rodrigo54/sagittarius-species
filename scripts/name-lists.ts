import type { Writer } from 'jomini';
import { Jomini } from 'jomini';
import { isPlainObject, toUpper } from 'lodash';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listar } from './utils';

const __DIRNAME = dirname(fileURLToPath(import.meta.url));
const L10N = new RegExp(/^l10n\|/);
const PARSER = await Jomini.initialize();
const PASTA_INICIAL = join(__DIRNAME, '../assets/name_lists');
const PASTA_DESTINO_LIST_NAME = join(
  __DIRNAME,
  '../mod/sagittarius-species/common/name_lists'
);

const PASTA_DESTINO_L10N = join(
  __DIRNAME,
  '../mod/sagittarius-species/localisation'
);

const getData = (data: any) => {
  const clonedData = structuredClone(data);
  const { name, desc } = clonedData;
  delete clonedData.name;
  delete clonedData.desc;

  const [fileName] = Object.keys(clonedData);

  return { name, desc, fileName, data: clonedData };
};

const loadFiles = async (pasta: string) => {
  const { arquivos } = await listar(pasta, '.json');
  return arquivos;
};

const readNameList = async (arquivo: string) => {
  const fileContent = await readFile(arquivo, 'utf-8');
  const data = JSON.parse(fileContent);
  return getData(data);
};

const createTXT = async (
  objectData: any,
  tokens: [string, any][],
  fileName: string
) => {
  const makeL10nToken = (writer: Writer, value: any) => {
    if (value.startsWith('l10n|')) {
      const newValue = value.replace(L10N, '');
      const token = tokens
        .find(([tokenKey, tokenValue]) => tokenValue === newValue)
        ?.at(0);
      if (token) {
        writer.write_unquoted(token);
      }
    } else {
      writer.write_quoted(value);
    }
  };

  const makeObject = (writer: Writer, [key, value]: [string, any]) => {
    if (isPlainObject(value)) {
      writer.write_unquoted(key);
      writer.write_object_start();
      make(writer, value);
      writer.write_end();
    }
  };

  const makeArray = (writer: Writer, [key, value]: [string, any]) => {
    if (Array.isArray(value)) {
      writer.write_unquoted(key);
      writer.write_array_start();
      value.forEach((item: string) => {
        if (typeof item === 'string') {
          makeL10nToken(writer, item);
        }
        if (typeof item === 'number') {
          writer.write_integer(item);
        }
      });
      writer.write_end();
    }
  };

  const makeNumber = (writer: Writer, [key, value]: [string, any]) => {
    if (typeof value === 'number') {
      writer.write_unquoted(key);
      writer.write_integer(value);
    }
  };

  const makeString = (writer: Writer, [key, value]: [string, any]) => {
    if (typeof value === 'string') {
      writer.write_unquoted(key);
      makeL10nToken(writer, value);
    }
  };

  const makeBoolean = (writer: Writer, [key, value]: [string, any]) => {
    if (typeof value === 'boolean') {
      writer.write_unquoted(key);
      writer.write_bool(value);
    }
  };

  const make = (writer: Writer, data: any) => {
    for (const [key, value] of Object.entries(data)) {
      makeObject(writer, [key, value]);
      makeArray(writer, [key, value]);
      makeNumber(writer, [key, value]);
      makeString(writer, [key, value]);
      makeBoolean(writer, [key, value]);
    }
  };

  const content = PARSER.write((writer: Writer) => make(writer, objectData));
  await writeFile(join(PASTA_DESTINO_LIST_NAME, `${fileName}.txt`), content);
};

const loadLocalization = async () => {
  const { pastas } = await listar(PASTA_DESTINO_L10N);
  const localizations = Array.from(
    new Set(
      pastas.map((pasta) =>
        pasta
          .replace(PASTA_DESTINO_L10N, '')
          .replace('\\name_lists', '')
          .replace('\\', '')
      )
    )
  );
  return localizations;
};

const createTranslation = async (objectData: any, metaData: any) => {
  const { name, desc, fileName, l10n } = metaData;
  const firstLine = `l_${l10n}:\n\n`;

  const flattenObject = (obj: any, prefix = ''): [string, any][] => {
    return Object.entries(obj).reduce((result, [key, value]) => {
      const newKey = toUpper(`${prefix}${prefix ? '_' : ''}${key}`);
      if (typeof value === 'object' && value !== null) {
        result.push(...flattenObject(value, newKey));
      } else if (typeof value === 'string') {
        if (value.startsWith('l10n|')) {
          const newValue = value.replace(L10N, '');
          result.push([newKey, newValue]);
        }
      }
      return result;
    }, [] as [string, any][]);
  };

  const TokensNames = flattenObject(objectData);

  const content =
    firstLine +
    `  name_list_${fileName}: ${JSON.stringify(name)}\n` +
    `  name_list_${fileName}_desc: ${JSON.stringify(desc)}\n` +
    TokensNames.map(([token, value]) => `  ${token}: "${value}"`).join('\n');

  const blob = Buffer.from('\uFEFF' + content, 'utf8');

  await writeFile(
    join(PASTA_DESTINO_L10N, l10n, 'name_lists', `${fileName}_l_${l10n}.yml`),
    blob
  );

  return TokensNames;
};

const processJsonNameList = async (arquivo: string) => {
  const localizations = await loadLocalization();

  for (const loc of localizations) {
    const { name, desc, fileName, data } = await readNameList(arquivo);
    const tokens = await createTranslation(data, {
      name,
      desc,
      fileName,
      l10n: loc,
    });
    if (loc === 'braz_por') {
      await createTXT(data, tokens, fileName);
    }
  }
};

const main = async () => {
  const arquivos = await loadFiles(PASTA_INICIAL);

  for (const arquivo of arquivos) {
    await processJsonNameList(arquivo);
  }
};

main();
