import type { Jomini, Writer } from 'jomini';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SpeciesNameEntry } from '../name-list-schema';

export interface SpeciesNameSource {
  /** id do name_list de origem (ex.: "ssm_altmer"), usado como campo
   * name_list de cada espécie e como rótulo em mensagens de erro. */
  fileName: string;
  entries: SpeciesNameEntry[];
}

export interface ResolvedSpeciesEntry {
  key: string;
  name: string;
  plural: string;
  home_planet?: string;
  home_system?: string;
  name_list: string;
  species_class: string;
}

/** Junta as espécies-flavor de todas as culturas e valida a unicidade global
 * da chave `key` — o jogo agrupa as entradas por ela, então duas culturas
 * declarando a mesma chave sobrescreveriam uma à outra em silêncio.
 *
 * A `species_class` vem declarada em cada entrada (validada pelo schema); não
 * há dedução a partir do portrait, porque `species_names` não tem vínculo
 * nenhum com retrato — o jogo sorteia espécie-flavor e retrato separadamente,
 * dentro da classe. Não lança: devolve os erros pra quem chama acumular tudo
 * numa mensagem só. */
export function resolveSpeciesNames(
  sources: SpeciesNameSource[]
): { resolved: ResolvedSpeciesEntry[]; errors: string[] } {
  const resolved: ResolvedSpeciesEntry[] = [];
  const keyOwners = new Map<string, string>();
  const errors: string[] = [];

  for (const source of sources) {
    for (const entry of source.entries) {
      const previousOwner = keyOwners.get(entry.key);
      if (previousOwner) {
        errors.push(
          `Chave "${entry.key}" duplicada: definida em "${previousOwner}" e em "${source.fileName}" — precisa ser única entre todos os name_lists.`
        );
        continue;
      }
      keyOwners.set(entry.key, source.fileName);

      resolved.push({
        key: entry.key,
        name: entry.name,
        plural: entry.plural,
        home_planet: entry.home_planet,
        home_system: entry.home_system,
        name_list: source.fileName,
        species_class: entry.species_class,
      });
    }
  }

  return { resolved, errors };
}

export async function writeSpeciesNamesFile(
  entries: ResolvedSpeciesEntry[],
  parser: Jomini,
  destino: string
) {
  const byClass = Map.groupBy(entries, (entry) => entry.species_class);
  const classesOrdenadas = Array.from(byClass.keys()).sort();

  const content = parser.write((writer: Writer) => {
    for (const speciesClass of classesOrdenadas) {
      writer.write_unquoted(speciesClass);
      writer.write_object_start();

      for (const entry of byClass.get(speciesClass)!) {
        writer.write_unquoted(entry.key);
        writer.write_object_start();

        writer.write_unquoted('name');
        writer.write_quoted(entry.name);

        writer.write_unquoted('plural');
        writer.write_quoted(entry.plural);

        if (entry.home_planet) {
          writer.write_unquoted('home_planet');
          writer.write_quoted(entry.home_planet);
        }

        if (entry.home_system) {
          writer.write_unquoted('home_system');
          writer.write_quoted(entry.home_system);
        }

        writer.write_unquoted('name_list');
        writer.write_quoted(entry.name_list);

        writer.write_end();
      }

      writer.write_end();
    }
  });

  await writeFile(join(destino, 'ssm_species_names.txt'), content);
}
