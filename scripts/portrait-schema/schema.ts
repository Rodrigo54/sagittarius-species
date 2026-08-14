import { z } from 'zod';
import { CAMPOS_EYES, CAMPOS_HAIR, CAMPOS_PERSON, CAMPOS_SPECIES, CAMPOS_TORSO } from './campos';
import { validarSintaxeDeTemplate } from './templates';
import { ANCORAS_VERTICAIS, MODOS_ENQUADRAMENTO, RIGS_VALIDOS } from './vocabulario';

const GENEROS_ALVO = ['male', 'female', 'flat'] as const;

/** Fonte de verdade do formato de `assets/portraits/ssm_<especie>/portrait.json`
 * — schema `zod`, com tipos TS inferidos automaticamente (`z.infer`, no fim
 * do arquivo). Um schema só, usado pelos dois pipelines que leem o arquivo
 * (`generate-portraits` e `generate-art`).
 *
 * O JSON Schema (`.json`, gerado via `z.toJSONSchema()` nativo do zod v4 —
 * ver `gerar-json-schema.ts`) é um **artefato derivado** deste arquivo, pro
 * `$schema`/autocomplete do VS Code — nunca editado à mão.
 *
 * Convenção de idioma (CLAUDE.md): chaves em inglês (consistente com o resto
 * do repositório), `.describe(...)` em português — é o texto que aparece no
 * IntelliSense do editor ao validar/editar um `portrait.json`.
 *
 * Todo objeto é `.strict()` — chave desconhecida é ERRO, não descartada
 * silenciosamente (comportamento padrão do zod). Isso importa porque um
 * `geracaoArt` escrito contra um formato de campo antigo (renomeado ou
 * removido numa mudança de schema) passaria na validação silenciosamente
 * sem `.strict()`, com o conteúdo antigo todo descartado — com `.strict()`,
 * falha alto e claro, apontando exatamente a chave que não existe mais.
 *
 * **Templates.** O texto de prompt de cada seção mora em `template`, escrito
 * na sintaxe de interpolação (`<secao.campo>`, `[trecho opcional]`) —
 * ver `scripts/generate-art/interpolacao.ts`. Cada `template`/`extra` passa
 * por `validarSintaxeDeTemplate` aqui mesmo, então um colchete sem par ou um
 * `<caminho>` que não existe no schema falha já na leitura do arquivo,
 * inclusive em `bun run portrait`. Sem `template`, a seção cai no template
 * default de `scripts/generate-art/base.json`. */

/** Um `template`/`extra` é validado só na FORMA (sintaxe + caminho existente)
 * — se o campo citado está de fato declarado em alguma variante é validação
 * cruzada, feita no `generate-art`, que é quem conhece os templates default
 * do `base.json`. */
const zTextoDeTemplate = z.string().superRefine((texto, ctx) => {
  const erro = validarSintaxeDeTemplate(texto);
  if (erro) ctx.addIssue({ code: 'custom', message: erro });
});

const zTemplateDaSecao = zTextoDeTemplate
  .optional()
  .describe(
    'Texto desta seção no prompt, na sintaxe de interpolação: "<secao.campo>" injeta o valor do campo (o do objeto já mesclado base→gênero→variante), "[trecho]" marca um trecho opcional, que some inteiro se o campo dentro dele não estiver declarado. Fora de colchetes o campo é OBRIGATÓRIO — não declarar é erro, não um prompt silenciosamente incompleto. Omitido = usa o template default de scripts/generate-art/base.json.'
  );

const zExtraDaSecao = zTextoDeTemplate
  .optional()
  .describe(
    'Texto acrescentado logo depois do template desta seção — mesma sintaxe de interpolação (com ou sem placeholder). Concatena entre base→gênero→variante (não é "o último vence"), pra uma variante acrescentar um detalhe sem reescrever o texto inteiro da base.'
  );

const zSpecies = z
  .object({ ...CAMPOS_SPECIES, template: zTemplateDaSecao, extra: zExtraDaSecao })
  .strict()
  .describe(
    'O que esta ESPÉCIE é — arquétipo visual e o texto que a diferencia das outras que compartilham o mesmo arquétipo. Só pode ser declarada em geracaoArt.base: descreve a espécie inteira, não o indivíduo (o que varia por indivíduo é person/hair/eyes/torso).'
  );

