import type { Jomini, Writer } from 'jomini';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { zNameList } from '../name-list-schema';
import { listar } from '../utils';
import {
  comoBloco,
  type BlocoClausewitz,
  type SpeciesNameEntry,
  type ValorClausewitz,
} from './types';

const L10N = /^l10n\|/;

/** O JSON de origem de uma cultura: metadados de localização, as espécies-flavor
 * e — sob uma chave `ssm_<cultura>` — o corpo do name_list em si. */
interface ArquivoNameList {
  [chave: string]: ValorClausewitz | SpeciesNameEntry[] | undefined;
  name: string;
  desc: string;
  species_names?: SpeciesNameEntry[];
}

export interface ParsedNameList {
  name: string;
  desc: string;
  fileName: string;
  /** Objeto ainda envolto por "{ [fileName]: {...} }" — é o que createTXT e
   * createTranslation esperam (o .txt final precisa do wrapper
   * "ssm_altmer={...}", e o prefixo dos tokens de l10n vem justamente desse
   * nível externo; sem ele, cada name_list geraria os mesmos nomes de token,
   * colidindo entre arquivos). */
  data: BlocoClausewitz;
  /** O mesmo conteúdo, mas desembrulhado (data[fileName]) — mais conveniente
   * pra validação, que referencia campos como ship_names/army_names direto. */
  body: BlocoClausewitz;
  speciesNames: SpeciesNameEntry[];
}

/** species_names e _meta ficam como chaves irmãs de "name"/"desc"/"ssm_<cultura>"
 * no JSON de origem — nunca dentro do corpo do name_list, pra não vazar pro
 * ssm_<cultura>.txt (esse arquivo não aceita essas chaves no schema).
 * `_meta` é só um registro de instruções (tema/quantidade-alvo por aspecto)
 * pra skill `/gerar-name-list` reusar em aprimoramentos futuros — o gerador
 * ignora o conteúdo, só precisa removê-lo antes de escrever o .txt. */
function parseNameListFile(raw: ArquivoNameList): ParsedNameList {
  const { name, desc, species_names } = raw;

  const clonedData = structuredClone(raw) as Record<string, unknown>;
  delete clonedData.name;
  delete clonedData.desc;
  delete clonedData.species_names;
  delete clonedData._meta;

  const data = clonedData as BlocoClausewitz;
  const [fileName] = Object.keys(data);
  if (fileName === undefined) {
    throw new Error(`name_list sem a chave "ssm_<cultura>" que carrega o corpo: ${name}`);
  }

  const body = comoBloco(data[fileName]);
  if (!body) {
    throw new Error(`"${fileName}" precisa ser um bloco { ... } com o corpo do name_list`);
  }

  return { name, desc, fileName, data, body, speciesNames: species_names ?? [] };
}

export async function loadNameListFiles(pasta: string): Promise<string[]> {
  const { arquivos } = await listar(pasta, '.json');
  return arquivos;
}

/** Lê e valida o JSON contra o schema `zod` de `name-list-schema/` — único
 * ponto de carga desses arquivos, então validar aqui cobre o pipeline inteiro.
 * Cobre a FORMA (metadados, espécies-flavor, quais seções o corpo tem); o que
 * depende do vanilla instalado (chaves de ship_size/army/planet_class,
 * `sequential_name`) fica com `validation.ts`. */
