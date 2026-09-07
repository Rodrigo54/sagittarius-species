import { describe, expect, test } from 'bun:test';
import { derivarSets, type Filiacao, type LinhaTrigger } from './agrupamento';

/** Fixtures montadas na mão: o teste é sobre as regras de derivação, não sobre
 * a filiação real das espécies do produto (essa muda a cada espécie nova). */
function especie(
  slug: string,
  species_classes: Filiacao['species_classes'],
  categories: Filiacao['categories']
): Filiacao {
  return { slug, species_classes, categories };
}

/** Atalho de leitura: o set de nome `nome`, com as condições de cada espécie
 * achatadas em texto (`has_infernals=no`), que é o que os testes afirmam. */
function texto(linha: LinhaTrigger): string {
  switch (linha.tipo) {
    case 'trigger':
      return `${linha.trigger}=${linha.valor}`;
    case 'always':
      return `always=${linha.valor}`;
  }
}

function set(sets: ReturnType<typeof derivarSets>['sets'], nome: string) {
  const encontrado = sets.find((s) => s.nome === nome);
  if (!encontrado) throw new Error(`set "${nome}" não existe (existem: ${sets.map((s) => s.nome).join(', ')})`);
  return {
    species_class: encontrado.species_class,
    categorias: encontrado.categorias,
    naGuardaChuva: encontrado.naGuardaChuva,
    entradas: encontrado.entradas.map((entrada) => ({
      slug: entrada.slug,
      randomizable: entrada.randomizable.map(texto),
      condicoes: entrada.playable.map(texto),
    })),
  };
}

describe('condições derivadas da ordem de species_classes', () => {
  test('classe sem DLC sozinha não gera condição nenhuma', () => {
    const { sets, erros } = derivarSets([especie('ssm_elves', ['HUM'], ['humanoids'])]);
    expect(erros).toEqual([]);
    expect(set(sets, 'ssm_humanoids').entradas).toEqual([
      { slug: 'ssm_elves', randomizable: [], condicoes: [] },
    ]);
  });

  test('classe com DLC sozinha só afirma o gate — sem o DLC, a espécie não existe', () => {
    const { sets } = derivarSets([especie('ssm_x', ['INF'], ['infernals'])]);
    expect(set(sets, 'ssm_infernals').entradas[0]!.condicoes).toEqual(['has_infernals=yes']);
  });

  test('a preferida afirma o gate e o fallback o nega — a IA sorteia numa classe só', () => {
    const { sets } = derivarSets([especie('ssm_mermaids', ['AQUATIC', 'HUM'], ['aquatics', 'humanoids'])]);
    expect(set(sets, 'ssm_aquatics').entradas[0]!.randomizable).toEqual(['has_aquatics=yes']);
    expect(set(sets, 'ssm_humanoids').entradas[0]!.randomizable).toEqual(['has_aquatics=no']);
  });

  test('as negações se acumulam: a terceira classe nega as duas anteriores', () => {
    const { sets } = derivarSets([
      especie('ssm_x', ['AQUATIC', 'INF', 'HUM'], ['aquatics', 'infernals', 'humanoids']),
    ]);
    expect(set(sets, 'ssm_aquatics').entradas[0]!.randomizable).toEqual(['has_aquatics=yes']);
    expect(set(sets, 'ssm_infernals').entradas[0]!.randomizable).toEqual(['has_aquatics=no', 'has_infernals=yes']);
    expect(set(sets, 'ssm_humanoids').entradas[0]!.randomizable).toEqual(['has_aquatics=no', 'has_infernals=no']);
  });

  test('classe sem gate no meio da lista é erro — nada depois dela seria alcançável', () => {
    const { sets, erros } = derivarSets([especie('ssm_x', ['HUM', 'AQUATIC'], ['humanoids', 'aquatics'])]);
    expect(sets).toEqual([]);
    expect(erros).toHaveLength(1);
    expect(erros[0]).toContain('nunca seriam alcançadas');
  });

  test('duas classes com DLC sem fallback: quem não tem nenhum dos dois fica sem a espécie', () => {
    const { sets, erros } = derivarSets([especie('ssm_x', ['INF', 'TOX'], ['infernals', 'toxoids'])]);
    expect(erros).toEqual([]);
    expect(set(sets, 'ssm_toxoids').entradas[0]!.randomizable).toEqual(['has_infernals=no', 'has_toxoids=yes']);
    // é a última classe, então o editor a oferece — mas a classe TOX em si
    // continua exigindo o DLC dela, e a célula fica cinza pra quem não tem
    expect(set(sets, 'ssm_toxoids').entradas[0]!.condicoes).toEqual(['always=yes']);
  });
});

