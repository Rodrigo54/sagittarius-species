import { describe, expect, test } from 'bun:test';
import {
  caminhosDoTemplate,
  ErroCampoObrigatorio,
  ErroTemplate,
  interpolar,
  type CamposParaInterpolacao,
  type VocabularioTextos,
} from './interpolacao';

/** Vocabulário de teste — não usa o `base.json` real pra o teste não quebrar
 * toda vez que o texto de produto for ajustado; só o comportamento do motor
 * importa aqui. */
const VOCABULARIO: VocabularioTextos = {
  'person.gender': {
    Male: { positive: 'man', negative: '(androgynous, feminine:1.2)' },
    Female: { positive: 'woman', negative: '(androgynous, masculine:1.2)' },
  },
  'person.ethnicity': {
    African: { positive: '(African, dark skin:1.3)' },
  },
};

const ROTULO = 'especie/male/001 (teste)';

function render(template: string, campos: CamposParaInterpolacao): string | undefined {
  return interpolar(template, campos, VOCABULARIO, ROTULO);
}

describe('interpolar — resolução de valores', () => {
  test('valor sem entrada de vocabulário sai cru, em minúsculas', () => {
    expect(render('<hair.primary_color> hair', { hair: { primary_color: 'Salmon' } })).toBe('salmon hair');
  });

  test('valor com entrada de vocabulário sai pelo texto da entrada, não pelo valor cru', () => {
    expect(render('<person.gender>', { person: { gender: 'Male' } })).toBe('man');
    expect(render('<person.ethnicity>', { person: { ethnicity: 'African' } })).toBe('(African, dark skin:1.3)');
  });

  test('número vira texto (idade não perde o valor virando "[object Object]" nem NaN)', () => {
    expect(render('<person.age>-year-old', { person: { age: 21 } })).toBe('21-year-old');
  });

  test('valor com espaço interno é preservado (vocabulário de cor tem "Sky Blue")', () => {
    expect(render('<hair.primary_color> hair', { hair: { primary_color: 'Sky Blue' } })).toBe('sky blue hair');
  });

  test('template sem placeholder nenhum é texto literal (caso ssm_astral: descrição fixa da espécie)', () => {
    const texto = 'dark purple-violet ornate armor with bronze and gold trim';
    expect(render(texto, {})).toBe(texto);
  });
});

describe('interpolar — segmentos opcionais', () => {
  test('segmento opcional some inteiro quando o campo não resolve (sem preposição órfã)', () => {
    const template = '[<hair.primary_color> ][<hair.style> ]hair[ with <hair.secondary_color> highlights]';
    expect(render(template, { hair: { primary_color: 'Blonde', style: 'Long Curly' } })).toBe('blonde long curly hair');
  });

  test('segmento opcional é emitido quando o campo resolve', () => {
    const template = '[<hair.primary_color> ]hair[ with <hair.secondary_color> highlights]';
    expect(render(template, { hair: { primary_color: 'Blonde', secondary_color: 'Teal' } })).toBe(
      'blonde hair with teal highlights'
    );
  });

  test('opcional aninhado se descarta sozinho, sem derrubar o segmento pai', () => {
    const template = 'scale armor[ in <torso.primary_color>[ and <torso.secondary_color>]]';
    expect(render(template, { torso: { primary_color: 'Salmon' } })).toBe('scale armor in salmon');
    expect(render(template, { torso: { primary_color: 'Salmon', secondary_color: 'Turquoise' } })).toBe(
      'scale armor in salmon and turquoise'
    );
  });

  test('pai descartado leva o aninhado junto', () => {
    const template = 'armor[ in <torso.primary_color>[ and <torso.secondary_color>]]';
    expect(render(template, { torso: { secondary_color: 'Turquoise' } })).toBe('armor');
  });

  test('template que resolve pra nada devolve undefined (fragmento não entra no prompt)', () => {
    expect(render('[(<eyes.color> eyes:1.2)]', { eyes: { shape: 'Round' } })).toBeUndefined();
    expect(render('[(<eyes.color> eyes:1.2)]', {})).toBeUndefined();
  });

  test('seção ausente no objeto mesclado não resolve nenhum campo dela', () => {
    expect(render('[<hair.primary_color> ]hair', {})).toBe('hair');
  });

  test('vírgula que sobra na borda é removida (o segmento opcional carrega a própria pontuação)', () => {
    const template = '[<person.age>-year-old ][<person.gender>, ][<person.body_shape> build]';
    expect(render(template, { person: { age: 21, gender: 'Male', body_shape: 'Athletic' } })).toBe(
      '21-year-old man, athletic build'
    );
    // sem body_shape a vírgula do segmento de gênero ficaria pendurada no fim
    expect(render(template, { person: { age: 21, gender: 'Male' } })).toBe('21-year-old man');
    expect(render(template, { person: { body_shape: 'Athletic' } })).toBe('athletic build');
    expect(render(template, { person: { age: 21 } })).toBe('21-year-old');
  });

  test('vírgula no MEIO do texto é preservada (limpeza é só de borda, não de conteúdo)', () => {
    expect(render('armor, <torso.primary_color>, trimmed', { torso: { primary_color: 'Gold' } })).toBe(
      'armor, gold, trimmed'
    );
  });
});

