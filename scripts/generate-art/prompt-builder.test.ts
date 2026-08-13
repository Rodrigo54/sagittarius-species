import { describe, expect, test } from 'bun:test';
import { ErroCampoObrigatorio } from '../portrait-schema';
import type { BaseArt } from './base';
import { montarPrompts } from './prompt-builder';

/** `base.json` de teste — não usa o arquivo real do produto pra o teste não
 * quebrar toda vez que o texto for ajustado por conteúdo; aqui importa o
 * comportamento do motor (ordem, descarte de vazio, template de espécie
 * sobrescrevendo o default, extra depois do template). */
const BASE_TESTE: BaseArt = {
  fixed: {
    style: 'ESTILO_FIXO',
    view: 'VIEW_FIXO',
    pose: 'POSE_FIXO',
    expression: 'EXPRESSAO_FIXA',
    negative: 'NEGATIVO_BASE',
  },
  templates: {
    species: '<species.archetype>',
    person: '[<person.age>-year-old ][<person.gender>, ][<person.body_shape> build]',
    hair: '([<hair.primary_color> ][<hair.style> ]hair[ with <hair.secondary_color> highlights])',
    eyes: '[(<eyes.color> eyes:1.2)]',
    torso: '[<torso.primary_color>[ and <torso.secondary_color>]]',
  },
  vocabulary: {
    'torso.state': {
      FullyCovered: { positive: 'torso fully covered by armor', negative: '(bare stomach:1.2)' },
      PartiallyCovered: { positive: 'torso partially covered' },
    },
    'eyes.shape': {
      Round: { positive: 'round-shaped eyes' },
      Hooded: { positive: 'droopy eyelids', negative: '(hood, hoodie:1.2)' },
    },
    'person.ethnicity': {
      African: { positive: '(African, dark skin:1.3)' },
    },
    'person.gender': {
      Male: { positive: 'man', negative: '(androgynous, feminine:1.2)' },
      Androgynous: { positive: 'androgynous person' },
    },
  },
  order: {
    positive: [
      'fixed.style',
      'eyes.template',
      'person.ethnicity',
      'species.template',
      'species.extra',
      'person.template',
      'person.extra',
      'hair.template',
      'hair.extra',
      'eyes.shape',
      'eyes.extra',
      'torso.state',
      'torso.template',
      'torso.extra',
      'fixed.expression',
      'fixed.pose',
      'fixed.view',
    ],
    negative: ['fixed.negative', 'torso.state', 'person.gender', 'eyes.shape'],
  },
};

function montar(campos: Parameters<typeof montarPrompts>[0]) {
  return montarPrompts(campos, BASE_TESTE, 'especie/male/001');
}

describe('montarPrompts — ordem', () => {
  test('a ordem do prompt é a declarada em order.positive, não a ordem das seções no objeto', () => {
    const { positive } = montar({
      torso: { state: 'FullyCovered' },
      eyes: { color: 'Violet' },
      person: { ethnicity: 'African' },
      species: { archetype: 'Human' },
    });
    const posicoes = ['ESTILO_FIXO', '(violet eyes:1.2)', '(African, dark skin:1.3)', 'human', 'torso fully covered'].map(
      (trecho) => positive.indexOf(trecho)
    );
    expect(posicoes.every((p) => p >= 0)).toBe(true);
    expect([...posicoes].sort((a, b) => a - b)).toEqual(posicoes);
  });

  test('as âncoras com peso entram logo depois do estilo, antes do resto', () => {
    const { positive } = montar({ eyes: { color: 'Blue' }, person: { ethnicity: 'African', age: 20 } });
    expect(positive.indexOf('ESTILO_FIXO')).toBe(0);
    expect(positive.indexOf('(blue eyes:1.2)')).toBeLessThan(positive.indexOf('(African, dark skin:1.3)'));
    expect(positive.indexOf('(African, dark skin:1.3)')).toBeLessThan(positive.indexOf('20-year-old'));
  });

  test('extra de uma seção sai logo depois do template dela, não no fim do prompt', () => {
    const { positive } = montar({
      hair: { primary_color: 'Blonde', extra: 'wet hair' },
      torso: { state: 'FullyCovered', primary_color: 'Gold' },
    });
    expect(positive.indexOf('wet hair')).toBeGreaterThan(positive.indexOf('blonde'));
    expect(positive.indexOf('wet hair')).toBeLessThan(positive.indexOf('torso fully covered'));
  });

  test('ordem do negativo: baseline → torso.state → gênero → eyes.shape', () => {
    const { negative } = montar({
      torso: { state: 'FullyCovered' },
      person: { gender: 'Male' },
      eyes: { shape: 'Hooded' },
    });
    expect(negative).toBe('NEGATIVO_BASE, (bare stomach:1.2), (androgynous, feminine:1.2), (hood, hoodie:1.2)');
  });
});

