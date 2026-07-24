import type { Jomini, Writer } from 'jomini';
import { isPlainObject, toUpper } from 'lodash';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { listar } from '../utils';
import type { SpeciesNameEntry } from './types';

const L10N = /^l10n\|/;

export interface ParsedNameList {
  name: string;
  desc: string;
  fileName: string;
  /** Objeto ainda envolto por "{ [fileName]: {...} }" — é o que createTXT e
   * createTranslation esperam (o .txt final precisa do wrapper
   * "ssm_altmer={...}", e o prefixo dos tokens de l10n vem justamente desse
   * nível externo; sem ele, cada name_list geraria os mesmos nomes de token,
   * colidindo entre arquivos). */
  data: any;
  /** O mesmo conteúdo, mas desembrulhado (data[fileName]) — mais conveniente
   * pra validação, que referencia campos como ship_names/army_names direto. */
  body: any;
  speciesNames: SpeciesNameEntry[];
}

/** species_names e _meta ficam como chaves irmãs de "name"/"desc"/"ssm_<cultura>"
 * no JSON de origem — nunca dentro do corpo do name_list, pra não vazar pro
 * ssm_<cultura>.txt (esse arquivo não aceita essas chaves no schema).
 * `_meta` é só um registro de instruções (tema/quantidade-alvo por aspecto)
 * pra skill `/gerar-name-list` reusar em aprimoramentos futuros — o gerador
 * ignora o conteúdo, só precisa removê-lo antes de escrever o .txt. */
export function parseNameListFile(raw: any): ParsedNameList {
  const clonedData = structuredClone(raw);
  const { name, desc, species_names } = clonedData;
  delete clonedData.name;
  delete clonedData.desc;
  delete clonedData.species_names;
  delete clonedData._meta;

  const [fileName] = Object.keys(clonedData);

  return {
    name,
    desc,
    fileName: fileName!,
    data: clonedData,
    body: clonedData[fileName!],
    speciesNames: species_names ?? [],
  };
}

export async function loadNameListFiles(pasta: string): Promise<string[]> {
  const { arquivos } = await listar(pasta, '.json');
  return arquivos;
}

export async function readNameList(arquivo: string): Promise<ParsedNameList> {
  const fileContent = await readFile(arquivo, 'utf-8');
  const raw = JSON.parse(fileContent);
  return parseNameListFile(raw);
}

export async function loadLocalization(
  pastaDestinoL10n: string
): Promise<string[]> {
  const { pastas } = await listar(pastaDestinoL10n);
  const localizations = Array.from(
    new Set(
      pastas.map((pasta) =>
        pasta
          .replace(pastaDestinoL10n, '')
          .replace('\\name_lists', '')
          .replace('\\', '')
      )
    )
  );
  return localizations;
}

export async function createTranslation(
  objectData: any,
  metaData: { name: string; desc: string; fileName: string; l10n: string },
  pastaDestinoL10n: string
): Promise<[string, any][]> {
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

  await writeFile(
    join(pastaDestinoL10n, l10n, 'name_lists', `${fileName}_l_${l10n}.yml`),
    '﻿' + content,
    'utf8'
  );

  return TokensNames;
}

export async function createTXT(
  parser: Jomini,
  objectData: any,
  tokens: [string, any][],
  fileName: string,
  pastaDestino: string
) {
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

  const content = parser.write((writer: Writer) => make(writer, objectData));
  await writeFile(join(pastaDestino, `${fileName}.txt`), content);
}
