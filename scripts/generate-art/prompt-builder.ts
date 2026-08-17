import { interpolar, type CamposCompostos, type CamposParaInterpolacao } from '../portrait-schema';
import type { BaseArt } from './base';

/** Motor de composição dos prompts (positivo e negativo). **Não contém texto
 * de prompt**: cada fragmento vem de `base.json` — os fixos, o template
 * default de cada seção, o vocabulário de cada valor de enum — e a ordem em
 * que eles entram vem de `order`, no mesmo arquivo. Reposicionar um fragmento
 * ou reescrever uma frase é editar JSON, não TypeScript.
 *
 * Uma entrada de `order` é resolvida por forma:
 * - `fixed.<chave>` — texto fixo, usado como está.
 * - `<secao>.template` — template da espécie (`portrait.json`) ou, na falta
 *   dele, o default de `base.json`, passado pelo motor de interpolação.
 * - `<secao>.extra` — texto adicional daquela seção, também interpolado.
 * - `<secao>.<campo>` — texto de vocabulário para o valor declarado naquele
 *   campo, no lado (positivo/negativo) que está sendo montado.
 *
 * Seção ausente no objeto mesclado não emite nada — nem template, nem extra,
 * nem vocabulário —, e fragmento que resolve pra vazio é descartado, sem
 * deixar vírgula sobrando.
 *
 * O peso de ênfase (sintaxe A1111, `(texto:peso)`) é escrito no próprio texto
 * em `base.json`, com disciplina: só nas âncoras historicamente frágeis
 * (`eyes.color`, `person.ethnicity` — área pequena do rosto, posicionadas
 * cedo pela `order`) e nas exclusões estruturadas do negativo. Para
 * "distorção" (algo que o modelo insiste em gerar errado, tipo tronco exposto
 * ou aparência andrógina), o peso vai no NEGATIVO — o oposto do que se quer,
 * reforçado —, em vez de empilhar peso numa frase positiva longa; ver
 * `docs/history/2026-08-08-generate-art-schema-proprio.md` pro caso real por
 * trás dessa estratégia. */

type Lado = 'positive' | 'negative';

function secaoDe(campos: CamposCompostos, nome: string): Record<string, unknown> | undefined {
  return (campos as Record<string, Record<string, unknown> | undefined>)[nome];
}

function resolverFragmento(entrada: string, campos: CamposCompostos, base: BaseArt, lado: Lado, rotulo: string): string | undefined {
  const [prefixo, sufixo] = entrada.split('.') as [string, string];

  if (prefixo === 'fixed') return base.fixed[sufixo as keyof BaseArt['fixed']];

  const secao = secaoDe(campos, prefixo);
  if (!secao) return undefined;

  if (sufixo === 'template') {
    const template = (secao.template as string | undefined) ?? base.templates[prefixo as keyof BaseArt['templates']];
    return interpolar(template, campos as CamposParaInterpolacao, base.vocabulary, `${rotulo} (${entrada})`);
  }

  if (sufixo === 'extra') {
    const extra = secao.extra as string | undefined;
    if (!extra) return undefined;
    return interpolar(extra, campos as CamposParaInterpolacao, base.vocabulary, `${rotulo} (${entrada})`);
  }

  const valor = secao[sufixo];
  if (valor === undefined || valor === null) return undefined;
  return base.vocabulary[entrada]?.[String(valor)]?.[lado];
}

function montarLado(campos: CamposCompostos, base: BaseArt, lado: Lado, rotulo: string): string {
  return base.order[lado]
    .map((entrada) => resolverFragmento(entrada, campos, base, lado, rotulo))
    .filter((fragmento): fragmento is string => !!fragmento)
    .join(', ');
}

/** Monta os dois prompts finais a partir dos campos já mesclados
 * (`mesclarCampos`, base→gênero→variante) e do conteúdo de `base.json`.
 *
 * `rotulo` identifica a variante em mensagens de erro — um placeholder
 * obrigatório sem valor lança `ErroCampoObrigatorio` daqui, antes de qualquer
 * coisa ser enfileirada no ComfyUI. */
export function montarPrompts(
  campos: CamposCompostos,
  base: BaseArt,
  rotulo = 'variante'
): { positive: string; negative: string } {
  return {
    positive: montarLado(campos, base, 'positive', rotulo),
    negative: montarLado(campos, base, 'negative', rotulo),
  };
}
