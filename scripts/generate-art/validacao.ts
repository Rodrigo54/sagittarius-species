import { caminhosDoTemplate, type CamposCompostos, type GeneroAlvo, type PortraitConfig } from '../portrait-schema';
import type { BaseArt } from './base';
import { mesclarCampos } from './merge';
import { montarPrompts } from './prompt-builder';

/** Validação cruzada entre o `portrait.json` de uma espécie e o `base.json` —
 * a camada que só existe aqui porque só o `generate-art` conhece os dois
 * lados (a sintaxe dos templates, que não depende do `base.json`, já foi
 * validada pelo schema na leitura do arquivo).
 *
 * Roda sobre TODAS as variantes de TODOS os gêneros declarados, mesmo quando
 * a invocação pediu uma só (`-n 001`), e antes de qualquer coisa ser
 * enfileirada no ComfyUI — descobrir na variante 017 que o lote está quebrado
 * custa GPU e tempo; aqui não custa nada.
 *
 * Duas regras, as duas sobre o objeto JÁ MESCLADO (base → gênero → variante):
 *
 * 1. **Cobertura** — todo campo declarado precisa ser referenciado por algum
 *    template/extra ativo ou posicionado como vocabulário na `order`. Uma
 *    variante que declara `torso.secondary_color` sem que nada cite
 *    `<torso.secondary_color>` está pedindo uma cor que jamais chega no
 *    prompt: erro, não um lote de 25 imagens com a cor errada.
 * 2. **Obrigatoriedade** — placeholder fora de colchetes que não resolve.
 *    Vem de graça: montar o prompt de cada variante dispara
 *    `ErroCampoObrigatorio` do motor de interpolação. */

const GENEROS: readonly GeneroAlvo[] = ['male', 'female', 'flat'];

/** Campos de dado efetivamente declarados no objeto mesclado (`template` e
 * `extra` não contam — são o texto, não o dado que precisa chegar nele). */
function caminhosDeclarados(campos: CamposCompostos): string[] {
  const declarados: string[] = [];
  for (const [nomeDaSecao, secao] of Object.entries(campos as Record<string, Record<string, unknown> | undefined>)) {
    if (!secao) continue;
    for (const [campo, valor] of Object.entries(secao)) {
      if (campo === 'template' || campo === 'extra') continue;
      if (valor === undefined || valor === null) continue;
      declarados.push(`${nomeDaSecao}.${campo}`);
    }
  }
  return declarados;
}

/** Caminhos que chegam ao prompt desta variante: os citados por templates e
 * extras ativos (de qualquer seção — um template de torso pode citar
 * `<hair.primary_color>`), mais os posicionados como vocabulário na `order`. */
function caminhosCobertos(campos: CamposCompostos, base: BaseArt): Set<string> {
  const cobertos = new Set<string>();

  const posicionados = new Set([...base.order.positive, ...base.order.negative]);
  for (const entrada of posicionados) {
    if (entrada.startsWith('fixed.') || entrada.endsWith('.template') || entrada.endsWith('.extra')) continue;
    cobertos.add(entrada);
  }

  for (const [nomeDaSecao, secao] of Object.entries(campos as Record<string, Record<string, unknown> | undefined>)) {
    if (!secao) continue;

    if (posicionados.has(`${nomeDaSecao}.template`)) {
      const template =
        (secao.template as string | undefined) ?? base.templates[nomeDaSecao as keyof BaseArt['templates']];
      if (template) for (const caminho of caminhosDoTemplate(template)) cobertos.add(caminho);
    }

    if (posicionados.has(`${nomeDaSecao}.extra`)) {
      const extra = secao.extra as string | undefined;
      if (extra) for (const caminho of caminhosDoTemplate(extra)) cobertos.add(caminho);
    }
  }

  return cobertos;
}

export class ErroCoberturaDeCampo extends Error {
  constructor(
    readonly rotulo: string,
    readonly caminhos: string[]
  ) {
    super(
      `${rotulo}: ${caminhos.map((c) => `"${c}"`).join(', ')} ${caminhos.length === 1 ? 'está declarado' : 'estão declarados'} ` +
        `mas nenhum template referencia — o valor não chegaria ao prompt. Cite <${caminhos[0]}> no template da seção, ou remova o campo.`
    );
    this.name = 'ErroCoberturaDeCampo';
  }
}

/** Valida a espécie inteira. Lança no primeiro problema encontrado, com a
 * variante nomeada; devolve a quantidade de variantes conferidas. */
export function validarEspecie(config: PortraitConfig, slug: string, base: BaseArt): number {
  const geracaoArt = config.geracaoArt;
  if (!geracaoArt) return 0;

  let conferidas = 0;

  for (const genero of GENEROS) {
    const bloco = geracaoArt[genero];
    if (!bloco) continue;

    for (const chave of Object.keys(bloco.variantes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
      const rotulo = `${slug}/${genero}/${chave}`;
      const campos = mesclarCampos(geracaoArt.base, bloco, bloco.variantes[chave]!);

      const cobertos = caminhosCobertos(campos, base);
      const descobertos = caminhosDeclarados(campos).filter((caminho) => !cobertos.has(caminho));
      if (descobertos.length > 0) throw new ErroCoberturaDeCampo(rotulo, descobertos);

      // Monta os dois prompts só pelo efeito colateral: é o motor de
      // interpolação que reprova placeholder obrigatório sem valor.
      montarPrompts(campos, base, rotulo);
      conferidas++;
    }
  }

  return conferidas;
}