describe('agrupamento por (species_class × categorias)', () => {
  test('mesma classe e mesmas categorias compartilham o set', () => {
    const { sets } = derivarSets([
      especie('ssm_elves', ['HUM'], ['humanoids']),
      especie('ssm_default', ['HUM'], ['humanoids']),
    ]);
    expect(sets).toHaveLength(1);
    expect(set(sets, 'ssm_humanoids').entradas.map((e) => e.slug)).toEqual(['ssm_default', 'ssm_elves']);
  });

  test('mesma classe com categorias diferentes rende sets separados, com sufixo temático', () => {
    const { sets } = derivarSets([
      especie('ssm_elves', ['HUM'], ['humanoids']),
      especie('ssm_mercenary', ['HUM'], ['humanoids', 'cybernetics']),
      especie('ssm_astral', ['HUM'], ['humanoids', 'psionics']),
    ]);
    expect(sets.map((s) => s.nome)).toEqual([
      'ssm_humanoids',
      'ssm_humanoids_cybernetics',
      'ssm_humanoids_psionics',
    ]);
  });

  test('classe com um grupo só mantém o nome curto, mesmo com categorias temáticas', () => {
    const { sets } = derivarSets([
      especie('ssm_cyborg', ['MACHINE'], ['machines', 'synthetics', 'cybernetics']),
    ]);
    // ssm_robots também sai — toda espécie MACHINE entra lá também, ver
    // describe('derivação de ROBOT a partir de MACHINE')
    expect(sets.map((s) => s.nome)).toEqual(['ssm_machine', 'ssm_robots']);
  });

  test('o set de uma classe não herda a categoria espelhada da outra classe da espécie', () => {
    // A sereia declara aquatics + humanoids; o set aquático leva só aquatics,
    // senão ela apareceria na aba humanoide duas vezes (uma por set).
    const { sets } = derivarSets([especie('ssm_mermaids', ['AQUATIC', 'HUM'], ['aquatics', 'humanoids'])]);
    expect(set(sets, 'ssm_aquatics').categorias).toEqual(['aquatics']);
    expect(set(sets, 'ssm_humanoids').categorias).toEqual(['humanoids']);
  });

  test('categoria temática vale para todas as classes da espécie', () => {
    const { sets } = derivarSets([
      especie('ssm_x', ['AQUATIC', 'HUM'], ['aquatics', 'humanoids', 'cybernetics']),
    ]);
    expect(set(sets, 'ssm_aquatics').categorias).toEqual(['aquatics', 'cybernetics']);
    expect(set(sets, 'ssm_humanoids').categorias).toEqual(['humanoids', 'cybernetics']);
  });

  test('o sufixo só aparece quando a classe passa a ter um segundo grupo', () => {
    // Consequência de manter os nomes curtos onde não há ambiguidade: o nome
    // de um set depende do conjunto inteiro de espécies, não só da espécie que
    // o originou. Um grupo temático sozinho na classe usa o nome curto e, no
    // dia em que outro grupo da mesma classe aparecer, ganha o sufixo. Nome de
    // set é referenciado só por portrait_categories (que é gerado junto), então
    // renomear não quebra nada in-game.
    const sozinho = derivarSets([especie('ssm_a', ['HUM'], ['humanoids', 'cybernetics'])]);
    expect(sozinho.sets.map((s) => s.nome)).toEqual(['ssm_humanoids']);

    const acompanhado = derivarSets([
      especie('ssm_a', ['HUM'], ['humanoids', 'cybernetics']),
      especie('ssm_b', ['HUM'], ['humanoids']),
    ]);
    expect(acompanhado.sets.map((s) => s.nome)).toEqual(['ssm_humanoids', 'ssm_humanoids_cybernetics']);
  });

  test('dois grupos da mesma classe que resolveriam para o mesmo nome é erro', () => {
    // Ambos terminam em "_cybernetics": um declara a categoria espelhada, o
    // outro não — o sufixo temático sozinho não os distingue.
    const { erros } = derivarSets([
      especie('ssm_a', ['HUM'], ['humanoids', 'cybernetics']),
      especie('ssm_b', ['HUM'], ['cybernetics']),
    ]);
    expect(erros).toHaveLength(1);
    expect(erros[0]).toContain('ssm_humanoids_cybernetics');
  });
});

