import type { CamposCompostos, ExtraPrompt, Tipo } from '../portrait-schema';

/** Opera só em cima de `CamposCompostos`
 * (`tipo`/`person`/`hair`/`eyes`/`torso`/`extra_prompt`), agnóstico de motor
 * de geração. */

function mesclarSecao<T extends object>(secoes: (T | undefined)[]): T | undefined {
  const presentes = secoes.filter((secao): secao is T => secao !== undefined);
  if (presentes.length === 0) return undefined;
  return Object.assign({}, ...presentes) as T;
}

/** `extra_prompt` concatena `positive`/`negative` de cada nível presente (em
 * vez do último vencer) — mesma regra e mesmo motivo do `extra` antigo
 * (string única): cada nível sempre quis *acrescentar* (reforço de etnia
 * numa variante, por exemplo) sem descartar o que a base já declarou. */
function mesclarExtraPrompt(blocos: (ExtraPrompt | undefined)[]): ExtraPrompt | undefined {
  const presentes = blocos.filter((b): b is ExtraPrompt => b !== undefined);
  if (presentes.length === 0) return undefined;

  const positive = presentes
    .map((b) => b.positive)
    .filter((texto): texto is string => !!texto)
    .join(', ');
  const negative = presentes
    .map((b) => b.negative)
    .filter((texto): texto is string => !!texto)
    .join(', ');

  const resultado: ExtraPrompt = {};
  if (positive) resultado.positive = positive;
  if (negative) resultado.negative = negative;
  return resultado;
}

/** `tipo` não mescla campo a campo (não faz sentido combinar `value` de
 * níveis diferentes) — o nível mais específico que declarar `tipo` vence
 * por inteiro, igual as outras seções simples (`person`, `hair`, `eyes`,
 * `torso`). Na prática só a `base` declara `tipo` hoje (é atributo de
 * espécie, não de indivíduo), mas nada impede um gênero/variante override
 * futuro. */
function mesclarTipo(blocos: (Tipo | undefined)[]): Tipo | undefined {
  const presentes = blocos.filter((b): b is Tipo => b !== undefined);
  // Pega o bloco inteiro do nível mais específico, não Object.assign campo a
  // campo — value e description são acoplados (uma description escrita pra
  // "Human, mystical..." não faz sentido sobrevivendo a um override de value
  // pra "Robot"), diferente de person/hair/eyes/torso, onde os campos são
  // fatos independentes que fazem sentido vindo de níveis diferentes.
  return presentes.length > 0 ? presentes[presentes.length - 1] : undefined;
}

/** Merge raso por seção: `base` → override de gênero → override de
 * variante, nessa ordem — cada seção (`person`, `hair`, `eyes`, `torso`...)
 * mescla os campos que cada nível declara, e o último nível a declarar um
 * campo vence. `extra_prompt` é a exceção: concatena os três níveis (ver
 * `mesclarExtraPrompt`) em vez de o último vencer, porque na prática cada
 * nível sempre quis *acrescentar* ênfase sem descartar o que a base já
 * declarou — override integral exigiria duplicar o texto da base em toda
 * variante que precisasse de um detalhe a mais. */
export function mesclarCampos(...blocos: CamposCompostos[]): CamposCompostos {
  const resultado: CamposCompostos = {
    tipo: mesclarTipo(blocos.map((b) => b.tipo)),
    person: mesclarSecao(blocos.map((b) => b.person)),
    hair: mesclarSecao(blocos.map((b) => b.hair)),
    eyes: mesclarSecao(blocos.map((b) => b.eyes)),
    torso: mesclarSecao(blocos.map((b) => b.torso)),
    extra_prompt: mesclarExtraPrompt(blocos.map((b) => b.extra_prompt)),
  };

  // Remove chaves undefined em vez de deixar `{ tipo: undefined, ... }` —
  // mais limpo pra log/depuração (--export-prompt) e pra validação zod, que
  // roda em modo strict e não distingue "chave ausente" de "chave presente
  // com valor undefined" em todo contexto.
  return Object.fromEntries(Object.entries(resultado).filter(([, v]) => v !== undefined)) as CamposCompostos;
}
