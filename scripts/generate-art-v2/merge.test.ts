import { describe, expect, test } from 'bun:test';
import { mesclarCampos } from './merge';

/** Duplicado de `scripts/generate-art/merge.test.ts` — ver o comentário no
 * topo de `merge.ts` sobre por que este arquivo é duplicado em vez de
 * importado do v1. */

describe('mesclarCampos', () => {
  test('seções simples (person/hair/eyes/torso/tipo): último nível declarado vence, mesclado campo a campo', () => {
    const resultado = mesclarCampos(
      { person: { ethnicity: 'African', body_shape: 'Slim' } },
      { person: { body_shape: 'Muscular' } }, // não redeclara ethnicity
      { person: { age: 25 } }
    );
    expect(resultado.person).toEqual({ ethnicity: 'African', body_shape: 'Muscular', age: 25 });
  });

  test('extra_prompt.positive concatena base→gênero→variante, em vez do último vencer', () => {
    const resultado = mesclarCampos(
      { extra_prompt: { positive: 'estilo base' } },
      { extra_prompt: { positive: 'reforço de gênero' } },
      { extra_prompt: { positive: 'reforço da variante' } }
    );
    expect(resultado.extra_prompt?.positive).toBe('estilo base, reforço de gênero, reforço da variante');
  });

  test('extra_prompt.negative concatena independente do positive (os dois lados concatenam, mas não se misturam)', () => {
    const resultado = mesclarCampos(
      { extra_prompt: { positive: 'pos base', negative: 'neg base' } },
      { extra_prompt: { positive: 'pos variante', negative: 'neg variante' } }
    );
    expect(resultado.extra_prompt).toEqual({
      positive: 'pos base, pos variante',
      negative: 'neg base, neg variante',
    });
  });

  test('nível sem extra_prompt.negative não introduz string vazia na concatenação', () => {
    const resultado = mesclarCampos(
      { extra_prompt: { positive: 'a' } },
      { extra_prompt: { positive: 'b', negative: 'só a variante tem negativo' } }
    );
    expect(resultado.extra_prompt).toEqual({
      positive: 'a, b',
      negative: 'só a variante tem negativo',
    });
  });

  test('nenhum nível com extra_prompt não gera a chave (evita objeto {} espúrio)', () => {
    const resultado = mesclarCampos({ person: { age: 20 } }, {});
    expect(resultado.extra_prompt).toBeUndefined();
  });

  test('tipo não mescla campo a campo — o nível mais específico que declarar vence por inteiro', () => {
    const resultado = mesclarCampos(
      { tipo: { value: 'Human', description: 'descrição da base' } },
      { tipo: { value: 'Robot' } } // sem description — não deve herdar a description da base
    );
    expect(resultado.tipo).toEqual({ value: 'Robot' });
  });

  test('regressão do bug documentado no histórico: reforço de etnia numa variante não apaga o extra da base (concatenação, não substituição)', () => {
    const resultado = mesclarCampos(
      { extra_prompt: { positive: '3D render, no helmet, sci-fi space suit' } },
      {},
      { extra_prompt: { positive: 'dark skin, deep brown skin tone, African facial features' } }
    );
    expect(resultado.extra_prompt?.positive).toBe(
      '3D render, no helmet, sci-fi space suit, dark skin, deep brown skin tone, African facial features'
    );
  });
});
