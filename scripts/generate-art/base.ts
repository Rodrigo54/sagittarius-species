import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

/** Tudo que é fixo/global na geração de arte via IA — pose, enquadramento de
 * câmera e estilo travados pra bater sempre com o rig `ssm_shared` (resolve
 * de vez o corte de braço/cabeça que motivou travar isso), a expressão fixa
 * que substituiu o campo `mouth`, e o negativo compartilhado de
 * qualidade/anatomia (antes hardcoded no node `11` do workflow ComfyUI,
 * agora composto em TS junto com `extra_prompt.negative` de cada espécie —
 * ver `prompt-builder.ts`). Nada disso é configurável por espécie: é
 * exatamente esse "sempre igual" que faz `base.json` valer a pena existir
 * como arquivo à parte, em vez de espalhado em `geracaoArt.base` de cada
 * `portrait.json`.
 *
 * Fica em `scripts/generate-art/`, não em `scripts/portrait-schema/` — é
 * config fixa do pipeline de geração de arte especificamente, não faz parte
 * do formato de `portrait.json` (que `portrait-schema/` descreve e que
 * `generate-portraits` também usa, sem nenhuma relação com isto aqui). */
const zBaseFixo = z
  .object({
    style: z.string().describe('Estilo de arte, sempre igual em toda espécie hoje (3D render de jogo, não fotorrealista).'),
    view: z.string().describe('Enquadramento de câmera fixo — plano, ângulo, fundo, iluminação. Travado junto com pose pra não reabrir o corte de braço/cabeça.'),
    pose: z.string().describe('Pose fixa, calibrada pra caber inteira no canvas do rig ssm_shared sem cortar braço/mão/cabeça.'),
    expression: z.string().describe('Expressão facial fixa — substitui o antigo campo mouth (variação de boca por indivíduo não vale o risco de sair de um enquadramento sério/consistente).'),
    negative: z.string().describe('Negativo compartilhado por toda espécie/variante — baseline de qualidade/anatomia + exclusões já testadas (capacete, logo real, armadura com bico). Concatenado com extra_prompt.negative de cada nível (base→gênero→variante).'),
  })
  .describe('Valores fixos/globais da geração de arte via IA — nunca variam por espécie.');

export type BaseFixo = z.infer<typeof zBaseFixo>;

const CAMINHO_BASE_JSON = join(import.meta.dir, 'base.json');

/** Lê e valida `base.json` uma vez, na primeira importação — falha rápido
 * (erro descritivo do zod) se o arquivo estiver malformado, em vez de deixar
 * um `undefined` silencioso vazar pro meio de um prompt composto depois. */
export const BASE_FIXO: BaseFixo = zBaseFixo.parse(JSON.parse(readFileSync(CAMINHO_BASE_JSON, 'utf8')));
