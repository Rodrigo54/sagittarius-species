import { describe, expect, test } from 'bun:test';
import type { BaseFixo } from './base';
import { montarPrompts } from './prompt-builder';

/** Duplicado de `scripts/generate-art/prompt-builder.test.ts` — ver o
 * comentário no topo de `prompt-builder.ts` sobre por que este arquivo é
 * duplicado em vez de importado do v1. */

/** `base.json` de teste — não usa `BASE_FIXO` real (o arquivo do produto)
 * pra o teste não quebrar toda vez que o texto fixo for ajustado por
 * conteúdo; só a forma / o comportamento do composer importa aqui. */
const BASE_TESTE: BaseFixo = {
  style: 'ESTILO_FIXO',
  view: 'VIEW_FIXO',
  pose: 'POSE_FIXO',
  expression: 'EXPRESSAO_FIXA',
  negative: 'NEGATIVO_BASE',
};

describe('montarPrompts', () => {
  test('só eyes.color e person.ethnicity recebem peso (:1.2) no positivo — as duas únicas âncoras', () => {
    const { positive } = montarPrompts(
      {
        eyes: { color: 'Violet' },
        person: { ethnicity: 'African' },
        tipo: { value: 'Human' },
        torso: { state: 'FullyCovered' },
        hair: { main_color: 'Violet' },
      },
      BASE_TESTE
    );
    expect(positive).toContain('(violet eyes:1.2)');
    expect(positive).toContain('(African:1.2)');
    // nada mais tem peso — só essas duas ocorrências de ":1.2)" no total.
    expect((positive.match(/:1\.2\)/g) ?? []).length).toBe(2);
  });

  test('peso vem logo depois do estilo, antes de tudo mais', () => {
    const { positive } = montarPrompts({ eyes: { color: 'Blue' }, person: { ethnicity: 'Asian' } }, BASE_TESTE);
    const idxEstilo = positive.indexOf('ESTILO_FIXO');
    const idxOlhos = positive.indexOf('(blue eyes:1.2)');
    const idxEtnia = positive.indexOf('(Asian:1.2)');
    expect(idxEstilo).toBe(0);
    expect(idxOlhos).toBeGreaterThan(idxEstilo);
    expect(idxEtnia).toBeGreaterThan(idxOlhos);
  });

  test('torso.state vira texto curto e afirmativo, SEM peso no positivo', () => {
    const { positive } = montarPrompts({ torso: { state: 'FullyCovered' } }, BASE_TESTE);
    expect(positive).toContain('torso fully covered by armor');
    expect(positive).not.toContain(':1.2)');
    expect(positive).not.toContain(':1.6)');
  });

  test('torso.state gera exclusão COM peso no negativo (o oposto do estado, é aqui que o reforço mora agora)', () => {
    const { negative } = montarPrompts({ torso: { state: 'FullyCovered' } }, BASE_TESTE);
    expect(negative).toBe('NEGATIVO_BASE, (bare stomach, bare midriff, exposed abs, shirtless:1.2)');
  });

  test('torso.state = PartiallyCovered não adiciona nada ao negativo (estado ambíguo de propósito)', () => {
    const { negative } = montarPrompts({ torso: { state: 'PartiallyCovered' } }, BASE_TESTE);
    expect(negative).toBe('NEGATIVO_BASE');
  });

  test('person.gender vira texto curto sem peso no positivo ("man"/"woman", sem frase extra)', () => {
    const { positive } = montarPrompts({ person: { gender: 'Male', age: 20 } }, BASE_TESTE);
    expect(positive).toContain('20-year-old man');
    expect(positive).not.toContain(':1.2)');
  });

  test('person.gender gera exclusão COM peso no negativo (androgynous/feminine ou androgynous/masculine)', () => {
    const male = montarPrompts({ person: { gender: 'Male' } }, BASE_TESTE);
    expect(male.negative).toBe('NEGATIVO_BASE, (androgynous, feminine:1.2)');
    const female = montarPrompts({ person: { gender: 'Female' } }, BASE_TESTE);
    expect(female.negative).toBe('NEGATIVO_BASE, (androgynous, masculine:1.2)');
  });

  test('person.gender = Androgynous não gera exclusão no negativo (estado ambíguo por natureza)', () => {
    const { negative } = montarPrompts({ person: { gender: 'Androgynous' } }, BASE_TESTE);
    expect(negative).toBe('NEGATIVO_BASE');
  });

  test('ordem do negativo: baseline → oposto de torso.state → oposto de gênero → extra_prompt.negative', () => {
    const { negative } = montarPrompts(
      { torso: { state: 'FullyCovered' }, person: { gender: 'Male' }, extra_prompt: { negative: 'REFORCO_ESPECIE' } },
      BASE_TESTE
    );
    const idxBase = negative.indexOf('NEGATIVO_BASE');
    const idxTorso = negative.indexOf('bare stomach');
    const idxGenero = negative.indexOf('androgynous');
    const idxExtra = negative.indexOf('REFORCO_ESPECIE');
    expect(idxBase).toBe(0);
    expect(idxTorso).toBeGreaterThan(idxBase);
    expect(idxGenero).toBeGreaterThan(idxTorso);
    expect(idxExtra).toBeGreaterThan(idxGenero);
  });

  test('extra_prompt.positive é sempre o último fragmento do prompt positivo', () => {
    const { positive } = montarPrompts({ person: { age: 20 }, extra_prompt: { positive: 'REFORCO_FINAL' } }, BASE_TESTE);
    expect(positive.endsWith('REFORCO_FINAL')).toBe(true);
  });

  test('sem extra_prompt.negative, o negativo é só o compartilhado (sem vírgula sobrando no fim)', () => {
    const { negative } = montarPrompts({}, BASE_TESTE);
    expect(negative).toBe('NEGATIVO_BASE');
  });

  test('campos totalmente vazios não quebram e não deixam "undefined"/vírgula dupla no texto', () => {
    const { positive, negative } = montarPrompts({}, BASE_TESTE);
    expect(positive).not.toContain('undefined');
    expect(positive).not.toContain(',,');
    expect(negative).not.toContain('undefined');
  });

  test('determinismo: a mesma entrada produz sempre a mesma saída, byte a byte', () => {
    const campos = {
      tipo: { value: 'Robot' as const, description: 'cute Pixar-style robot' },
      person: { age: 12, ethnicity: 'Asian' as const, body_shape: 'Slim' as const, gender: 'Male' as const },
      hair: { style: 'Spiky' as const, main_color: 'Silver' as const },
      eyes: { shape: 'Round' as const, color: 'Blue' as const },
      torso: { description: 'shiny plastic shell', state: 'FullyCovered' as const },
      extra_prompt: { positive: 'small and friendly', negative: 'no sharp edges' },
    };
    const r1 = montarPrompts(campos, BASE_TESTE);
    const r2 = montarPrompts(campos, BASE_TESTE);
    expect(r1).toEqual(r2);
  });
});
