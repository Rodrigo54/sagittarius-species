import type { GeracaoArtV2Modelo } from '../portrait-schema';
import { ASPECT_RATIO_PADRAO, resolverAspectRatio } from './resolution';

/** IDs dos nodes fixos em
 * `scripts/comfyui/ssm_species_portrait_workflow_v2.json` — hardcoded
 * porque o template é um arquivo fixo desta pipeline, não algo gerado
 * dinamicamente (mesmo espírito do v1). Se o workflow for editado e
 * reexportado, estes IDs precisam ser conferidos/atualizados junto.
 *
 * Só cobre os nodes que sempre existem no template (baseline sem
 * referência). Os nodes da cadeia de `ReferenceLatent` (quando
 * `referenceImage` não está vazio) são criados dinamicamente abaixo, com
 * IDs novos — o número de referências varia por gênero/espécie, então não
 * cabe num template fixo (diferente do ControlNet do v1, que é sempre um
 * node só, ligado ou desligado por `strength`). */
const NODE_IDS = {
  vae: '3',
  positivo: '4',
  negativo: '5',
  latente: '6',
  ruido: '7',
  scheduler: '9',
  guider: '10',
  saveImage: '17',
} as const;

/** Um "prompt" no sentido da API do ComfyUI: o grafo de nodes inteiro,
 * `{ [nodeId]: { class_type, inputs, ... } }` — não confundir com o texto do
 * prompt de geração. */
export type PromptComfyUI = Record<string, { class_type: string; inputs: Record<string, unknown>; [k: string]: unknown }>;

export interface OpcoesMontagem {
  seed: number;
  filenamePrefix: string;
  modelo?: GeracaoArtV2Modelo;
  /** Nomes dos arquivos já enviados ao `input/` do ComfyUI (via
   * `enviarImagemDeReferencia`), na mesma ordem declarada em
   * `referenceImage` — undefined/vazio = sem cadeia de referência nenhuma,
   * o `CFGGuider` liga direto nos dois `CLIPTextEncode` (é assim que o
   * template baseline já vem). */
  imagensReferenciaEnviadas?: string[];
}

/** Escala fixa da referência antes de codificar em latente — `1` megapixel,
 * o mesmo padrão que ancora `resolverAspectRatio` (ver `resolution.ts`).
 * Independente da resolução de geração: `ReferenceLatent` só acrescenta
 * tokens de referência à conditioning (ver `KV_Attn_Input` no código-fonte
 * do node), não precisa bater pixel a pixel com o latente principal — só
 * testado e confirmado rodando o grafo de ponta a ponta contra o ComfyUI
 * local (Task #4). */
const MEGAPIXELS_REFERENCIA = 1;

/** IDs dos nodes dinâmicos da cadeia de referência começam aqui, bem acima
 * dos IDs fixos do template (1–17) — evita colisão sem precisar consultar o
 * template pra descobrir o próximo livre. */
const PRIMEIRO_ID_DINAMICO = 100;

/** Clona o template (`ssm_species_portrait_workflow_v2.json` pra
 * `modelo.variant` "base", `..._distilled.json` pra "distilled" — a escolha
 * de qual arquivo carregar é responsabilidade de quem chama, ver
 * `index.ts`) e injeta o texto já pronto (`prompts.positive`/`.negative`,
 * montado por `prompt-builder.ts#montarPrompts`), a seed, o prefixo de
 * arquivo desta geração específica, `steps`/`cfg`/resolução
 * (`geracaoArtV2.modelo`, se declarada — `aspectRatio` ausente cai no padrão
 * `1:1`) e a cadeia de `ReferenceLatent` (quando
 * `imagensReferenciaEnviadas` não está vazio). O texto negativo só é
 * escrito quando o template tem um `CLIPTextEncode` de verdade no node
 * negativo — a variante "distilled" usa `ConditioningZeroOut` ali (sem
 * input de texto), então `prompts.negative` é simplesmente ignorado nesse
 * caso (mesmo comportamento do template oficial: CFG=1 zera a guidance
 * negativa de qualquer forma).
 *
 * Diferente do v1 (`generate-art/workflow.ts`), não existem `checkpoint`/
 * `lora`/`sampler_name`/`scheduler`/`denoise`/`controlNetStrength` pra
 * injetar — decisão da entrevista de planejamento: UNET/CLIP/VAE são fixos
 * por variante (um único arquivo de cada por variante, hoje), o sampler é
 * fixo em "euler", e o `ReferenceLatent` não tem parâmetro de força (é
 * presença/ausência binária, não um dial). */
