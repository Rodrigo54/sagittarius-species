import { readFile } from 'node:fs/promises';
import type { VanillaKeys } from './types';

const IGNORED_SHIP_SIZE_KEYS = new Set(['generic']);
const IGNORED_ARMY_KEYS = new Set(['generic', 'general']);
const IGNORED_PLANET_KEYS = new Set(['generic']);

export async function loadVanillaKeys(path: string): Promise<VanillaKeys> {
  const raw = await readFile(path, 'utf-8');
  const parsed = JSON.parse(raw);
  return {
    army: parsed.army,
    shipSize: parsed.shipSize,
    planetClass: parsed.planetClass,
  };
}

function validateReservedKeys(
  obj: Record<string, unknown> | undefined,
  whitelist: string[],
  ignored: Set<string>,
  fieldLabel: string,
  context: string,
  errors: string[]
) {
  if (!obj) return;
  for (const key of Object.keys(obj)) {
    if (ignored.has(key)) continue;
    if (!whitelist.includes(key)) {
      errors.push(
        `[${context}] "${key}" não é uma chave válida de ${fieldLabel} (não existe no vanilla instalado).`
      );
    }
  }
}

function validateSequentialNames(
  obj: any,
  context: string,
  errors: string[],
  path = ''
) {
  if (!obj || typeof obj !== 'object') return;
  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (key === 'sequential_name') {
      if (typeof value !== 'string' || !value.startsWith('l10n|')) {
        errors.push(
          `[${context}] "${currentPath}" precisa ter o prefixo "l10n|" — sequential_name só funciona via localisation desde o patch 3.6, string literal falha silenciosamente em jogo.`
        );
      }
    } else if (value && typeof value === 'object') {
      validateSequentialNames(value, context, errors, currentPath);
    }
  }
}

/** Valida um corpo de name_list (o objeto de dentro de "ssm_<cultura>") contra
 * as chaves reservadas do vanilla e a regra de sequential_name. Retorna a
 * lista de erros (vazia se tudo ok) — não lança, pra permitir acumular todos
 * os erros de todos os arquivos antes de decidir travar a geração. */
export function validateNameList(
  data: any,
  vanillaKeys: VanillaKeys,
  context: string
): string[] {
  const errors: string[] = [];

  validateReservedKeys(
    data.ship_names,
    vanillaKeys.shipSize,
    IGNORED_SHIP_SIZE_KEYS,
    'ship_size',
    context,
    errors
  );
  validateReservedKeys(
    data.ship_class_names,
    vanillaKeys.shipSize,
    IGNORED_SHIP_SIZE_KEYS,
    'ship_size',
    context,
    errors
  );
  validateReservedKeys(
    data.army_names,
    vanillaKeys.army,
    IGNORED_ARMY_KEYS,
    'army',
    context,
    errors
  );
  validateReservedKeys(
    data.planet_names,
    vanillaKeys.planetClass,
    IGNORED_PLANET_KEYS,
    'planet_class',
    context,
    errors
  );

  validateSequentialNames(data, context, errors);

  return errors;
}
