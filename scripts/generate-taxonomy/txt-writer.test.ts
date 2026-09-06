import { describe, expect, test } from 'bun:test';
import { derivarSets, type Filiacao } from './agrupamento';
import { gerarPortraitCategories, gerarPortraitSets } from './txt-writer';

function especie(
  slug: string,
  species_classes: Filiacao['species_classes'],
  categories: Filiacao['categories']
): Filiacao {
  return { slug, species_classes, categories };
}

function gerar(especies: Filiacao[]) {
  const { sets, erros } = derivarSets(especies);
  expect(erros).toEqual([]);
  return { portraitSets: gerarPortraitSets(sets), portraitCategories: gerarPortraitCategories(sets) };
}

describe('portrait_sets', () => {
  test('espécie sem condição vai para a lista simples, sem bloco condicional', () => {
    const { portraitSets } = gerar([especie('ssm_elves', ['HUM'], ['humanoids'])]);
    expect(portraitSets).toBe(
      `ssm_humanoids = {
  species_class = HUM
  portraits = {
    "ssm_elves"
  }
}
`
    );
  });

  test('espécie condicional sai em bloco próprio, com o mesmo trigger em randomizable e playable', () => {
    const { portraitSets } = gerar([especie('ssm_drakelings', ['INF', 'REP'], ['infernals', 'reptilians'])]);
    expect(portraitSets).toContain(
      `ssm_infernals = {
  species_class = INF
  conditional_portraits = {
    randomizable = {
      has_infernals = yes
    }
    playable = {
      has_infernals = yes
    }
    portraits = {
      "ssm_drakelings"
    }
  }
}`
    );
    // o fallback reptiliano nega o mesmo gate, e é o que evita a espécie
    // aparecer duas vezes para quem tem o DLC
    expect(portraitSets).toContain(`      has_infernals = no`);
  });

  test('cada espécie condicional tem seu bloco, mesmo com condições idênticas', () => {
    const { portraitSets } = gerar([
      especie('ssm_mermaids', ['AQUATIC', 'HUM'], ['aquatics', 'humanoids']),
      especie('ssm_nereidas', ['AQUATIC', 'HUM'], ['aquatics', 'humanoids']),
    ]);
    const blocosNoSetHumanoide = portraitSets
      .split(/\n(?=\w)/)
      .find((bloco) => bloco.startsWith('ssm_humanoids'))!
      .match(/conditional_portraits/g);
    expect(blocosNoSetHumanoide).toHaveLength(2);
  });

  test('um set com espécies condicionais e incondicionais tem os dois formatos', () => {
    const { portraitSets } = gerar([
      especie('ssm_elves', ['HUM'], ['humanoids']),
      especie('ssm_mermaids', ['AQUATIC', 'HUM'], ['aquatics', 'humanoids']),
    ]);
    const setHumanoide = portraitSets.split(/\n(?=\w)/).find((bloco) => bloco.startsWith('ssm_humanoids'))!;
    expect(setHumanoide).toContain(`  portraits = {\n    "ssm_elves"\n  }`);
    expect(setHumanoide).toContain(`conditional_portraits`);
  });
});

describe('portrait_sets — eixos independentes no fallback', () => {
  test('o fallback restringe a IA e libera o editor', () => {
    const { portraitSets } = gerar([especie('ssm_mermaids', ['AQUATIC', 'HUM'], ['aquatics', 'humanoids'])]);
    expect(portraitSets).toContain(
      `ssm_humanoids = {
  species_class = HUM
  conditional_portraits = {
    randomizable = {
      has_aquatics = no
    }
    playable = {
      always = yes
    }
    portraits = {
      "ssm_mermaids"
    }
  }
}`
    );
  });

  test('na classe premium os dois eixos carregam o gate', () => {
    const { portraitSets } = gerar([especie('ssm_mermaids', ['AQUATIC', 'HUM'], ['aquatics', 'humanoids'])]);
    expect(portraitSets).toContain(
      `ssm_aquatics = {
  species_class = AQUATIC
  conditional_portraits = {
    randomizable = {
      has_aquatics = yes
    }
    playable = {
      has_aquatics = yes
    }
    portraits = {
      "ssm_mermaids"
    }
  }
}`
    );
  });
});

describe('portrait_categories', () => {
  test('a guarda-chuva do mod vem primeiro e recebe os sets sempre disponíveis, sem ninguém declará-la', () => {
    const { portraitCategories } = gerar([
      especie('ssm_elves', ['HUM'], ['humanoids']),
      especie('ssm_drakelings', ['INF', 'REP'], ['infernals', 'reptilians']),
    ]);
    expect(portraitCategories.startsWith('sagittarius = {\n  name = ssm_sagittarius\n')).toBe(true);
    // ssm_infernals fica de fora: é condicionado ao DLC, e a aba do mod só
    // recebe os sets que existem para qualquer jogador
    expect(portraitCategories).toContain(
      `sagittarius = {
  name = ssm_sagittarius
  sets = {
    ssm_humanoids
    ssm_reptilians
  }
}`
    );
  });

  test('a relação é invertida: a categoria lista os sets que a declararam', () => {
    const { portraitCategories } = gerar([
      especie('ssm_mercenary', ['HUM'], ['humanoids', 'cybernetics']),
      especie('ssm_cyborg', ['MACHINE'], ['machines', 'cybernetics']),
    ]);
    expect(portraitCategories).toContain(
      `cybernetics = {
  name = CYBERNETIC
  sets = {
    ssm_humanoids
    ssm_machine
  }
}`
    );
  });

  test('o set condicionado a DLC fica fora da guarda-chuva, mas mantém a aba própria', () => {
    // se o set premium entrasse na aba do mod, quem não tem o DLC veria uma
    // célula cinza no lugar da espécie — o jogo deduplica pela primeira
    // ocorrência, não pela mais permissiva
    const { portraitCategories } = gerar([
      especie('ssm_elves', ['HUM'], ['humanoids']),
      especie('ssm_mermaids', ['AQUATIC', 'HUM'], ['aquatics', 'humanoids']),
    ]);
    const guardaChuva = portraitCategories.match(/sagittarius = \{[^]*?\n\}/)![0];
    expect(guardaChuva).toContain('ssm_humanoids');
    expect(guardaChuva).not.toContain('ssm_aquatics');
    expect(portraitCategories).toContain(
      `aquatics = {
  name = AQUATIC
  sets = {
    ssm_aquatics
  }
}`
    );
  });

  test('o name de uma categoria espelhada é a própria species_class', () => {
    const { portraitCategories } = gerar([especie('ssm_drakelings', ['REP'], ['reptilians'])]);
    expect(portraitCategories).toContain(`reptilians = {\n  name = REP`);
  });
});