describe('o que o editor de império oferece', () => {
  test('na última classe a espécie é sempre escolhível, mesmo com o DLC da preferida', () => {
    // playable falso não esconde a célula: deixa cinza. Condicionar o fallback
    // faria a sereia aparecer bloqueada na aba Humanoid justamente pra quem
    // tem o Aquatics — o oposto da intenção.
    const { sets } = derivarSets([especie('ssm_mermaids', ['AQUATIC', 'HUM'], ['aquatics', 'humanoids'])]);
    const entrada = set(sets, 'ssm_humanoids').entradas[0]!;
    expect(entrada.randomizable).toEqual(['has_aquatics=no']);
    expect(entrada.condicoes).toEqual(['always=yes']);
  });

  test('na classe premium o editor acompanha a IA — sem o DLC a célula fica cinza, como vitrine', () => {
    const { sets } = derivarSets([especie('ssm_mermaids', ['AQUATIC', 'HUM'], ['aquatics', 'humanoids'])]);
    const entrada = set(sets, 'ssm_aquatics').entradas[0]!;
    expect(entrada.randomizable).toEqual(['has_aquatics=yes']);
    expect(entrada.condicoes).toEqual(['has_aquatics=yes']);
  });

  test('espécie de classe única não ganha condição em eixo nenhum', () => {
    const { sets } = derivarSets([especie('ssm_elves', ['HUM'], ['humanoids'])]);
    const entrada = set(sets, 'ssm_humanoids').entradas[0]!;
    expect(entrada.randomizable).toEqual([]);
    expect(entrada.condicoes).toEqual([]);
  });
});

describe('categoria guarda-chuva', () => {
  test('recebe o set de fallback, não o premium', () => {
    // o jogo deduplica por aba ficando com a PRIMEIRA ocorrência, e célula
    // não-playable aparece cinza: um set premium na aba do mod deixaria a
    // espécie cinza pra quem não tem o DLC
    const { sets } = derivarSets([especie('ssm_mermaids', ['AQUATIC', 'HUM'], ['aquatics', 'humanoids'])]);
    expect(set(sets, 'ssm_humanoids').naGuardaChuva).toBe(true);
    expect(set(sets, 'ssm_aquatics').naGuardaChuva).toBe(false);
  });

  test('set sem fallback nenhum entra na guarda-chuva', () => {
    const { sets } = derivarSets([especie('ssm_elves', ['HUM'], ['humanoids'])]);
    expect(set(sets, 'ssm_humanoids').naGuardaChuva).toBe(true);
  });

  test('basta uma espécie ter o set como última opção pra ele entrar', () => {
    const { sets } = derivarSets([
      especie('ssm_mermaids', ['AQUATIC', 'HUM'], ['aquatics', 'humanoids']),
      especie('ssm_nereidas', ['AQUATIC'], ['aquatics']),
    ]);
    expect(set(sets, 'ssm_aquatics').naGuardaChuva).toBe(true);
  });
});

describe('derivação de ROBOT a partir de MACHINE', () => {
  // ROBOT é a species_class que o Stellaris atribui à espécie sintética da
  // Ascensão Sintética — nunca aparece na criação de império, só depois que a
  // partida já começou. Nenhuma espécie a declara: toda espécie MACHINE entra
  // automaticamente em ssm_robots também, pra ficar disponível quando alguém
  // ascender a sintético.
  test('espécie MACHINE também entra em ssm_robots, incondicional', () => {
    const { sets } = derivarSets([especie('ssm_timbot', ['MACHINE'], ['machines'])]);
    expect(set(sets, 'ssm_robots')).toEqual({
      species_class: 'ROBOT',
      categorias: [],
      naGuardaChuva: false,
      entradas: [{ slug: 'ssm_timbot', randomizable: [], condicoes: [] }],
    });
  });

  test('espécie sem MACHINE não gera ssm_robots nenhum', () => {
    const { sets } = derivarSets([especie('ssm_elves', ['HUM'], ['humanoids'])]);
    expect(sets.some((s) => s.nome === 'ssm_robots')).toBe(false);
  });

  test('várias espécies MACHINE compartilham o mesmo ssm_robots, ordenadas por slug', () => {
    const { sets } = derivarSets([
      especie('ssm_timbot', ['MACHINE'], ['machines']),
      especie('ssm_cyborg', ['MACHINE'], ['machines', 'cybernetics']),
    ]);
    expect(set(sets, 'ssm_robots').entradas.map((e) => e.slug)).toEqual(['ssm_cyborg', 'ssm_timbot']);
  });
});

describe('determinismo', () => {
  test('a ordem de entrada das espécies não muda a saída', () => {
    const especies = [
      especie('ssm_mermaids', ['AQUATIC', 'HUM'], ['aquatics', 'humanoids']),
      especie('ssm_elves', ['HUM'], ['humanoids']),
      especie('ssm_drakelings', ['INF', 'REP'], ['infernals', 'reptilians']),
    ];
    const direto = derivarSets(especies);
    const invertido = derivarSets([...especies].reverse());
    expect(JSON.stringify(invertido.sets)).toBe(JSON.stringify(direto.sets));
  });
});
