import type { Jomini, Writer } from 'jomini';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PortraitClassMap } from './portrait-map';
import { resolveSpeciesClass } from './portrait-map';
import type { SpeciesNameEntry } from './types';

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

/** Resolve species_class de cada entrada (via portrait, com override nos
 * casos ambíguos) e valida unicidade global da chave `key` entre todos os
 * JSONs. Não lança — devolve os erros pra quem chama decidir quando travar a
 * geração, permitindo acumular erros de todas as fontes numa única mensagem. */
export function resolveSpeciesNames(
  sources: SpeciesNameSource[],
  portraitMap: PortraitClassMap
): { resolved: ResolvedSpeciesEntry[]; errors: string[] } {
  const resolved: ResolvedSpeciesEntry[] = [];
  const keyOwners = new Map<string, string>();
  const errors: string[] = [];

  for (const source of sources) {
    for (const entry of source.entries) {
      const context = `${source.fileName}.species_names.${entry.key}`;

      const previousOwner = keyOwners.get(entry.key);
      if (previousOwner) {
        errors.push(
          `Chave "${entry.key}" duplicada: definida em "${previousOwner}" e em "${source.fileName}" — precisa ser única entre todos os name_lists.`
        );
        continue;
      }
      keyOwners.set(entry.key, source.fileName);

      const { value: speciesClass, error } = resolveSpeciesClass(
        entry.portrait,
        entry.species_class,
        portraitMap,
        context
      );
      if (error) {
        errors.push(error);
        continue;
      }

      resolved.push({
        key: entry.key,
        name: entry.name,
        plural: entry.plural,
        home_planet: entry.home_planet,
        home_system: entry.home_system,
        name_list: source.fileName,
        species_class: speciesClass!,
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
  const byClass = new Map<string, ResolvedSpeciesEntry[]>();
  for (const entry of entries) {
    if (!byClass.has(entry.species_class)) {
      byClass.set(entry.species_class, []);
    }
    byClass.get(entry.species_class)!.push(entry);
  }

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
