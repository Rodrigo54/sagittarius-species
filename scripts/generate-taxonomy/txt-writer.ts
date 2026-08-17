import { CATEGORIAS_VALIDAS, type CategoriaId } from '../portrait-schema';
import type { EntradaDeSet, LinhaTrigger, SetDerivado } from './agrupamento';
import { CATEGORIA_GUARDA_CHUVA, nameDaCategoria } from './vocabulario';

/** Serializa os dois arquivos de `common/` que registram os retratos do mod.
 * Ambos são regenerados por inteiro a cada execução — como o
 * `ssm_<espécie>_portrait.txt` do `generate-portraits`, não são editados à
 * mão. Indentação de 2 espaços, seguindo o `.editorconfig` e o outro gerador. */

function linhas(linha: LinhaTrigger, recuo: string): string[] {
  switch (linha.tipo) {
    case 'trigger':
      return [`${recuo}${linha.trigger} = ${linha.valor}`];
    case 'always':
      return [`${recuo}always = ${linha.valor}`];
  }
}

function blocoDeEixo(rotulo: string, condicoes: LinhaTrigger[], recuo: string): string[] {
  return [
    `${recuo}${rotulo} = {`,
    ...condicoes.flatMap((condicao) => linhas(condicao, `${recuo}  `)),
    `${recuo}}`,
  ];
}

/** Um bloco por espécie condicional — nunca agrupando espécies de condição
 * igual. O arquivo fica mais longo, e em troca cada espécie é uma unidade
 * isolada: adicionar ou remover uma dá um diff de poucas linhas, e a ordem
 * dela na aba do editor é controlável espécie a espécie. */
function blocoCondicional(entrada: EntradaDeSet): string[] {
  return [
    `  conditional_portraits = {`,
    ...blocoDeEixo('randomizable', entrada.randomizable, '    '),
    ...blocoDeEixo('playable', entrada.playable, '    '),
    `    portraits = {`,
    `      "${entrada.slug}"`,
    `    }`,
    `  }`,
  ];
}

function incondicional(entrada: EntradaDeSet): boolean {
  return entrada.randomizable.length === 0 && entrada.playable.length === 0;
}

function blocoDeSet(set: SetDerivado): string[] {
  const simples = set.entradas.filter(incondicional);
  const condicionais = set.entradas.filter((entrada) => !incondicional(entrada));

  return [
    `${set.nome} = {`,
    `  species_class = ${set.species_class}`,
    ...(simples.length > 0
      ? [`  portraits = {`, ...simples.map((entrada) => `    "${entrada.slug}"`), `  }`]
      : []),
    ...condicionais.flatMap(blocoCondicional),
    `}`,
  ];
}

export function gerarPortraitSets(sets: SetDerivado[]): string {
  return sets.map((set) => blocoDeSet(set).join('\n')).join('\n\n') + '\n';
}

/** Inverte a relação declarada (cada set sabe suas categorias) para a forma
 * que o jogo lê (cada categoria lista seus sets), e acrescenta a guarda-chuva
 * do mod — que recebe só os sets sempre disponíveis (ver
 * `SetDerivado.naGuardaChuva`), pra que a aba do mod nunca mostre uma célula
 * cinza no lugar de uma espécie que o jogador pode usar. */
export function gerarPortraitCategories(sets: SetDerivado[]): string {
  const porCategoria = new Map<CategoriaId | typeof CATEGORIA_GUARDA_CHUVA, string[]>([
    [CATEGORIA_GUARDA_CHUVA, sets.filter((set) => set.naGuardaChuva).map((set) => set.nome)],
  ]);

  for (const set of sets) {
    for (const categoria of set.categorias) {
      porCategoria.set(categoria, [...(porCategoria.get(categoria) ?? []), set.nome]);
    }
  }

  // Ordem estável e legível: a guarda-chuva primeiro (é a identidade do mod),
  // depois as categorias na ordem do vocabulário, em vez da ordem em que os
  // sets calharam de citá-las.
  const ordenadas = [...porCategoria].sort(
    ([a], [b]) =>
      Number(b === CATEGORIA_GUARDA_CHUVA) - Number(a === CATEGORIA_GUARDA_CHUVA) ||
      CATEGORIAS_VALIDAS.indexOf(a as CategoriaId) - CATEGORIAS_VALIDAS.indexOf(b as CategoriaId)
  );

  const blocos = ordenadas.map(([categoria, nomes]) =>
    [
      `${categoria} = {`,
      `  name = ${nameDaCategoria(categoria)}`,
      `  sets = {`,
      ...nomes.map((nome) => `    ${nome}`),
      `  }`,
      `}`,
    ].join('\n')
  );

  return blocos.join('\n\n') + '\n';
}
