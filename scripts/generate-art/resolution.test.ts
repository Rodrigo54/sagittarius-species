import { describe, expect, test } from 'bun:test';
import { resolverAspectRatio } from './resolution';

describe('resolverAspectRatio', () => {
  test('"1:1" devolve o quadrado 1024x1024 exato (já é múltiplo de 16)', () => {
    expect(resolverAspectRatio('1:1')).toEqual({ width: 1024, height: 1024 });
  });

  test('"2:3" (retrato) devolve largura menor que altura, ambas múltiplas de 16', () => {
    const { width, height } = resolverAspectRatio('2:3');
    expect(width).toBe(832);
    expect(height).toBe(1248);
    expect(width % 16).toBe(0);
    expect(height % 16).toBe(0);
  });

  test('"4:5" (retrato) devolve largura menor que altura, ambas múltiplas de 16', () => {
    const { width, height } = resolverAspectRatio('4:5');
    expect(width).toBe(912);
    expect(height).toBe(1152);
  });

  test('"3:2" (paisagem) é o espelho de "2:3" — largura maior que altura', () => {
    const retrato = resolverAspectRatio('2:3');
    const paisagem = resolverAspectRatio('3:2');
    expect(paisagem.width).toBe(retrato.height);
    expect(paisagem.height).toBe(retrato.width);
  });

  test('a contagem de megapixels fica próxima de 1024x1024 (~1.05MP) pra qualquer proporção', () => {
    for (const aspectRatio of ['1:1', '2:3', '4:5', '3:2', '16:9', '9:16']) {
      const { width, height } = resolverAspectRatio(aspectRatio);
      const megapixels = (width * height) / 1_000_000;
      expect(megapixels).toBeGreaterThan(0.9);
      expect(megapixels).toBeLessThan(1.25);
    }
  });

  test('formato inválido lança erro descritivo', () => {
    expect(() => resolverAspectRatio('quadrado')).toThrow(/não bate com o formato/);
    expect(() => resolverAspectRatio('2:3:4')).toThrow();
    expect(() => resolverAspectRatio('0:1')).toThrow(/positivas/);
    expect(() => resolverAspectRatio('1:0')).toThrow(/positivas/);
  });
});