describe('interpolar — placeholder obrigatório', () => {
  test('campo fora de colchetes que não resolve é erro, nomeando caminho e variante', () => {
    expect(() => render('scale armor in <torso.primary_color>', { torso: { state: 'CroppedSleeved' } })).toThrow(
      ErroCampoObrigatorio
    );
    try {
      render('scale armor in <torso.primary_color>', { torso: { state: 'CroppedSleeved' } });
    } catch (erro) {
      expect(erro).toBeInstanceOf(ErroCampoObrigatorio);
      const tipado = erro as ErroCampoObrigatorio;
      expect(tipado.caminho).toBe('torso.primary_color');
      expect(tipado.rotulo).toBe(ROTULO);
      expect(tipado.message).toContain('torso.primary_color');
      expect(tipado.message).toContain(ROTULO);
    }
  });

  test('o mesmo campo dentro de colchetes não é erro — apenas some', () => {
    expect(render('scale armor[ in <torso.primary_color>]', { torso: { state: 'CroppedSleeved' } })).toBe(
      'scale armor'
    );
  });

  test('seção inteira ausente também dispara o obrigatório (o chamador é quem pula a seção)', () => {
    expect(() => render('<torso.primary_color> armor', {})).toThrow(ErroCampoObrigatorio);
  });
});

describe('analisarTemplate — sintaxe', () => {
  test('colchete sem fechar é erro de template', () => {
    expect(() => render('hair[ with <hair.secondary_color>', {})).toThrow(ErroTemplate);
  });

  test('colchete fechado sem abrir é erro de template', () => {
    expect(() => render('hair] extra', {})).toThrow(ErroTemplate);
  });

  test('placeholder sem fechar é erro de template', () => {
    expect(() => render('<hair.primary_color hair', {})).toThrow(ErroTemplate);
  });

  test('caminho fora do formato "secao.campo" é erro de template', () => {
    expect(() => render('<hairPrimaryColor>', {})).toThrow(ErroTemplate);
    expect(() => render('<hair.primary.color>', {})).toThrow(ErroTemplate);
    expect(() => render('<Hair.primary_color>', {})).toThrow(ErroTemplate);
  });

  test('parênteses e dois-pontos do peso A1111 são texto comum, não sintaxe', () => {
    expect(render('(<eyes.color> eyes:1.2)', { eyes: { color: 'Violet' } })).toBe('(violet eyes:1.2)');
  });
});

describe('caminhosDoTemplate', () => {
  test('coleta caminhos inclusive dentro de opcionais aninhados, na ordem em que aparecem', () => {
    const template = '[<hair.primary_color> ]hair[ with <hair.secondary_color>[ over <hair.style>]]';
    expect(caminhosDoTemplate(template)).toEqual(['hair.primary_color', 'hair.secondary_color', 'hair.style']);
  });

  test('template literal não cita caminho nenhum', () => {
    expect(caminhosDoTemplate('ornate armor with gold trim')).toEqual([]);
  });
});

describe('determinismo', () => {
  test('a mesma entrada produz sempre a mesma saída, byte a byte', () => {
    const template = '[<hair.primary_color> ][<hair.style> ]hair[ with <hair.secondary_color> highlights]';
    const campos = { hair: { primary_color: 'Blonde', style: 'Braided', secondary_color: 'Teal' } };
    expect(render(template, campos)).toBe(render(template, campos));
  });
});
