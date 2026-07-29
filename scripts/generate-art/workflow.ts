import type { GeracaoArtModelo, OOPCamposCompostos } from './oop-types';

/** IDs dos nodes em `scripts/comfyui/ssm_species_portrait_workflow.json` —
 * hardcoded porque o template é um arquivo fixo desta pipeline, não algo
 * gerado dinamicamente. Se o workflow for editado no ComfyUI e reexportado,
 * estes IDs precisam ser conferidos/atualizados junto. */
const NODE_IDS = {
  checkpoint: '1',
  style: '2',
  view: '3',
  hair: '4',
  eyes: '5',
  mouth: '6',
  clothing: '7',
  pose: '8',
  person: '9',
  latente: '12',
  sampler: '13',
  saveImage: '15',
  textoLivre: '16',
  controlNetImagem: '22',
  controlNetApply: '25',
  lora: '27',
} as const;

/** Um "prompt" no sentido da API do ComfyUI: o grafo de nodes inteiro,
 * `{ [nodeId]: { class_type, inputs, ... } }` — não confundir com o texto do
 * prompt de geração. */
export type PromptComfyUI = Record<string, { class_type: string; inputs: Record<string, unknown>; [k: string]: unknown }>;

function aplicarSecao(workflow: PromptComfyUI, nodeId: string, secao: object | undefined): void {
  if (!secao) return;
  for (const [chave, valor] of Object.entries(secao as Record<string, unknown>)) {
    if (valor !== undefined) workflow[nodeId]!.inputs[chave] = valor;
  }
}

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

/** Clona o template e aplica os campos mesclados (`mesclarCampos`) nos
 * inputs dos nodes correspondentes, mais a seed, o prefixo de arquivo desta
 * geração específica e a configuração de modelo/sampler (`geracaoArt.modelo`,
 * se declarada). Campos ausentes mantêm o valor que já estava no template
 * (não são apagados). */
export function montarPrompt(
  template: PromptComfyUI,
  campos: OOPCamposCompostos,
  opcoes: OpcoesMontagem
): PromptComfyUI {
  const workflow = structuredClone(template);

  aplicarSecao(workflow, NODE_IDS.style, campos.style);
  aplicarSecao(workflow, NODE_IDS.view, campos.view);
  aplicarSecao(workflow, NODE_IDS.hair, campos.hair);
  aplicarSecao(workflow, NODE_IDS.eyes, campos.eyes);
  aplicarSecao(workflow, NODE_IDS.mouth, campos.mouth);
  aplicarSecao(workflow, NODE_IDS.clothing, campos.clothing);
  aplicarSecao(workflow, NODE_IDS.pose, campos.pose);
  aplicarSecao(workflow, NODE_IDS.person, campos.person);

  workflow[NODE_IDS.textoLivre]!.inputs.string_b = campos.extra ?? '';
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