export function montarPrompt(
  template: PromptComfyUI,
  prompts: { positive: string; negative: string },
  opcoes: OpcoesMontagem
): PromptComfyUI {
  const workflow = structuredClone(template);

  workflow[NODE_IDS.positivo]!.inputs.text = prompts.positive;
  // Na variante "distilled" o node NODE_IDS.negativo não é um CLIPTextEncode
  // (é ConditioningZeroOut, alimentado pelo próprio node positivo — ver
  // ssm_species_portrait_workflow_v2_distilled.json) — não tem input "text"
  // pra escrever. Checa o class_type real do template em vez de confiar
  // cegamente em opcoes.modelo?.variant: mais resiliente a um template
  // trocado sem atualizar o campo, e é o mesmo tipo de checagem defensiva
  // que resolverAspectRatio já faz pro próprio formato de entrada.
  if (workflow[NODE_IDS.negativo]!.class_type === 'CLIPTextEncode') {
    workflow[NODE_IDS.negativo]!.inputs.text = prompts.negative;
  }
  workflow[NODE_IDS.ruido]!.inputs.noise_seed = opcoes.seed;
  workflow[NODE_IDS.saveImage]!.inputs.filename_prefix = opcoes.filenamePrefix;

  const modelo = opcoes.modelo;
  if (modelo?.steps !== undefined) workflow[NODE_IDS.scheduler]!.inputs.steps = modelo.steps;
  if (modelo?.cfg !== undefined) workflow[NODE_IDS.guider]!.inputs.cfg = modelo.cfg;

  const { width, height } = resolverAspectRatio(modelo?.aspectRatio ?? ASPECT_RATIO_PADRAO);
  workflow[NODE_IDS.latente]!.inputs.width = width;
  workflow[NODE_IDS.latente]!.inputs.height = height;
  workflow[NODE_IDS.scheduler]!.inputs.width = width;
  workflow[NODE_IDS.scheduler]!.inputs.height = height;

  const imagens = opcoes.imagensReferenciaEnviadas ?? [];
  if (imagens.length === 0) {
    // Sem referência: o template baseline já liga o CFGGuider direto nos
    // dois CLIPTextEncode — nada a rewire.
    return workflow;
  }

  let proximoId = PRIMEIRO_ID_DINAMICO;
  const novoId = (): string => String(proximoId++);

  // Cadeia encadeada (decisão da entrevista): cada referência é um
  // indivíduo/conceito diferente da espécie, não um ângulo do mesmo
  // personagem — cada ReferenceLatent acrescenta seu latente à lista
  // "reference_latents" da conditioning recebida da anterior, tanto no
  // positivo quanto no negativo (mesmo padrão do template oficial "Image
  // Edit" do Flux.2 Klein — ver dump em generate-art-v2-plano.md/handoff).
  let conditioningPositivo: [string, number] = [NODE_IDS.positivo, 0];
  let conditioningNegativo: [string, number] = [NODE_IDS.negativo, 0];

  for (const nomeArquivo of imagens) {
    const idLoad = novoId();
    const idScale = novoId();
    const idEncode = novoId();
    const idRefPositivo = novoId();
    const idRefNegativo = novoId();

    workflow[idLoad] = { class_type: 'LoadImage', inputs: { image: nomeArquivo } };
    workflow[idScale] = {
      class_type: 'ImageScaleToTotalPixels',
      inputs: {
        image: [idLoad, 0],
        upscale_method: 'nearest-exact',
        megapixels: MEGAPIXELS_REFERENCIA,
        // Exigido pela API mesmo tendo default no node (confirmado na
        // validação manual da Task #4 — sem isso o ComfyUI recusa com
        // "required_input_missing").
        resolution_steps: 1,
      },
    };
    workflow[idEncode] = {
      class_type: 'VAEEncode',
      inputs: { pixels: [idScale, 0], vae: [NODE_IDS.vae, 0] },
    };
    // O mesmo latente da referência alimenta os dois ramos (positivo e
    // negativo) — só a conditioning de entrada difere entre eles.
    workflow[idRefPositivo] = {
      class_type: 'ReferenceLatent',
      inputs: { conditioning: conditioningPositivo, latent: [idEncode, 0] },
    };
    workflow[idRefNegativo] = {
      class_type: 'ReferenceLatent',
      inputs: { conditioning: conditioningNegativo, latent: [idEncode, 0] },
    };

    conditioningPositivo = [idRefPositivo, 0];
    conditioningNegativo = [idRefNegativo, 0];
  }

  workflow[NODE_IDS.guider]!.inputs.positive = conditioningPositivo;
  workflow[NODE_IDS.guider]!.inputs.negative = conditioningNegativo;

  return workflow;
}
