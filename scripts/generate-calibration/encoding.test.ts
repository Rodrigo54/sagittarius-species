import { describe, expect, test } from 'bun:test';
import { CANTOS, MARCADOR, MAX_INDICE, codificar, decodificar } from './encoding';

const media = (...cores: { r: number; g: number; b: number }[]) => ({
  r: cores.reduce((s, c) => s + c.r, 0) / cores.length,
  g: cores.reduce((s, c) => s + c.g, 0) / cores.length,
  b: cores.reduce((s, c) => s + c.b, 0) / cores.length,
});

describe('codificação de coordenada em cor', () => {
  test('ida e volta em todos os índices', () => {
    for (let i = 0; i < MAX_INDICE; i++) {
      expect(decodificar(codificar(i))).toBe(i);
    }
  });

  test('índice fora do domínio é erro, não silêncio', () => {
    expect(() => codificar(-1)).toThrow();
    expect(() => codificar(MAX_INDICE)).toThrow();
    expect(() => codificar(1.5)).toThrow();
  });

  test('sobrevive ao ruído de quantização do BC3', () => {
    // BC3 guarda as cores base do bloco em RGB565: erro de ~4 em R/B, ~2 em G.
    // A margem real é 12, três vezes o pior caso esperado.
    for (let i = 0; i < MAX_INDICE; i++) {
      for (const ruido of [-12, -8, -4, 4, 8, 12]) {
        const c = codificar(i);
        expect(
          decodificar({
            r: Math.min(255, Math.max(0, c.r + ruido)),
            g: Math.min(255, Math.max(0, c.g + ruido)),
            b: Math.min(255, Math.max(0, c.b + ruido)),
          })
        ).toBe(i);
      }
    }
  });

  test('degrada para "não sei" em vez de para um número errado', () => {
    // Além da tolerância, a leitura precisa falhar — nunca devolver um índice
    // vizinho como se fosse certo.
    for (let i = 0; i < MAX_INDICE; i++) {
      const c = codificar(i);
      const lido = decodificar({ r: c.r + 16, g: c.g + 16, b: c.b + 16 });
      expect(lido === null || lido === i).toBe(true);
    }
  });

  test('mistura de duas faixas vizinhas é rejeitada', () => {
    // É a assinatura da redução de escala: cai a meio caminho entre níveis.
    for (let i = 0; i + 1 < MAX_INDICE; i++) {
      expect(decodificar(media(codificar(i), codificar(i + 1)))).toBeNull();
    }
  });

  test('mistura de três faixas decodifica exatamente para a faixa do meio', () => {
    // Este caso não tem defesa local — a média de três níveis consecutivos é
    // sempre um nível válido, indistinguível de leitura boa. O que o código de
    // Gray garante é que o valor resultante seja o **certo**. Com base 8
    // direta, 30 dos 120 casos erravam, um deles por 19 faixas.
    for (let i = 0; i + 2 < 122; i++) {
      expect(decodificar(media(codificar(i), codificar(i + 1), codificar(i + 2)))).toBe(i + 1);
    }
  });

  test('índices vizinhos diferem em exatamente um nível, num único canal', () => {
    // É a propriedade que faz a média de vizinhos cair sobre o valor correto.
    // A forma não canônica do Gray (paridade sobre os dígitos originais em vez
    // dos convertidos) quebra isto em 7 pares, com saltos de até 8 níveis.
    for (let i = 0; i + 1 < MAX_INDICE; i++) {
      const a = codificar(i);
      const b = codificar(i + 1);
      const canaisDiferentes = [a.r !== b.r, a.g !== b.g, a.b !== b.b].filter(Boolean).length;
      const distancia = Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);

      expect(canaisDiferentes).toBe(1);
      expect(distancia).toBe(32);
    }
  });

  test('a codificação é bijetiva', () => {
    const vistas = new Set<string>();
    for (let i = 0; i < MAX_INDICE; i++) {
      const c = codificar(i);
      vistas.add(`${c.r},${c.g},${c.b}`);
    }
    expect(vistas.size).toBe(MAX_INDICE);
  });

  test('cores reservadas nunca são lidas como código', () => {
    for (const canto of Object.values(CANTOS)) {
      expect(decodificar(canto)).toBeNull();
    }
    expect(decodificar(MARCADOR)).toBeNull();
  });
});
