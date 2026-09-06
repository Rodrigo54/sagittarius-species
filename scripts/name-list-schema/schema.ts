import { z } from 'zod';
import { SPECIES_CLASSES_VALIDAS } from '../shared/stellaris';

/** Fonte de verdade do formato de `assets/name_lists/<cultura>.json` — schema
 * `zod`, com tipos TS inferidos no fim do arquivo. Mesmo desenho de
 * `scripts/portrait-schema/`: o JSON Schema (`.json`) é artefato **derivado**
 * (`gerar-json-schema.ts`), nunca editado à mão, e serve o autocomplete do VS
 * Code via `json.schemas` no `.vscode/settings.json`.
 *
 * Convenção de idioma (CLAUDE.md): chaves em inglês, `.describe(...)` em
 * português — é o texto que aparece no IntelliSense ao editar o arquivo.
 *
 * **O que este schema valida, e o que não.** A estrutura é fechada: os
 * metadados da cultura, as espécies-flavor e **quais seções** o corpo do
 * name_list pode ter. O conteúdo de cada seção continua aberto (`ValorClausewitz`
 * recursivo), porque é script Clausewitz livre — cada cultura declara os
 * aspectos que quiser, e enumerar esse vocabulário aqui duplicaria a validação
 * dinâmica de `generate-names/validation.ts`, que confere as chaves contra o
 * vanilla instalado (`scripts/vanilla-keys.json`) e acompanha os patches da
 * Paradox. O ganho concreto é pegar seção escrita errado (`army_name` em vez
 * de `army_names`), que hoje vira bloco lixo no `.txt` e só o jogo reclama. */

/** Um valor qualquer de script Clausewitz: escalar, lista ou bloco aninhado. */
export type ValorClausewitz =
  | string
  | number
  | boolean
  | ValorClausewitz[]
  | { [chave: string]: ValorClausewitz };

const zValorClausewitz: z.ZodType<ValorClausewitz> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(zValorClausewitz),
    z.record(z.string(), zValorClausewitz),
  ])
);

const zSecao = zValorClausewitz
  .optional()
  .describe(
    'Bloco de script Clausewitz desta seção, aninhado à vontade. As chaves internas (ship_size, army, planet_class) são validadas contra o vanilla instalado na hora de gerar, não aqui.'
  );

/** O corpo do name_list, sob a chave `ssm_<cultura>`. `.strict()`: seção
 * desconhecida é erro, e é justamente o que faz um typo de seção falhar cedo. */
const zCorpo = z
  .object({
    category: z
      .string()
      .describe('Categoria exibida na seleção de name_list do jogo (ex.: "Humanoid").'),
    ship_names: zSecao,
    ship_class_names: zSecao,
    fleet_names: zSecao,
    army_names: zSecao,
    planet_names: zSecao,
    character_names: zSecao,
  })
  .strict()
  .describe('Corpo do name_list — vira o conteúdo de ssm_<cultura>.txt em common/name_lists/.');

const zSpeciesName = z
  .object({
    key: z
      .string()
      .describe('Identificador da espécie-flavor, único entre TODOS os name_lists (o jogo agrupa por ele).'),
    name: z.string().describe('Nome da espécie no singular (ex.: "Altmer").'),
    plural: z.string().describe('Nome da espécie no plural (ex.: "Altmers").'),
    home_planet: z.string().optional().describe('Planeta natal sugerido.'),
    home_system: z.string().optional().describe('Sistema natal sugerido.'),
    species_class: z
      .enum(SPECIES_CLASSES_VALIDAS)
      .describe(
        'species_class sob a qual esta espécie-flavor é agrupada em ssm_species_names.txt — o jogo exige uma classe válida como chave, e é ela que decide em que impérios a entrada pode ser sorteada. Não há vínculo com portrait: ao gerar um império, o jogo sorteia a espécie-flavor e o retrato de forma independente, dentro da classe.'
      ),
  })
  .strict()
  .describe('Uma espécie-flavor: o que o botão de aleatório da criação de império pode sortear.');

const CHAVE_DO_CORPO = /^ssm_[a-z0-9_]+$/;

const zNameListBase = z
  .object({
    name: z.string().describe('Nome da cultura como aparece na lista do jogo (ex.: "Sagittarius - Chromatica").'),
    desc: z
      .string()
      .describe('Descrição/preview da cultura, com exemplos por aspecto. Aceita marcação de cor do jogo (§Y...§!) e \\n.'),
    species_names: z
      .array(zSpeciesName)
      .optional()
      .describe('Espécies-flavor associadas a esta cultura — viram entradas de ssm_species_names.txt.'),
    _meta: z
      .unknown()
      .optional()
      .describe('Registro de autoria (tema e quantidade-alvo por aspecto), consumido pela skill /gerar-name-list. O gerador ignora e não escreve no .txt.'),
  })
  .catchall(zCorpo)
  .describe('Formato completo de assets/name_lists/<cultura>.json.');

/** O corpo do name_list mora numa chave nomeada (`ssm_altmer`), porque o
 * `.txt` gerado precisa desse wrapper e os tokens de localização derivam dele.
 * `catchall` sozinho aceitaria zero ou várias — aqui exigimos exatamente uma,
 * com o prefixo do mod. */
export const zNameList = zNameListBase.superRefine((arquivo, ctx) => {
  const declaradas = ['name', 'desc', 'species_names', '_meta'];
  const chavesDeCorpo = Object.keys(arquivo).filter((chave) => !declaradas.includes(chave));

  if (chavesDeCorpo.length === 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'falta a chave "ssm_<cultura>" que carrega o corpo do name_list.',
    });
    return;
  }

  if (chavesDeCorpo.length > 1) {
    ctx.addIssue({
      code: 'custom',
      message: `esperava uma única chave "ssm_<cultura>" com o corpo do name_list, encontrou ${chavesDeCorpo.length}: ${chavesDeCorpo.join(', ')}.`,
    });
  }

  for (const chave of chavesDeCorpo) {
    if (!CHAVE_DO_CORPO.test(chave)) {
      ctx.addIssue({
        code: 'custom',
        path: [chave],
        message: `"${chave}" não é um nome válido de name_list — precisa ser ssm_<cultura>, em minúsculas.`,
      });
    }
  }
});

export type NameList = z.infer<typeof zNameList>;
export type SpeciesNameEntry = z.infer<typeof zSpeciesName>;
export type CorpoNameList = z.infer<typeof zCorpo>;
