import { comoBloco, type BlocoClausewitz } from './types';
import type { VanillaKeys } from '../shared/vanilla';

/** Chaves que o vanilla aceita mas não declara como bloco próprio, então não
 * aparecem no snapshot de `vanilla-keys.json` — não são erro de digitação. */
const IGNORADAS_POR_CAMPO = {
  ship_size: new Set(['generic']),
  army: new Set(['generic', 'general']),
  planet_class: new Set(['generic']),
} as const;

type CampoValidado = keyof typeof IGNORADAS_POR_CAMPO;


function validateReservedKeys(
  bloco: BlocoClausewitz | undefined,
  whitelist: string[],
  campo: CampoValidado,
  context: string,
  errors: string[]
) {
  if (!bloco) return;
  for (const key of Object.keys(bloco)) {
    if (IGNORADAS_POR_CAMPO[campo].has(key)) continue;
    if (!whitelist.includes(key)) {
      errors.push(
        `[${context}] "${key}" não é uma chave válida de ${campo} (não existe no vanilla instalado).`
      );
    }
  }
}

function validateSequentialNames(
  bloco: BlocoClausewitz,
  context: string,
  errors: string[],
  path = ''
) {
  for (const [key, value] of Object.entries(bloco)) {
    const currentPath = path ? `${path}.${key}` : key;
    if (key === 'sequential_name') {
      if (typeof value !== 'string' || !value.startsWith('l10n|')) {
        errors.push(
          `[${context}] "${currentPath}" precisa ter o prefixo "l10n|" — sequential_name só funciona via localisation desde o patch 3.6, string literal falha silenciosamente em jogo.`
        );
      }
      continue;
    }
    const aninhado = comoBloco(value);
    if (aninhado) validateSequentialNames(aninhado, context, errors, currentPath);
  }
}

/** Valida um corpo de name_list (o objeto de dentro de "ssm_<cultura>") contra
 * as chaves reservadas do vanilla e a regra de sequential_name. Retorna a
 * lista de erros (vazia se tudo ok) — não lança, pra permitir acumular todos
 * os erros de todos os arquivos antes de decidir travar a geração. */
export function validateNameList(
  data: BlocoClausewitz,
  vanillaKeys: VanillaKeys,
  context: string
): string[] {
  const errors: string[] = [];

  const porCampo: [chave: string, whitelist: string[], campo: CampoValidado][] = [
    ['ship_names', vanillaKeys.shipSize, 'ship_size'],
    ['ship_class_names', vanillaKeys.shipSize, 'ship_size'],
    ['army_names', vanillaKeys.army, 'army'],
    ['planet_names', vanillaKeys.planetClass, 'planet_class'],
  ];

  for (const [chave, whitelist, campo] of porCampo) {
    validateReservedKeys(comoBloco(data[chave]), whitelist, campo, context, errors);
  }

  validateSequentialNames(data, context, errors);

  return errors;
}
