import { z } from 'zod';
import {
  ANCORAS_VERTICAIS,
  CORES_CABELO,
  CORES_OLHO,
  ESTADOS_TORSO,
  ESTILOS_CABELO,
  ETNIAS,
  FORMAS_CORPO,
  FORMAS_OLHO,
  GENEROS_PESSOA,
  MODOS_ENQUADRAMENTO,
  RIGS_VALIDOS,
  TIPOS,
} from './vocabulario';

const GENEROS_ALVO = ['male', 'female', 'flat'] as const;

/** Fonte de verdade do formato de `assets/portraits/ssm_<especie>/portrait.json`
 * — schema `zod`, com tipos TS inferidos automaticamente (`z.infer`, no fim
 * do arquivo). Substitui a validação manual que existia em
 * `generate-art/validation.ts` e `generate-portraits/validation.ts` (as duas
 * validavam pedaços do mesmo arquivo, cada uma com sua própria lógica
 * imperativa) — agora é um schema só, usado pelos dois pipelines.
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
 * silenciosamente (comportamento padrão do zod). Isso importa em especial
 * durante a migração do schema antigo (OOP: `pose`/`view`/`style`/`clothing`/
 * `extra` de string) pro novo (`tipo`/`torso`/`extra_prompt`): sem
 * `.strict()`, um `portrait.json` ainda não migrado "passaria" na validação
 * silenciosamente, com o conteúdo antigo todo descartado (confirmado
 * testando contra os arquivos reais de ssm_default/ssm_astral antes desta
 * mudança) — com `.strict()`, ele falha alto e claro, apontando exatamente
 * a chave que não existe mais. */

const zTipo = z
  .object({
    value: z.enum(TIPOS).describe('Arquétipo visual — categoria ampla, reaproveitável entre espécies visualmente diferentes (ex.: "Human" cobre ssm_default, ssm_knight, ssm_astral e ssm_mercenary).'),
    description: z
      .string()
      .optional()
      .describe(
        'Texto livre que diferencia o sabor dentro do mesmo "value" (ex.: "cute Pixar-style robot" vs. "war machine aesthetic", ambos Robot) ou detalha um arquétipo raro/não-recorrente (Mermaid, Eldritch). Tratado como âncora: emitido cedo no prompt, com peso, junto de "value" — não é a mesma coisa que colocar essa nuance em extra_prompt.positive, que fica mais pro fim.'
      ),
  })
  .strict()
  .describe('Arquétipo visual da espécie/indivíduo pro prompt de geração de arte via IA. Não é o species_class do jogo (esse não muda, não existe em portrait.json).');

const zPessoa = z
  .object({
    age: z.number().positive().optional().describe('Idade aparente do indivíduo.'),
    ethnicity: z.enum(ETNIAS).optional().describe('Etnia.'),
    body_shape: z.enum(FORMAS_CORPO).optional().describe('Tipo físico/corpo.'),
    gender: z
      .enum(GENEROS_PESSOA)
      .optional()
      .describe(
        'Gênero do indivíduo no prompt (Female/Male/Androgynous) — não confundir com a chave de gênero-alvo de geração (male/female/flat) do bloco pai, que usa outra convenção (inclusive não tem "Androgynous").'
      ),
  })
  .strict()
  .describe('Atributos da pessoa/indivíduo.');

const zCabelo = z
  .object({
    style: z.enum(ESTILOS_CABELO).optional().describe('Estilo/corte de cabelo.'),
    main_color: z.enum(CORES_CABELO).optional().describe('Cor principal do cabelo.'),
    optional_color: z.enum(CORES_CABELO).optional().describe('Cor secundária do cabelo (mechas, dip-dye, etc.).'),
  })
  .strict()
  .describe('Cabelo.');

const zOlhos = z
  .object({
    shape: z.enum(FORMAS_OLHO).optional().describe('Formato dos olhos.'),
    color: z.enum(CORES_OLHO).optional().describe('Cor dos olhos.'),
  })
  .strict()
  .describe('Olhos.');

const zTorso = z
  .object({
    description: z
      .string()
      .optional()
      .describe('Descrição livre do que está sobre o tronco: tema/material/cor (armadura, escama, pele nua, pelagem, roupa comum — o que fizer sentido pra espécie).'),
    state: z
      .enum(ESTADOS_TORSO)
      .optional()
      .describe(
        'Estado estruturado do tronco (âncora: prioridade alta, peso automático no prompt). Neutro — não julga "mais coberto é melhor" (escama à mostra é um estado tão correto quanto armadura completa, dependendo da espécie).'
      ),
  })
  .strict()
  .describe(
    'O que está sobre o tronco do indivíduo — substitui o antigo campo clothing (vocabulário de roupa civil, sem opção pra armadura/escama/pele nua).'
  );

