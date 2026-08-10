import { describe, expect, test } from 'bun:test';
import type { BaseFixo } from './base';
import { montarPrompts } from './prompt-builder';

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
  test('eyes.color e person.ethnicity são as duas únicas âncoras com peso no positivo', () => {
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
    expect(positive).toContain('(African, dark skin, deep brown skin tone, African facial features:1.3)');
    // nada mais tem peso — só as duas âncoras têm sintaxe "(...:peso)".
    expect((positive.match(/\([^()]*:\d\.\d\)/g) ?? []).length).toBe(2);
  });

  test('peso vem logo depois do estilo, antes de tudo mais', () => {
    const { positive } = montarPrompts({ eyes: { color: 'Blue' }, person: { ethnicity: 'Asian' } }, BASE_TESTE);
    const idxEstilo = positive.indexOf('ESTILO_FIXO');
    const idxOlhos = positive.indexOf('(blue eyes:1.2)');
    const idxEtnia = positive.indexOf('(Asian, light skin tone, East Asian facial features:1.3)');
    expect(idxEstilo).toBe(0);
    expect(idxOlhos).toBeGreaterThan(idxEstilo);
    expect(idxEtnia).toBeGreaterThan(idxOlhos);
  });

  test('cada uma das 7 etnias gera seu texto de reforço combinado (palavra crua + traços descritivos)', () => {
    const REFORCO_ESPERADO = {
      African: '(African, dark skin, deep brown skin tone, African facial features:1.3)',
      Asian: '(Asian, light skin tone, East Asian facial features:1.3)',
      Pacific: '(Pacific, Pacific Islander or Southeast Asian facial features, tan skin tone:1.3)',
      Mixed: '(Mixed, European and Indigenous Brazilian ancestry or European and African Brazilian ancestry, brown skin tone:1.3)',
      Caucasian: '(Caucasian, fair skin tone, European facial features:1.2)',
      Latino: '(Latino, olive/tan skin tone, Latin American facial features:1.2)',
      Nordic: '(Nordic, fair skin tone, Scandinavian facial features:1.2)',
    } as const;

    for (const [etnia, esperado] of Object.entries(REFORCO_ESPERADO)) {
      const { positive } = montarPrompts({ person: { ethnicity: etnia as never } }, BASE_TESTE);
      expect(positive).toContain(esperado);
    }
  });

  test('sem person.ethnicity, nenhum reforço de etnia entra no prompt', () => {
    const { positive } = montarPrompts({ person: { age: 20 } }, BASE_TESTE);
    expect(positive).not.toContain('facial features');
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

  test('eyes.shape Downturned/Upturned viram frase curta no positivo (canto do olho, olhar continua na câmera, sem citar etnia)', () => {
    const downturned = montarPrompts({ eyes: { shape: 'Downturned' } }, BASE_TESTE);
    expect(downturned.positive).toContain('downturned outer eye corners, gaze forward at the viewer');
    expect(downturned.positive).not.toMatch(/asian|african|caucasian|latino|nordic|pacific|mixed/i);

    const upturned = montarPrompts({ eyes: { shape: 'Upturned' } }, BASE_TESTE);
    expect(upturned.positive).toContain('upturned outer eye corners, gaze forward at the viewer');
  });

  test('eyes.shape Downturned/Upturned geram exclusão COM peso no negativo (contra a IA confundir com olhar pra baixo/cima)', () => {
    const downturned = montarPrompts({ eyes: { shape: 'Downturned' } }, BASE_TESTE);
    expect(downturned.negative).toBe('NEGATIVO_BASE, (looking down, downcast gaze, head tilted down:1.2)');

    const upturned = montarPrompts({ eyes: { shape: 'Upturned' } }, BASE_TESTE);
    expect(upturned.negative).toBe('NEGATIVO_BASE, (looking up, gaze rolled upward, head tilted back:1.2)');
  });

  test('eyes.shape Hooded vira frase sem a palavra "hood" no positivo e gera exclusão COM peso no negativo (contra a IA confundir com a peça de roupa capuz)', () => {
    const { positive, negative } = montarPrompts({ eyes: { shape: 'Hooded' } }, BASE_TESTE);
    expect(positive).toContain('droopy eyelids, low eyelid crease');
    expect(positive).not.toMatch(/hood/i);
    expect(negative).toBe('NEGATIVO_BASE, (hood, hoodie:1.2)');
  });

  test('os demais formatos de olho não geram nada no negativo (só Upturned/Downturned/Hooded são ambíguos)', () => {
    const formas = ['Round', 'Almond', 'Monolid', 'Oval', 'Closed'] as const;
    for (const shape of formas) {
      const { negative } = montarPrompts({ eyes: { shape } }, BASE_TESTE);
      expect(negative).toBe('NEGATIVO_BASE');
    }
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