export async function readNameList(arquivo: string): Promise<ParsedNameList> {
  const fileContent = await readFile(arquivo, 'utf-8');
  const resultado = zNameList.safeParse(JSON.parse(fileContent));
  if (!resultado.success) {
    const nome = basename(arquivo);
    throw new Error(
      resultado.error.issues
        .map((issue) => `${nome} — ${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
        .join('\n')
    );
  }
  return parseNameListFile(resultado.data as ArquivoNameList);
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

/** Par token → texto: a chave que vai pro `.yml` e o texto que o jogo mostra. */
type TokenL10n = [token: string, texto: string];

/** Achata o objeto em pares token→texto, um por string prefixada com `l10n|`.
 * O token é o caminho inteiro em MAIÚSCULAS, e é por isso que o wrapper
 * `ssm_<cultura>` precisa estar presente: ele é o prefixo que separa os
 * tokens de uma cultura dos de outra. */
function achatarTokens(bloco: BlocoClausewitz, prefix = ''): TokenL10n[] {
  const tokens: TokenL10n[] = [];

  for (const [key, value] of Object.entries(bloco)) {
    const newKey = `${prefix}${prefix ? '_' : ''}${key}`.toUpperCase();
    if (typeof value === 'object' && value !== null) {
      tokens.push(...achatarTokens(value as BlocoClausewitz, newKey));
    } else if (typeof value === 'string' && value.startsWith('l10n|')) {
      tokens.push([newKey, value.replace(L10N, '')]);
    }
  }

  return tokens;
}

export async function createTranslation(
  objectData: BlocoClausewitz,
  metaData: { name: string; desc: string; fileName: string; l10n: string },
  pastaDestinoL10n: string
): Promise<TokenL10n[]> {
  const { name, desc, fileName, l10n } = metaData;
  const tokens = achatarTokens(objectData);

  const content =
    `l_${l10n}:\n\n` +
    `  name_list_${fileName}: ${JSON.stringify(name)}\n` +
    `  name_list_${fileName}_desc: ${JSON.stringify(desc)}\n` +
    tokens.map(([token, value]) => `  ${token}: "${value}"`).join('\n');

  await writeFile(
    join(pastaDestinoL10n, l10n, 'name_lists', `${fileName}_l_${l10n}.yml`),
    '﻿' + content,
    'utf8'
  );

  return tokens;
}

/** Uma string prefixada com `l10n|` é escrita como o token correspondente (sem
 * aspas — o jogo resolve pela localisation); qualquer outra vai entre aspas,
 * literal. */
function escreverString(writer: Writer, valor: string, tokens: TokenL10n[]) {
  if (!valor.startsWith('l10n|')) {
    writer.write_quoted(valor);
    return;
  }
  const texto = valor.replace(L10N, '');
  const token = tokens.find(([, tokenTexto]) => tokenTexto === texto)?.[0];
  if (token) writer.write_unquoted(token);
}

function escreverValor(writer: Writer, valor: ValorClausewitz, tokens: TokenL10n[]) {
  if (Array.isArray(valor)) {
    writer.write_array_start();
    for (const item of valor) escreverValor(writer, item, tokens);
    writer.write_end();
    return;
  }
  if (typeof valor === 'object') {
    writer.write_object_start();
    escreverBloco(writer, valor, tokens);
    writer.write_end();
    return;
  }
  if (typeof valor === 'string') {
    escreverString(writer, valor, tokens);
    return;
  }
  if (typeof valor === 'number') {
    writer.write_integer(valor);
    return;
  }
  if (typeof valor === 'boolean') {
    writer.write_bool(valor);
    return;
  }
  // Nada além dos tipos acima existe em script Clausewitz — um `null` no JSON
  // de origem sairia do arquivo em silêncio se isto não travasse aqui.
  throw new Error(`valor de tipo não serializável em name_list: ${JSON.stringify(valor)}`);
}

function escreverBloco(writer: Writer, bloco: BlocoClausewitz, tokens: TokenL10n[]) {
  for (const [key, value] of Object.entries(bloco)) {
    writer.write_unquoted(key);
    escreverValor(writer, value, tokens);
  }
}

export async function createTXT(
  parser: Jomini,
  objectData: BlocoClausewitz,
  tokens: TokenL10n[],
  fileName: string,
  pastaDestino: string
) {
  const content = parser.write((writer: Writer) => escreverBloco(writer, objectData, tokens));
  await writeFile(join(pastaDestino, `${fileName}.txt`), content);
}