const zExtraPrompt = z
  .object({
    positive: z.string().optional().describe('Texto livre concatenado ao prompt positivo (base→gênero→variante, sempre por cima, nunca substitui os níveis acima).'),
    negative: z
      .string()
      .optional()
      .describe('Texto livre concatenado ao prompt negativo, por cima do negativo compartilhado de base.json (base→gênero→variante, sempre por cima, nunca substitui).'),
  })
  .strict()
  .describe('Texto livre pra cobrir o que os campos estruturados não expressam — substitui o antigo campo extra (que só existia pro lado positivo).');

const zCamposCompostos = z
  .object({
    tipo: zTipo.optional(),
    person: zPessoa.optional(),
    hair: zCabelo.optional(),
    eyes: zOlhos.optional(),
    torso: zTorso.optional(),
    extra_prompt: zExtraPrompt.optional(),
  })
  .strict()
  .describe(
    'Bloco de atributos — usado tanto em "base" quanto em cada variante, sempre como overrides parciais mesclados por seção (nunca o objeto inteiro substituído). Não tem mais pose/view/style/mouth: esses ficaram travados globalmente em base.json, pra bater sempre com o rig ssm_shared.'
  );

const CHAVE_VARIANTE = /^\d{3}$/;

/** Config de sampler/resolução do pipeline de geração de arte via IA
 * (`bun run generate-art`, Flux.2 Klein Base). Bem mais enxuta que a de um
 * checkpoint SDXL clássico porque boa parte desses campos não tem
 * equivalente aqui: `checkpoint`/`lora`/`loraStrength` não existem porque
 * hoje só existe um arquivo de UNET/CLIP/VAE instalado (ver
 * `handoff-comfyui-image-models-2026-08-08.md`) — expor isso por espécie
 * seria configurabilidade sem uso real; `sampler_name`/`scheduler` não
 * existem porque o grafo do Flux2 usa `KSamplerSelect` fixo em "euler" +
 * `Flux2Scheduler` (não um scheduler nomeado configurável tipo
 * `sgm_uniform`); `denoise`/`controlNetStrength` não existem porque o node
 * `ReferenceLatent` (mecanismo de consistência deste pipeline, no lugar do
 * ControlNet do pipeline SDXL anterior — ver
 * `generate-art-v1-historico-da-sessao.md`) não tem parâmetro de força — é
 * presença/ausência binária, não um dial. */
const VARIANTES_MODELO = ['base', 'distilled'] as const;

const zModelo = z
  .object({
    variant: z
      .enum(VARIANTES_MODELO)
      .optional()
      .describe(
        '"base" (20 passos, CFG=5, negativo real — padrão) ou "distilled" (4 passos, CFG=1, o negativo é descartado via ConditioningZeroOut — ~5x mais rápido, útil pra iteração rápida de prompt/composição antes de rodar o lote final em "base"). Ausente = "base".'
      ),
    steps: z.number().int().positive().optional().describe('Passos do sampler (Flux2Scheduler). Ausente mantém o padrão da variante ("base"=20, "distilled"=4).'),
    cfg: z.number().positive().optional().describe('CFG scale do CFGGuider. Ausente mantém o padrão da variante ("base"=5, "distilled"=1 — CFG≠1 em "distilled" tende a degradar a qualidade, já que a guidance foi destilada nos pesos).'),
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

function zBlocoGenero() {
  return zCamposCompostos
    .extend({
      referenceImage: z
        .array(z.string())
        .optional()
        .describe(
          'Imagens de referência (conceito visual, ex.: gerado no Midjourney) deste gênero — cada entrada é um indivíduo/conceito diferente da espécie (não ângulos do mesmo personagem), encadeadas via ReferenceLatent pra dar amplitude visual ao resultado. Uma lista só por gênero, sem override por variante. Ausente/vazio = txt2img puro, sem referência.'
        ),
      variantes: z
        .record(z.string().regex(CHAVE_VARIANTE), zCamposCompostos)
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
    'Configuração completa de geração de arte via IA (bun run generate-art, Flux.2 Klein Base) pra esta espécie — campo opt-in, ausente na maioria das espécies hoje.'
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
export type Tipo = z.infer<typeof zTipo>;
export type Torso = z.infer<typeof zTorso>;
export type ExtraPrompt = z.infer<typeof zExtraPrompt>;
export type GeracaoArt = z.infer<typeof zGeracaoArt>;
export type GeracaoArtGenero = z.infer<ReturnType<typeof zBlocoGenero>>;
export type GeracaoArtModelo = z.infer<typeof zModelo>;
export type GeneroAlvo = 'male' | 'female' | 'flat';