const zPessoa = z
  .object({ ...CAMPOS_PERSON, template: zTemplateDaSecao, extra: zExtraDaSecao })
  .strict()
  .describe('Atributos da pessoa/indivíduo.');

const zCabelo = z
  .object({ ...CAMPOS_HAIR, template: zTemplateDaSecao, extra: zExtraDaSecao })
  .strict()
  .describe('Cabelo.');

const zOlhos = z
  .object({ ...CAMPOS_EYES, template: zTemplateDaSecao, extra: zExtraDaSecao })
  .strict()
  .describe('Olhos.');

const zTorso = z
  .object({ ...CAMPOS_TORSO, template: zTemplateDaSecao, extra: zExtraDaSecao })
  .strict()
  .describe(
    'O que está sobre o tronco do indivíduo — armadura, escama, pele nua, pelagem, roupa comum, o que fizer sentido pra espécie. O template é onde cada cor é posicionada na peça certa ("...top in <torso.primary_color>, ...waistband in <torso.secondary_color>"), em vez de as cores saírem soltas e a IA decidir onde aplicá-las.'
  );

/** Seções que descrevem o INDIVÍDUO — variam entre variantes, então podem ser
 * declaradas em qualquer nível (`base`, gênero, variante) e são mescladas
 * raso, seção a seção. */
const zCamposDoIndividuo = z
  .object({
    person: zPessoa.optional(),
    hair: zCabelo.optional(),
    eyes: zOlhos.optional(),
    torso: zTorso.optional(),
  })
  .strict()
  .describe(
    'Atributos do indivíduo — usados em "base", no bloco de gênero e em cada variante, sempre como overrides parciais mesclados por seção (nunca o objeto inteiro substituído).'
  );

/** `base` é o único nível que aceita `species`: gênero e variante descrevem
 * indivíduos, e a espécie é a mesma pros dois. Declarar `species` fora daqui
 * é erro de `.strict()`, com a chave nomeada. */
const zCamposCompostos = zCamposDoIndividuo
  .extend({ species: zSpecies.optional() })
  .strict()
  .describe('Atributos da espécie (species) mais os do indivíduo — forma do bloco "base" e do objeto mesclado que alimenta o prompt.');

const CHAVE_VARIANTE = /^\d{3}$/;

/** Config de sampler/resolução do pipeline de geração de arte via IA
 * (`bun run art`, Flux.2 Klein). Bem mais enxuta que a de um checkpoint SDXL
 * clássico porque boa parte desses campos não tem equivalente aqui:
 * `checkpoint`/`lora`/`loraStrength` não existem porque hoje só existe um
 * arquivo de UNET/CLIP/VAE instalado (ver `docs/pipeline-generate-art.md`) —
 * expor isso por espécie seria configurabilidade sem uso real;
 * `sampler_name`/`scheduler` não existem porque o grafo do Flux2 usa
 * `KSamplerSelect` fixo em "euler" + `Flux2Scheduler` (não um scheduler
 * nomeado configurável tipo `sgm_uniform`); `denoise`/`controlNetStrength`
 * não existem porque o node `ReferenceLatent` (mecanismo de consistência
 * deste pipeline, no lugar do ControlNet do pipeline SDXL anterior — ver
 * `docs/history/2026-07-28-generate-art-v1.md`) não tem parâmetro de força — é
 * presença/ausência binária, não um dial. */
const VARIANTES_MODELO = ['distilled', 'base'] as const;

