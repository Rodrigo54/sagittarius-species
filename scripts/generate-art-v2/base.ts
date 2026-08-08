import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

/** Duplicado de `scripts/generate-art/base.ts` (+ `base.json`) — pose,
 * enquadramento de câmera e estilo travados pra bater sempre com o rig
 * `ssm_shared`/`sl_shared`, e o negativo compartilhado de qualidade/anatomia,
 * exatamente como no v1 (é uma característica do rig/composição, não do
 * motor de difusão por trás — continua valendo em Flux2 igual valia em
 * SDXL). Duplicado (não importado) por `generate-art-v2/` continuar
 * autocontida mesmo se `scripts/generate-art/` for apagada no futuro.
 *
 * Conteúdo herdado tal como estava no v1 nesta duplicação inicial — ajustar
 * o texto (`style`/`negative`, em especial) é esperado durante os testes
 * interativos com Flux2, já que "masterpiece"/"best quality" etc. são
 * convenção de prompt de checkpoints SDXL e podem não ter o mesmo efeito
 * (ou podem até atrapalhar) num modelo com seguimento de texto mais forte.
 * Se este arquivo for ajustado aqui, não precisa refletir no irmão do v1 —
 * os dois são independentes por design (ver decisão de duplicação). */
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

/** Lição real (`ssm_default`, variante "distilled"/`cfg: 1`): nessa
 * combinação o node negativo do template é `ConditioningZeroOut`, não
 * `CLIPTextEncode` (ver `workflow.ts`) — `negative` (deste arquivo e de todo
 * `extra_prompt.negative`) é descartado antes de chegar no grafo, CFG=1 zera
 * a guidance negativa de qualquer jeito. Pra espécie nessa variante, a única
 * alavanca contra algo que o checkpoint insiste em gerar errado é o
 * **positivo**, e duas armadilhas já morderam aqui:
 * 1. Negação simples ("no helmet") é fraca sem CFG negativo pra contrastar —
 *    o token do conceito negado ainda entra na condicional. Preferir
 *    exclusão explícita do objeto ("no hood, no head covering") reforçada
 *    por uma afirmação do estado desejado ("full head of hair"), não só a
 *    negação sozinha.
 * 2. "bare head"/"uncovered head" é ambíguo com calvície nas legendas de
 *    treino do modelo — pra excluir capuz/capacete, isso pode sair como
 *    careca em vez de "sem capuz" (caso real: `ssm_default` macho 001 saiu
 *    careco depois de um `extra_prompt.positive` com essa frase). Evitar
 *    "bare"/"uncovered" perto de "head"; usar termos de peça de roupa (hood,
 *    helmet, covering), não de pele/couro cabeludo.
 * Bônus, não específico da variante: `extra_prompt` concatena entre níveis
 * (base→gênero→variante, nunca o último vencendo — ver `merge.ts`), então a
 * mesma instrução repetida em dois níveis soma peso/repetição sem querer.
 * Declarar uma instrução de cabeça/cabelo uma única vez (o nível mais amplo
 * que já baste, tipicamente `base`), não duplicar em `male`/`female`. */

const CAMINHO_BASE_JSON = join(import.meta.dir, 'base.json');

/** Lê e valida `base.json` uma vez, na primeira importação — falha rápido
 * (erro descritivo do zod) se o arquivo estiver malformado, em vez de deixar
 * um `undefined` silencioso vazar pro meio de um prompt composto depois. */
export const BASE_FIXO: BaseFixo = zBaseFixo.parse(JSON.parse(readFileSync(CAMINHO_BASE_JSON, 'utf8')));