describe('montarPrompts — templates', () => {
  test('sem template na espécie, a seção usa o template default do base.json', () => {
    const { positive } = montar({ hair: { primary_color: 'Blonde', style: 'Long Curly' } });
    expect(positive).toContain('(blonde long curly hair)');
  });

  test('template da espécie substitui o default daquela seção', () => {
    const { positive } = montar({
      hair: { primary_color: 'Blonde', template: 'side braid in <hair.primary_color>' },
    });
    expect(positive).toContain('side braid in blonde');
    expect(positive).not.toContain('(blonde hair)');
  });

  test('template da espécie posiciona cada cor na peça certa (caso ssm_mermaids)', () => {
    const { positive } = montar({
      torso: {
        state: 'FullyCovered',
        primary_color: 'Salmon',
        secondary_color: 'Turquoise',
        template: 'fish-scale top in <torso.primary_color>, waistband in <torso.secondary_color>',
      },
    });
    expect(positive).toContain('fish-scale top in salmon, waistband in turquoise');
  });

  test('template literal, sem placeholder, é usado como está (caso ssm_astral)', () => {
    const { positive } = montar({ torso: { state: 'FullyCovered', template: 'ornate armor with gold trim' } });
    expect(positive).toContain('ornate armor with gold trim');
  });

  test('placeholder obrigatório sem valor lança erro nomeando a variante', () => {
    expect(() =>
      montar({ torso: { state: 'FullyCovered', template: 'scale top in <torso.primary_color>' } })
    ).toThrow(ErroCampoObrigatorio);
    try {
      montar({ torso: { template: 'scale top in <torso.primary_color>' } });
    } catch (erro) {
      expect((erro as ErroCampoObrigatorio).message).toContain('especie/male/001');
    }
  });
});

describe('montarPrompts — seções e fragmentos vazios', () => {
  test('seção ausente não emite template, extra nem vocabulário', () => {
    const { positive } = montar({ person: { age: 20 } });
    expect(positive).not.toContain('hair');
    expect(positive).not.toContain('eyes');
  });

  test('seção presente sem os campos do template não deixa fragmento capenga', () => {
    const { positive } = montar({ eyes: { shape: 'Round' } });
    expect(positive).toContain('round-shaped eyes');
    expect(positive).not.toContain(':1.2)');
    expect(positive).not.toContain(',,');
  });

  test('valor de enum sem lado negativo não adiciona nada ao negativo', () => {
    expect(montar({ torso: { state: 'PartiallyCovered' } }).negative).toBe('NEGATIVO_BASE');
    expect(montar({ person: { gender: 'Androgynous' } }).negative).toBe('NEGATIVO_BASE');
  });

  test('campos totalmente vazios não quebram e não deixam "undefined" nem vírgula dupla', () => {
    const { positive, negative } = montar({});
    expect(positive).not.toContain('undefined');
    expect(positive).not.toContain(',,');
    expect(negative).toBe('NEGATIVO_BASE');
  });
});

describe('montarPrompts — determinismo', () => {
  test('a mesma entrada produz sempre a mesma saída, byte a byte', () => {
    const campos = {
      species: { archetype: 'Robot' as const, template: '<species.archetype>, cute Pixar-style robot' },
      person: { age: 12, ethnicity: 'African' as const, body_shape: 'Slim' as const, gender: 'Male' as const },
      hair: { style: 'Spiky' as const, primary_color: 'Silver' as const },
      eyes: { shape: 'Round' as const, color: 'Blue' as const },
      torso: { state: 'FullyCovered' as const, template: 'shiny plastic shell', extra: 'small and friendly' },
    };
    expect(montar(campos)).toEqual(montar(campos));
  });
});
