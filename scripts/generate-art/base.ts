import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import {
  CAMPOS_POR_SECAO,
  ESTADOS_TORSO,
  ETNIAS,
  FORMAS_OLHO,
  GENEROS_PESSOA,
  validarSintaxeDeTemplate,
  type NomeDeSecao,
} from '../portrait-schema';

/** Schema de `base.json` — o arquivo é a fonte ÚNICA de texto de prompt do
 * pipeline: os fixos (estilo/pose/enquadramento/negativo), o template default
 * de cada seção, o vocabulário (texto de cada valor de enum, nos dois lados)
 * e a ordem em que tudo entra no prompt. Nenhuma frase de prompt mora em
 * TypeScript; `prompt-builder.ts` é só o motor que junta isso.
 *
 * O schema é construído a partir dos vocabulários de `portrait-schema`, e não
 * escrito à mão: cada enum exige **uma entrada por valor**, e `.strict()`
 * recusa entrada sobrando. Um valor novo em `ESTADOS_TORSO` (ou um valor
 * removido cujo texto ficou órfão) falha aqui, alto e claro, nomeando a
 * chave — em `bun test` e em toda execução de `bun run art`, inclusive
 * `-e/--export-prompt`, que nem toca na GPU. */

const zEntradaDeVocabulario = z
  .object({
    positive: z.string().min(1),
    /** Opcional porque nem todo valor tem oposto claro pra excluir:
     * `PartiallyCovered` é ambíguo de propósito, `Androgynous` é ambíguo por
     * natureza. */
    negative: z.string().min(1).optional(),
  })
  .strict();

/** Uma chave obrigatória por valor do enum — é isto que substitui o
 * `Record<(typeof ENUM)[number], string>` não-`Partial` que antes travava a
 * build quando um valor novo entrava sem texto. */
function zVocabularioCompleto(valores: readonly string[]) {
  return z
    .object(Object.fromEntries(valores.map((valor) => [valor, zEntradaDeVocabulario])))
    .strict() as z.ZodType<Record<string, z.infer<typeof zEntradaDeVocabulario>>>;
}

/** Caminhos cujo texto de prompt é TRADUÇÃO do valor, não o valor em si
 * (`"Male"` → `"man"`), e por isso exigem vocabulário completo. Os demais
 * campos (cores, idade, arquétipo) entram no prompt pelo próprio valor, em
 * minúsculas, e não têm entrada aqui. */
const VOCABULARIOS_OBRIGATORIOS = {
  'torso.state': ESTADOS_TORSO,
  'eyes.shape': FORMAS_OLHO,
  'person.ethnicity': ETNIAS,
  'person.gender': GENEROS_PESSOA,
} as const satisfies Record<string, readonly string[]>;

const CHAVES_FIXAS = ['style', 'view', 'pose', 'expression', 'negative'] as const;

const zTemplateValido = z.string().superRefine((texto, ctx) => {
  const erro = validarSintaxeDeTemplate(texto);
  if (erro) ctx.addIssue({ code: 'custom', message: erro });
});

const NOMES_DE_SECAO = Object.keys(CAMPOS_POR_SECAO) as NomeDeSecao[];

const zBaseArtBase = z
  .object({
    fixed: z.object(Object.fromEntries(CHAVES_FIXAS.map((chave) => [chave, z.string().min(1)]))).strict(),
    /** Um template default por seção — o que a espécie usa quando não declara
     * `template` própria naquela seção. */
    templates: z.object(Object.fromEntries(NOMES_DE_SECAO.map((secao) => [secao, zTemplateValido]))).strict(),
    vocabulary: z
      .object(
        Object.fromEntries(
          Object.entries(VOCABULARIOS_OBRIGATORIOS).map(([caminho, valores]) => [caminho, zVocabularioCompleto(valores)])
        )
      )
      .strict(),
    order: z
      .object({
        positive: z.array(z.string().min(1)),
        negative: z.array(z.string().min(1)),
      })
      .strict(),
  })
  .strict();

/** Toda entrada de `order` precisa apontar pra um texto que existe, e todo
 * texto declarado precisa aparecer em `order` — sem as duas pontas, um texto
 * afinado pode ficar órfão (nunca entra no prompt) ou uma posição pode
 * apontar pro vazio, os dois em silêncio. */
function validarOrdem(config: z.infer<typeof zBaseArtBase>, ctx: z.RefinementCtx): void {
  const entradasValidas = new Set<string>([
    ...CHAVES_FIXAS.map((chave) => `fixed.${chave}`),
    ...NOMES_DE_SECAO.flatMap((secao) => [`${secao}.template`, `${secao}.extra`]),
    ...Object.keys(config.vocabulary),
  ]);

  const declaradas = [...config.order.positive, ...config.order.negative];

  for (const entrada of declaradas) {
    if (!entradasValidas.has(entrada)) {
      ctx.addIssue({
        code: 'custom',
        path: ['order'],
        message: `"${entrada}" não corresponde a nenhum texto de base.json. Válidos: ${[...entradasValidas].sort().join(', ')}.`,
      });
    }
  }

  // Template e extra são texto positivo por construção — o negativo é uma
  // lista de exclusões, sem posição nem composição. Aceitá-los aqui daria a
  // falsa impressão de que dá pra escrever um template negativo por espécie.
  for (const entrada of config.order.negative) {
    if (entrada.endsWith('.template') || entrada.endsWith('.extra')) {
      ctx.addIssue({
        code: 'custom',
        path: ['order', 'negative'],
        message: `"${entrada}" não pode entrar no negativo — template/extra são texto positivo. O negativo aceita fixed.* e caminhos de vocabulário.`,
      });
    }
  }

  const posicionadas = new Set(declaradas);
  for (const entrada of entradasValidas) {
    if (!posicionadas.has(entrada)) {
      ctx.addIssue({
        code: 'custom',
        path: ['order'],
        message: `"${entrada}" tem texto declarado mas não aparece em order — ficaria órfão, sem nunca entrar no prompt.`,
      });
    }
  }
}

export const zBaseArt = zBaseArtBase.superRefine(validarOrdem);

export type BaseArt = z.infer<typeof zBaseArt>;
export type NomeDeFragmento = string;

const CAMINHO_BASE_JSON = join(import.meta.dir, 'base.json');

export function lerBaseArt(caminho: string = CAMINHO_BASE_JSON): BaseArt {
  return zBaseArt.parse(JSON.parse(readFileSync(caminho, 'utf8')));
}

/** Lido e validado uma vez, na primeira importação — falha rápido (erro
 * descritivo do zod) se o arquivo estiver malformado, em vez de deixar um
 * `undefined` silencioso vazar pro meio de um prompt composto depois. */
export const BASE_ART: BaseArt = lerBaseArt();
