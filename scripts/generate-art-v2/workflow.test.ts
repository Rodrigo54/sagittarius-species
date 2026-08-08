import { describe, expect, test } from 'bun:test';
import { montarPrompt, type PromptComfyUI } from './workflow';

/** Templates mínimos (só os nodes que `montarPrompt` toca) representando o
 * formato real de `ssm_species_portrait_workflow_v2.json` (base) e
 * `..._distilled.json` — não precisa do grafo inteiro (UNET/CLIP/VAE
 * loaders, remoção de fundo, SaveImage) pra testar a lógica de injeção, só
 * os IDs que `NODE_IDS` referencia. */
function templateBase(): PromptComfyUI {
  return {
    '3': { class_type: 'VAELoader', inputs: {} },
    '4': { class_type: 'CLIPTextEncode', inputs: { text: '' } },
    '5': { class_type: 'CLIPTextEncode', inputs: { text: '' } },
    '6': { class_type: 'EmptyFlux2LatentImage', inputs: { width: 1024, height: 1024 } },
    '7': { class_type: 'RandomNoise', inputs: { noise_seed: 0 } },
    '9': { class_type: 'Flux2Scheduler', inputs: { steps: 20, width: 1024, height: 1024 } },
    '10': { class_type: 'CFGGuider', inputs: { cfg: 5, positive: ['4', 0], negative: ['5', 0] } },
    '17': { class_type: 'SaveImage', inputs: { filename_prefix: 'x' } },
  };
}

function templateDistilled(): PromptComfyUI {
  const t = templateBase();
  t['5'] = { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['4', 0] } };
  t['9']!.inputs.steps = 4;
  t['10']!.inputs.cfg = 1;
  return t;
}

const PROMPTS = { positive: 'POSITIVO', negative: 'NEGATIVO' };

