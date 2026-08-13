import type { CamposCompostos } from '../portrait-schema';

/** Merge dos campos compostos: `base` → override de gênero → override de
 * variante, nessa ordem. Raso por seção — cada seção (`species`, `person`,
 * `hair`, `eyes`, `torso`) mescla os campos que cada nível declara, e o
 * último nível a declarar um campo vence.
 *
 * `extra` é a única exceção: concatena os níveis em vez de o último vencer.
 * Na prática cada nível sempre quer *acrescentar* (um reforço na variante,
 * um traço do gênero) sem descartar o que a base já declarou — override
 * integral exigiria duplicar o texto da base em toda variante que precisasse
 * de um detalhe a mais.
 *
 * Opera só em cima de `CamposCompostos`, agnóstico de motor de geração. */

/** Nome de toda seção possível — derivado do tipo, então uma seção nova no
 * schema quebra a build aqui até ser considerada. */
const SECOES = ['species', 'person', 'hair', 'eyes', 'torso'] as const satisfies readonly (keyof CamposCompostos)[];

type Secao = Record<string, unknown>;

function mesclarSecao(niveis: (Secao | undefined)[]): Secao | undefined {
  const presentes = niveis.filter((nivel): nivel is Secao => nivel !== undefined);
  if (presentes.length === 0) return undefined;

  const mesclado: Secao = Object.assign({}, ...presentes);

  const extras = presentes
    .map((nivel) => nivel.extra)
    .filter((extra): extra is string => typeof extra === 'string' && extra.length > 0);
  if (extras.length > 0) mesclado.extra = extras.join(', ');

  return mesclado;
}

export function mesclarCampos(...blocos: CamposCompostos[]): CamposCompostos {
  const resultado: Record<string, Secao | undefined> = {};

  for (const secao of SECOES) {
    const mesclado = mesclarSecao(blocos.map((bloco) => bloco[secao] as Secao | undefined));
    // Chave só entra se a seção existe em algum nível — `{ hair: undefined }`
    // sujaria o log de `--export-prompt` e a validação zod, que roda em modo
    // strict e não distingue "ausente" de "presente com undefined".
    if (mesclado !== undefined) resultado[secao] = mesclado;
  }

  return resultado as CamposCompostos;
}
