import type { GeracaoArtModelo } from '../portrait-schema';

/** IDs dos nodes em `scripts/comfyui/ssm_species_portrait_workflow.json` —
 * hardcoded porque o template é um arquivo fixo desta pipeline, não algo
 * gerado dinamicamente. Se o workflow for editado no ComfyUI e reexportado,
 * estes IDs precisam ser conferidos/atualizados junto.
 *
 * Não tem mais `style`/`view`/`hair`/`eyes`/`mouth`/`clothing`/`pose`/
 * `person`/`textoLivre` — esses nodes (OOP + StringConcatenate) foram
 * removidos do workflow (ver `generate-art-migracao-schema-proprio.md`); o
 * texto final (positivo e negativo) já vem pronto de
 * `prompt-builder.ts#montarPrompts` e é injetado direto nos dois
 * `CLIPTextEncode` abaixo. */
const NODE_IDS = {
  checkpoint: '1',
  negativo: '11',
  latente: '12',
  sampler: '13',
  saveImage: '15',
  positivo: '17',
  controlNetImagem: '22',
  controlNetApply: '25',
  lora: '27',
} as const;

/** Um "prompt" no sentido da API do ComfyUI: o grafo de nodes inteiro,
 * `{ [nodeId]: { class_type, inputs, ... } }` — não confundir com o texto do
 * prompt de geração. */
export type PromptComfyUI = Record<string, { class_type: string; inputs: Record<string, unknown>; [k: string]: unknown }>;

export interface OpcoesMontagem {
  seed: number;
  filenamePrefix: string;
  modelo?: GeracaoArtModelo;
  /** Nome do arquivo já enviado ao `input/` do ComfyUI (via
   * `enviarImagemDeReferencia`) — undefined = nenhuma referência de pose
   * configurada pra esta espécie, e a força do ControlNet é zerada abaixo
   * pra ele não influenciar a geração com a imagem de exemplo do template. */
  imagemReferenciaEnviada?: string;
}

/** Clona o template e injeta o texto já pronto (`prompts.positive`/
 * `.negative`, montado por `prompt-builder.ts#montarPrompts`) direto nos dois
 * `CLIPTextEncode`, mais a seed, o prefixo de arquivo desta geração
 * específica e a configuração de modelo/sampler (`geracaoArt.modelo`, se
 * declarada). Campos ausentes de `modelo` mantêm o valor que já estava no
 * template (não são apagados). */
export function montarPrompt(
  template: PromptComfyUI,
  prompts: { positive: string; negative: string },
  opcoes: OpcoesMontagem
): PromptComfyUI {
  const workflow = structuredClone(template);

  workflow[NODE_IDS.positivo]!.inputs.text = prompts.positive;
  workflow[NODE_IDS.negativo]!.inputs.text = prompts.negative;
  workflow[NODE_IDS.sampler]!.inputs.seed = opcoes.seed;
  workflow[NODE_IDS.saveImage]!.inputs.filename_prefix = opcoes.filenamePrefix;

  const modelo = opcoes.modelo;
  if (modelo?.checkpoint !== undefined) workflow[NODE_IDS.checkpoint]!.inputs.ckpt_name = modelo.checkpoint;
  if (modelo?.steps !== undefined) workflow[NODE_IDS.sampler]!.inputs.steps = modelo.steps;
  if (modelo?.cfg !== undefined) workflow[NODE_IDS.sampler]!.inputs.cfg = modelo.cfg;
  if (modelo?.sampler_name !== undefined) workflow[NODE_IDS.sampler]!.inputs.sampler_name = modelo.sampler_name;
  if (modelo?.scheduler !== undefined) workflow[NODE_IDS.sampler]!.inputs.scheduler = modelo.scheduler;
  if (modelo?.width !== undefined) workflow[NODE_IDS.latente]!.inputs.width = modelo.width;
  if (modelo?.height !== undefined) workflow[NODE_IDS.latente]!.inputs.height = modelo.height;
  if (modelo?.lora !== undefined) workflow[NODE_IDS.lora]!.inputs.lora_name = modelo.lora;
  if (modelo?.loraStrength !== undefined) {
    workflow[NODE_IDS.lora]!.inputs.strength_model = modelo.loraStrength;
    workflow[NODE_IDS.lora]!.inputs.strength_clip = modelo.loraStrength;
  }

  if (opcoes.imagemReferenciaEnviada !== undefined) {
    workflow[NODE_IDS.controlNetImagem]!.inputs.image = opcoes.imagemReferenciaEnviada;
    workflow[NODE_IDS.controlNetApply]!.inputs.strength = modelo?.controlNetStrength ?? 0.8;
    if (modelo?.denoise !== undefined) workflow[NODE_IDS.sampler]!.inputs.denoise = modelo.denoise;
  } else {
    // Sem referência configurada: zera a força do ControlNet (não aplica a
    // imagem de exemplo do template) e força denoise 1.0 — sem isso o
    // img2img codificaria o example.png como ponto de partida e o
    // resultado saíria contaminado por uma imagem sem relação nenhuma com a
    // espécie. Equivalente a rodar em txt2img puro.
    workflow[NODE_IDS.controlNetApply]!.inputs.strength = 0;
    workflow[NODE_IDS.sampler]!.inputs.denoise = 1.0;
  }

  return workflow;
}