describe('montarPrompt', () => {
  test('injeta texto/seed/prefixo nos dois CLIPTextEncode (variante base)', () => {
    const w = montarPrompt(templateBase(), PROMPTS, { seed: 42, filenamePrefix: 'pref' });
    expect(w['4']!.inputs.text).toBe('POSITIVO');
    expect(w['5']!.inputs.text).toBe('NEGATIVO');
    expect(w['7']!.inputs.noise_seed).toBe(42);
    expect(w['17']!.inputs.filename_prefix).toBe('pref');
  });

  test('variante distilled: NÃO escreve .text no node negativo (ConditioningZeroOut não tem esse input)', () => {
    const w = montarPrompt(templateDistilled(), PROMPTS, { seed: 1, filenamePrefix: 'pref' });
    expect(w['4']!.inputs.text).toBe('POSITIVO');
    expect(w['5']!.inputs.text).toBeUndefined();
    expect(w['5']!.class_type).toBe('ConditioningZeroOut');
    // a conditioning de entrada do ConditioningZeroOut continua intacta
    expect(w['5']!.inputs.conditioning).toEqual(['4', 0]);
  });

  test('steps/cfg vêm de modelo quando declarados, senão preservam o valor do template', () => {
    const semModelo = montarPrompt(templateBase(), PROMPTS, { seed: 1, filenamePrefix: 'p' });
    expect(semModelo['9']!.inputs.steps).toBe(20);
    expect(semModelo['10']!.inputs.cfg).toBe(5);

    const comModelo = montarPrompt(templateBase(), PROMPTS, {
      seed: 1,
      filenamePrefix: 'p',
      modelo: { steps: 8, cfg: 1.5 },
    });
    expect(comModelo['9']!.inputs.steps).toBe(8);
    expect(comModelo['10']!.inputs.cfg).toBe(1.5);
  });

  test('aspectRatio ausente cai no padrão 1:1 (1024x1024) nos nodes 6 e 9', () => {
    const w = montarPrompt(templateBase(), PROMPTS, { seed: 1, filenamePrefix: 'p' });
    expect(w['6']!.inputs.width).toBe(1024);
    expect(w['6']!.inputs.height).toBe(1024);
    expect(w['9']!.inputs.width).toBe(1024);
    expect(w['9']!.inputs.height).toBe(1024);
  });

  test('aspectRatio declarado deriva width/height iguais nos nodes 6 e 9', () => {
    const w = montarPrompt(templateBase(), PROMPTS, { seed: 1, filenamePrefix: 'p', modelo: { aspectRatio: '2:3' } });
    expect(w['6']!.inputs.width).toBe(832);
    expect(w['6']!.inputs.height).toBe(1248);
    expect(w['9']!.inputs.width).toBe(832);
    expect(w['9']!.inputs.height).toBe(1248);
  });

  test('sem referência: CFGGuider continua ligado direto nos CLIPTextEncode do template, nenhum node novo criado', () => {
    const w = montarPrompt(templateBase(), PROMPTS, { seed: 1, filenamePrefix: 'p' });
    expect(Object.keys(w).length).toBe(Object.keys(templateBase()).length);
    expect(w['10']!.inputs.positive).toEqual(['4', 0]);
    expect(w['10']!.inputs.negative).toEqual(['5', 0]);
  });

  test('uma referência: cria 5 nodes novos (LoadImage/ImageScaleToTotalPixels/VAEEncode/2x ReferenceLatent) e rewire o CFGGuider', () => {
    const base = templateBase();
    const w = montarPrompt(base, PROMPTS, {
      seed: 1,
      filenamePrefix: 'p',
      imagensReferenciaEnviadas: ['ref1.png'],
    });
    expect(Object.keys(w).length).toBe(Object.keys(base).length + 5);
    // CFGGuider não aponta mais direto pro CLIPTextEncode
    expect(w['10']!.inputs.positive).not.toEqual(['4', 0]);
    expect(w['10']!.inputs.negative).not.toEqual(['5', 0]);

    const [idPos] = w['10']!.inputs.positive as [string, number];
    const [idNeg] = w['10']!.inputs.negative as [string, number];
    expect(w[idPos]!.class_type).toBe('ReferenceLatent');
    expect(w[idNeg]!.class_type).toBe('ReferenceLatent');
    // a primeira referência da cadeia parte do CLIPTextEncode original (4/5)
    expect(w[idPos]!.inputs.conditioning).toEqual(['4', 0]);
    expect(w[idNeg]!.inputs.conditioning).toEqual(['5', 0]);
  });

  test('duas referências: encadeia (a segunda ReferenceLatent parte da saída da primeira, não do CLIPTextEncode de novo)', () => {
    const base = templateBase();
    const w = montarPrompt(base, PROMPTS, {
      seed: 1,
      filenamePrefix: 'p',
      imagensReferenciaEnviadas: ['ref1.png', 'ref2.png'],
    });
    expect(Object.keys(w).length).toBe(Object.keys(base).length + 10);

    const [idPosFinal] = w['10']!.inputs.positive as [string, number];
    const referenceLatentFinal = w[idPosFinal]!;
    expect(referenceLatentFinal.class_type).toBe('ReferenceLatent');
    const [idConditioningEntrada] = referenceLatentFinal.inputs.conditioning as [string, number];
    // a conditioning de entrada do segundo ReferenceLatent é outro
    // ReferenceLatent (a cadeia), não o CLIPTextEncode original
    expect(w[idConditioningEntrada]!.class_type).toBe('ReferenceLatent');
    expect(idConditioningEntrada).not.toBe('4');
  });

  test('cada referência da cadeia usa o mesmo latente codificado nos dois ramos (positivo e negativo)', () => {
    const base = templateBase();
    const w = montarPrompt(base, PROMPTS, {
      seed: 1,
      filenamePrefix: 'p',
      imagensReferenciaEnviadas: ['ref1.png'],
    });
    const [idPos] = w['10']!.inputs.positive as [string, number];
    const [idNeg] = w['10']!.inputs.negative as [string, number];
    const latentPos = w[idPos]!.inputs.latent;
    const latentNeg = w[idNeg]!.inputs.latent;
    expect(latentPos).toEqual(latentNeg);
  });

  test('imagensReferenciaEnviadas vazio ([]) se comporta igual a undefined (sem cadeia)', () => {
    const base = templateBase();
    const w = montarPrompt(base, PROMPTS, { seed: 1, filenamePrefix: 'p', imagensReferenciaEnviadas: [] });
    expect(Object.keys(w).length).toBe(Object.keys(base).length);
  });
});