const zModelo = z
  .object({
    variant: z
      .enum(VARIANTES_MODELO)
      .optional()
      .describe(
        '"distilled" (4 passos, CFG=1, o negativo é descartado via ConditioningZeroOut — padrão) ou "base" (20 passos, CFG=5, negativo real; ~5x mais lento, para o lote final quando a qualidade extra compensar). Ausente = "distilled".'
      ),
    steps: z.number().int().positive().optional().describe('Passos do sampler (Flux2Scheduler). Ausente mantém o padrão da variante ("distilled"=4, "base"=20).'),
    cfg: z.number().positive().optional().describe('CFG scale do CFGGuider. Ausente mantém o padrão da variante ("distilled"=1 — CFG≠1 nessa variante tende a degradar a qualidade, já que a guidance foi destilada nos pesos —, "base"=5).'),
    aspectRatio: z
      .string()
      .regex(/^\d+:\d+$/, 'formato esperado "W:H" (ex.: "2:3", "4:5")')
      .optional()
      .describe(
        'Proporção largura:altura livre (ex.: "2:3", "4:5", "1:1") — width/height são derivados preservando a contagem de megapixels do quadrado 1024x1024 (padrão do Flux.2 Klein), arredondados pro múltiplo de 16 mais próximo. Ausente = "1:1".'
      ),
  })
  .strict()
  .describe('Configuração de sampler/resolução do Flux.2 Klein — ver geracaoArt.');

/** Variante individual dentro de `variantes` — os campos do indivíduo
 * (person/hair/eyes/torso), mais `seed`: a seed de geração desta variante
 * específica. Não participa do merge de `mesclarCampos` (não é um campo de
 * prompt, é um parâmetro de geração) — é lido direto de
 * `bloco.variantes[chave].seed` em `generate-art/index.ts`, com precedência
 * `--seed` da CLI → este campo → hash determinístico (`seedDeterministica`,
 * ver `generate-art/seed.ts`).
 *
 * Descreve a seed da imagem que está em disco, e é o `bun run art` quem o
 * mantém assim: toda forma de `--seed` grava o resultado aqui depois de
 * gerar o PNG — `--seed N` fixa `N`, `--seed` sem valor sorteia (o reroll da
 * variante), e `--seed default` apaga a chave, devolvendo a variante ao hash
 * determinístico. Colar um número à mão continua valendo; ausente, a variante
 * cai no hash determinístico. */
const zVariante = zCamposDoIndividuo
  .extend({
    seed: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe(
        'Seed de geração desta variante (noise_seed do ComfyUI) — a seed da imagem em disco, gravada automaticamente por qualquer forma de "bun run art --seed" (um inteiro fixa aquele valor; sem valor sorteia um) ou colada à mão. Fixa a imagem: reexecuções sem --seed reproduzem esta seed. Ausente = usa a seed determinística; "--seed default" apaga esta chave e devolve a variante a ela.'
      ),
  })
  .strict();

function zBlocoGenero() {
  return zCamposDoIndividuo
    .extend({
      referenceImage: z
        .array(z.string())
        .optional()
        .describe(
          'Imagens de referência (conceito visual, ex.: gerado no Midjourney) deste gênero — cada entrada é um indivíduo/conceito diferente da espécie (não ângulos do mesmo personagem), encadeadas via ReferenceLatent pra dar amplitude visual ao resultado. Uma lista só por gênero, sem override por variante. Ausente/vazio = txt2img puro, sem referência.'
        ),
      variantes: z
        .record(z.string().regex(CHAVE_VARIANTE), zVariante)
        .describe(
          'Uma variante nomeada por indivíduo — chave é o índice zero-padded a 3 dígitos ("001".."NNN"), mesma convenção do PNG final. A contagem de chaves precisa bater exatamente com counts.<gênero>.'
        ),
    })
    .strict()
    .describe('Bloco de um gênero (male/female/flat): overrides sobre base, mais uma variante nomeada por indivíduo.');
}

const zGeracaoArt = z
  .object({
    base: zCamposCompostos,
    modelo: zModelo.optional(),
    male: zBlocoGenero().optional(),
    female: zBlocoGenero().optional(),
    flat: zBlocoGenero().optional(),
  })
  .strict()
  .describe(
    'Configuração completa de geração de arte via IA (bun run art, Flux.2 Klein) pra esta espécie — campo opt-in, ausente na maioria das espécies hoje.'
  );

