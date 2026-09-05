import type { Jomini, Writer } from 'jomini';
import { readFile } from 'node:fs/promises';
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
  /** Objeto ainda envolto por "{ [fileName]: {...} }" — é o que `gerarNameList`
   * espera (o .txt final precisa do wrapper "ssm_altmer={...}", e o prefixo
   * dos tokens de l10n vem justamente desse nível externo; sem ele, cada
   * name_list geraria os mesmos nomes de token, colidindo entre arquivos). */
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

/** Confere que nenhum arquivo repete o "ssm_<cultura>" de outro — o jogo
 * agrupa espécies-flavor por esse identificador, então uma colisão faria uma
 * cultura pisar silenciosamente na outra. */
export function detectarCulturasDuplicadas(itens: ParsedNameList[]): string[] {
  const erros: string[] = [];
  const vistos = new Set<string>();
  for (const item of itens) {
    if (vistos.has(item.fileName)) erros.push(`Cultura duplicada: ${item.fileName}`);
    vistos.add(item.fileName);
  }
  return erros;
}

export interface NameListGerada {
  txt: string;
  localizations: Record<string, string>;
}

/** Compõe todas as saídas em memória antes de qualquer escrita. */
export function gerarNameList(parser: Jomini, item: ParsedNameList, idiomas: string[]): NameListGerada {
  const tokens = new Map<string, string>();
  const tokenDe = (path: string[]) => path.join('_').toUpperCase();
  function coletar(valor: ValorClausewitz, path: string[]) {
    if (typeof valor === 'string' && valor.startsWith('l10n|')) {
      const token = tokenDe(path);
      if (tokens.has(token)) throw new Error(item.fileName + ': colisão de token ' + token);
      tokens.set(token, valor.replace(L10N, ''));
    } else if (typeof valor === 'object') {
      for (const [key, child] of Object.entries(valor)) coletar(child, [...path, key]);
    }
  }
  coletar(item.data, []);
  function escrever(writer: Writer, valor: ValorClausewitz, path: string[]) {
    if (Array.isArray(valor)) {
      writer.write_array_start();
      valor.forEach((child, i) => escrever(writer, child, [...path, String(i)]));
      writer.write_end();
    } else if (typeof valor === 'object') {
      writer.write_object_start();
      bloco(writer, valor, path);
      writer.write_end();
    } else if (typeof valor === 'string') {
      if (valor.startsWith('l10n|')) writer.write_unquoted(tokenDe(path));
      else writer.write_quoted(valor);
    } else if (typeof valor === 'number') writer.write_integer(valor);
    else writer.write_bool(valor);
  }
  function bloco(writer: Writer, valor: BlocoClausewitz, path: string[]) {
    for (const [key, child] of Object.entries(valor)) {
      writer.write_unquoted(key);
      escrever(writer, child, [...path, key]);
    }
  }
  const txt = new TextDecoder().decode(parser.write((writer: Writer) => bloco(writer, item.data, [])));
  const linhas = [
    '  name_list_' + item.fileName + ': ' + JSON.stringify(item.name),
    '  name_list_' + item.fileName + '_desc: ' + JSON.stringify(item.desc),
    ...Array.from(tokens, ([token, value]) => '  ' + token + ': ' + JSON.stringify(value)),
  ].join('\n') + '\n';
  return { txt, localizations: Object.fromEntries(idiomas.map(loc => [loc, '\uFEFFl_' + loc + ':\n\n' + linhas])) };
}
