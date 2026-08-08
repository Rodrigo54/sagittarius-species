import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { zPortraitConfig } from './schema';

/** Gera `portrait.schema.json` a partir do schema `zod` (`z.toJSONSchema()`
 * nativo do zod v4 — ver rationale de não usar `zod-to-json-schema` em
 * `generate-art-migracao-schema-proprio.md`). O artefato é **derivado**,
 * nunca editado à mão — rode este script de novo (`bun
 * scripts/portrait-schema/gerar-json-schema.ts`) toda vez que `schema.ts`
 * mudar. Sem entrada no `package.json` de propósito: é um utilitário de
 * suporte, não um pipeline (mesmo padrão de `scripts/txt-to-json.ts`). */
const CAMINHO_SAIDA = join(import.meta.dir, 'portrait.schema.json');

const jsonSchema = z.toJSONSchema(zPortraitConfig, { target: 'draft-7' });
writeFileSync(CAMINHO_SAIDA, JSON.stringify(jsonSchema, null, 2) + '\n', 'utf8');
console.log('OK:', CAMINHO_SAIDA);
