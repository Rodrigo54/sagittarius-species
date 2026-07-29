import type {
  OOPCamposCabelo,
  OOPCamposBoca,
  OOPCamposCompostos,
  OOPCamposEstilo,
  OOPCamposOlhos,
  OOPCamposPessoa,
  OOPCamposPose,
  OOPCamposRoupa,
  OOPCamposVista,
} from './oop-types';

function mesclarSecao<T extends object>(secoes: (T | undefined)[]): T | undefined {
  const presentes = secoes.filter((secao): secao is T => secao !== undefined);
  if (presentes.length === 0) return undefined;
  return Object.assign({}, ...presentes) as T;
}

/** Merge raso por seção: `base` → override de gênero → override de
 * variante, nessa ordem — cada seção (`person`, `hair`, `eyes`...) mescla os
 * campos que cada nível declara, e o último nível a declarar um campo
 * vence. `extra` (texto livre) é a exceção: concatena os três níveis (em vez
 * de o último vencer), porque na prática cada nível sempre quis *acrescentar*
 * ênfase (ex.: uma variante reforçando tom de pele) sem descartar o que a
 * base já declarou (estilo 3D, sem capacete, etc.) — override integral
 * exigiria duplicar o texto da base em toda variante que precisasse de um
 * detalhe a mais. */
export function mesclarCampos(...blocos: OOPCamposCompostos[]): OOPCamposCompostos {
  return {
    person: mesclarSecao<OOPCamposPessoa>(blocos.map((b) => b.person)),
    hair: mesclarSecao<OOPCamposCabelo>(blocos.map((b) => b.hair)),
    eyes: mesclarSecao<OOPCamposOlhos>(blocos.map((b) => b.eyes)),
    mouth: mesclarSecao<OOPCamposBoca>(blocos.map((b) => b.mouth)),
    clothing: mesclarSecao<OOPCamposRoupa>(blocos.map((b) => b.clothing)),
    pose: mesclarSecao<OOPCamposPose>(blocos.map((b) => b.pose)),
    style: mesclarSecao<OOPCamposEstilo>(blocos.map((b) => b.style)),
    view: mesclarSecao<OOPCamposVista>(blocos.map((b) => b.view)),
    extra: blocos
      .map((b) => b.extra)
      .filter((texto): texto is string => !!texto)
      .join(', '),
  };
}
