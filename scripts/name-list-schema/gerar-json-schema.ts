import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { zNameList } from './schema';

/** Gera `name-list.schema.json` a partir do schema `zod` (`z.toJSONSchema()`
 * nativo do zod v4). O artefato é **derivado**, nunca editado à mão — rode
 * este script de novo (`bun scripts/name-list-schema/gerar-json-schema.ts`)
 * toda vez que `schema.ts` mudar. Sem entrada no `package.json` de propósito:
 * é utilitário de suporte, não pipeline. Mesmo desenho de
 * `scripts/portrait-schema/gerar-json-schema.ts`. */
const CAMINHO_SAIDA = join(import.meta.dir, 'name-list.schema.json');

export function gerarJsonSchema() {
  const jsonSchema = z.toJSONSchema(zNameList, { target: 'draft-7', io: 'input' });
  
  return jsonSchema;
}

if (import.meta.main) {
  writeFileSync(CAMINHO_SAIDA, JSON.stringify(gerarJsonSchema(), null, 2) + '\n', 'utf8');
  console.log('OK:', CAMINHO_SAIDA);
}
