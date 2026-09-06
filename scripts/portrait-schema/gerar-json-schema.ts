import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { zPortraitConfig } from './schema';
import { ANCORAS_VERTICAIS, ANCORAS_VERTICAIS_DESCRICOES, ESTADOS_TORSO, ESTADOS_TORSO_DESCRICOES, ESTILOS_CABELO, ESTILOS_CABELO_DESCRICOES, FORMAS_CORPO, FORMAS_CORPO_DESCRICOES, FORMAS_OLHO, FORMAS_OLHO_DESCRICOES, MODOS_ENQUADRAMENTO, MODOS_ENQUADRAMENTO_DESCRICOES, ARQUETIPOS, ARQUETIPOS_DESCRICOES } from './vocabulario';
import { CATEGORIAS_DESCRICOES, CATEGORIAS_VALIDAS, SPECIES_CLASSES_DESCRICOES, SPECIES_CLASSES_VALIDAS } from '../shared/stellaris';

/** Gera `portrait.schema.json` a partir do schema `zod` (`z.toJSONSchema()`
 * nativo do zod v4 — ver rationale de não usar `zod-to-json-schema` em
 * `docs/history/2026-08-08-generate-art-schema-proprio.md`). O artefato é **derivado**,
 * nunca editado à mão — rode este script de novo (`bun
 * scripts/portrait-schema/gerar-json-schema.ts`) toda vez que `schema.ts`
 * mudar. Sem entrada no `package.json` de propósito: é um utilitário de
 * suporte, não um pipeline. */
const CAMINHO_SAIDA = join(import.meta.dir, 'portrait.schema.json');

/** Vocabulários com descrição por valor em português (mapas `_DESCRICOES`
 * em `vocabulario.ts`) — usados por `injetarEnumDescriptions` abaixo pra
 * decorar cada nó `enum` do JSON Schema gerado. */
const VOCABULARIOS_COM_DESCRICAO: ReadonlyArray<{ valores: readonly string[]; descricoes: Record<string, string> }> = [
  { valores: ESTILOS_CABELO, descricoes: ESTILOS_CABELO_DESCRICOES },
  { valores: FORMAS_OLHO, descricoes: FORMAS_OLHO_DESCRICOES },
  { valores: ARQUETIPOS, descricoes: ARQUETIPOS_DESCRICOES },
  { valores: ESTADOS_TORSO, descricoes: ESTADOS_TORSO_DESCRICOES },
  { valores: FORMAS_CORPO, descricoes: FORMAS_CORPO_DESCRICOES },
  { valores: ANCORAS_VERTICAIS, descricoes: ANCORAS_VERTICAIS_DESCRICOES },
  { valores: MODOS_ENQUADRAMENTO, descricoes: MODOS_ENQUADRAMENTO_DESCRICOES },
  { valores: SPECIES_CLASSES_VALIDAS, descricoes: SPECIES_CLASSES_DESCRICOES },
  { valores: CATEGORIAS_VALIDAS, descricoes: CATEGORIAS_DESCRICOES },
];

/** Percorre recursivamente o JSON Schema gerado e, em todo nó com `enum`
 * cujo conjunto de valores bate exatamente com um dos vocabulários acima,
 * injeta `enumDescriptions` (mesma ordem do `enum` do nó) — chave
 * reconhecida pelo language service de JSON do VS Code (mesmo mecanismo do
 * enum de `settings.json`) pra mostrar a descrição de cada valor no hover e
 * na lista de autocomplete, além da descrição do campo inteiro que
 * `.describe()` (em `schema.ts`) já produz via `description`. `z.enum` não
 * gera esse artefato: não existe descrição por valor nativa no Zod, daí o
 * pós-processamento aqui em vez de expressar isso no schema `zod` em si. */
function injetarEnumDescriptions(node: unknown): void {
  if (Array.isArray(node)) {
    for (const item of node) injetarEnumDescriptions(item);
    return;
  }
  if (node === null || typeof node !== 'object') return;

  const objeto = node as Record<string, unknown>;
  const valoresEnum = objeto.enum;
  if (Array.isArray(valoresEnum) && valoresEnum.length > 0 && valoresEnum.every((v) => typeof v === 'string')) {
    const enumValores = valoresEnum as string[];
    const vocabulario = VOCABULARIOS_COM_DESCRICAO.find(
      (v) => v.valores.length === enumValores.length && v.valores.every((valor) => enumValores.includes(valor))
    );
    if (vocabulario) {
      objeto.enumDescriptions = enumValores.map((valor) => vocabulario.descricoes[valor]);
    }
  }

  for (const valor of Object.values(objeto)) injetarEnumDescriptions(valor);
}

export function gerarJsonSchema() {
  const jsonSchema = z.toJSONSchema(zPortraitConfig, { target: 'draft-7' });
  injetarEnumDescriptions(jsonSchema);
  return jsonSchema;
}

if (import.meta.main) {
  writeFileSync(CAMINHO_SAIDA, JSON.stringify(gerarJsonSchema(), null, 2) + '\n', 'utf8');
  console.log('OK:', CAMINHO_SAIDA);
}
