import { CAMPOS_POR_SECAO } from './campos';
import { analisarTemplate, caminhosDoTemplate, ErroTemplate } from './interpolacao';

/** Caminhos aceitos num placeholder `<secao.campo>`, derivados de
 * `CAMPOS_POR_SECAO` — sem lista paralela mantida à mão: um campo novo no
 * schema vira interpolável no mesmo commit, e um campo removido invalida na
 * hora os templates que ainda o citavam.
 *
 * `template`/`extra` não entram: são texto de prompt, não dado, e um template
 * referenciar outro abriria recursão sem nenhum caso de uso real. */
export const CAMINHOS_INTERPOLAVEIS: ReadonlySet<string> = new Set(
  Object.entries(CAMPOS_POR_SECAO).flatMap(([secao, campos]) => Object.keys(campos).map((campo) => `${secao}.${campo}`))
);

/** Valida a FORMA de um template: sintaxe (colchetes/ângulos com par, caminho
 * no formato `secao.campo`) e existência de cada caminho citado. Devolve a
 * mensagem de erro, ou `undefined` se estiver válido — formato pensado pro
 * `superRefine` do zod, que precisa da mensagem, não de uma exceção.
 *
 * O que esta função NÃO valida: se o campo citado está de fato declarado em
 * alguma variante. Isso é validação cruzada com o `base.json` e com todos os
 * níveis de merge, feita no `generate-art`. */
export function validarSintaxeDeTemplate(template: string): string | undefined {
  let caminhos: string[];
  try {
    analisarTemplate(template);
    caminhos = caminhosDoTemplate(template);
  } catch (erro) {
    if (erro instanceof ErroTemplate) return erro.message;
    throw erro;
  }

  const invalidos = [...new Set(caminhos)].filter((caminho) => !CAMINHOS_INTERPOLAVEIS.has(caminho));
  if (invalidos.length === 0) return undefined;

  const validos = [...CAMINHOS_INTERPOLAVEIS].sort().join(', ');
  return `caminho inexistente no schema: ${invalidos.map((c) => `"<${c}>"`).join(', ')}. Caminhos válidos: ${validos}.`;
}