const zPortraitConfigBase = z
  .object({
    name: z.string().describe('Nome da espécie sem o prefixo ssm_ — precisa bater com o nome da pasta assets/portraits/ssm_<name>/.'),
    gendered: z.boolean().describe('true = a espécie tem subpastas male/female; false = espécie "flat", PNGs NNN.png direto na raiz da pasta.'),
    rig: z.enum(RIGS_VALIDOS).optional().describe('Rig de retrato compartilhado. Omitido = sl_shared.'),
    modo: z.enum(MODOS_ENQUADRAMENTO).optional().describe('Modo de enquadramento — só faz sentido em rig com guia (ssm_shared). Omitido = largura.'),
    ancora: z.enum(ANCORAS_VERTICAIS).optional().describe('O que encosta no topo do guia — só faz sentido em rig com guia (ssm_shared). Omitido = conteudo.'),
    counts: z
      .object({
        male: z.number().int().positive().optional().describe('Quantidade de variantes masculinas.'),
        female: z.number().int().positive().optional().describe('Quantidade de variantes femininas.'),
        flat: z.number().int().positive().optional().describe('Quantidade de variantes (espécie sem gênero).'),
      })
      .strict()
      .describe('Quantidade de variantes por gênero — precisa bater exato com os PNGs encontrados em assets/portraits/ssm_<name>/.'),
    geracaoArt: zGeracaoArt.optional(),
  })
  .strict()
  .describe('Formato completo de assets/portraits/ssm_<especie>/portrait.json.');

/** Confere que, pra todo gênero em que `geracaoArt.<gênero>` está presente, a
 * contagem de `variantes` bate exatamente com `counts.<gênero>` e as chaves
 * são sequenciais "001".."NNN", zero-padded, sem buraco — validação cruzada
 * entre `counts` (nível raiz) e `geracaoArt` (aninhado), impossível de
 * expressar só com `z.record`/enum isolado. */
function validarVariantesDeGeracaoArt(
  ctx: z.RefinementCtx,
  geracaoArt: GeracaoArt | undefined,
  counts: { male?: number; female?: number; flat?: number }
): void {
  if (!geracaoArt) return;

  for (const genero of GENEROS_ALVO) {
    const bloco = geracaoArt[genero];
    if (!bloco) continue;

    const esperado = counts[genero];
    if (esperado === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['counts', genero],
        message: `geracaoArt.${genero} está declarado, mas counts.${genero} não — a contagem de variantes precisa vir de algum lugar.`,
      });
      continue;
    }

    const chaves = Object.keys(bloco.variantes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (chaves.length !== esperado) {
      ctx.addIssue({
        code: 'custom',
        path: ['geracaoArt', genero, 'variantes'],
        message: `contagem declarada em counts.${genero} (${esperado}) não bate com o número de variantes em geracaoArt.${genero}.variantes (${chaves.length}).`,
      });
      continue;
    }

    chaves.forEach((chave, index) => {
      const esperada = String(index + 1).padStart(3, '0');
      if (chave !== esperada) {
        ctx.addIssue({
          code: 'custom',
          path: ['geracaoArt', genero, 'variantes', chave],
          message: `esperava a variante "${esperada}" na posição ${index}, encontrou "${chave}" — chaves precisam ser sequenciais e zero-padded a 3 dígitos, sem buracos.`,
        });
      }
    });
  }
}

export const zPortraitConfig = zPortraitConfigBase.superRefine((config, ctx) => {
  validarVariantesDeGeracaoArt(ctx, config.geracaoArt, config.counts);
});

export type PortraitConfig = z.infer<typeof zPortraitConfig>;
export type CamposCompostos = z.infer<typeof zCamposCompostos>;
export type CamposDoIndividuo = z.infer<typeof zCamposDoIndividuo>;
export type Variante = z.infer<typeof zVariante>;
export type Species = z.infer<typeof zSpecies>;
export type Torso = z.infer<typeof zTorso>;
export type GeracaoArt = z.infer<typeof zGeracaoArt>;
export type GeracaoArtGenero = z.infer<ReturnType<typeof zBlocoGenero>>;
export type GeracaoArtModelo = z.infer<typeof zModelo>;
export type GeneroAlvo = 'male' | 'female' | 'flat';
