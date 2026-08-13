import { describe, expect, test } from 'bun:test';
import { resolverSeed, seedDeterministica, sortearSeed } from './seed';

describe('seedDeterministica', () => {
  test('é estável pra mesma espécie+gênero+variante', () => {
    expect(seedDeterministica('ssm_default', 'male', '001')).toBe(seedDeterministica('ssm_default', 'male', '001'));
  });

  test('muda se qualquer parte da chave mudar', () => {
    const base = seedDeterministica('ssm_default', 'male', '001');
    expect(seedDeterministica('ssm_default', 'male', '002')).not.toBe(base);
    expect(seedDeterministica('ssm_default', 'female', '001')).not.toBe(base);
    expect(seedDeterministica('ssm_astral', 'male', '001')).not.toBe(base);
  });

  test('sempre produz um uint32 (nunca negativo, nunca acima de 2^32-1)', () => {
    const seed = seedDeterministica('ssm_default', 'male', '001');
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffffffff);
  });
});

describe('resolverSeed', () => {
  test('sem --seed e sem seed customizada: cai no piso determinístico', () => {
    expect(resolverSeed(undefined, undefined, 42)).toEqual({ seed: 42, origem: 'deterministica' });
  });

  test('só com seed customizada no portrait.json: usa a customizada', () => {
    expect(resolverSeed(undefined, 12345, 42)).toEqual({ seed: 12345, origem: 'config' });
  });

  test('só com --seed da CLI: usa a da CLI', () => {
    expect(resolverSeed(999, undefined, 42)).toEqual({ seed: 999, origem: 'cli' });
  });

  test('--seed da CLI e seed customizada presentes ao mesmo tempo: --seed da CLI sempre vence', () => {
    expect(resolverSeed(999, 12345, 42)).toEqual({ seed: 999, origem: 'cli' });
  });

  test('--seed sem valor: sorteia e marca a origem que dispara a gravação', () => {
    const { seed, origem } = resolverSeed('random', undefined, 42);
    expect(origem).toBe('aleatoria');
    expect(seed).not.toBe(42);
  });

  test('--seed sem valor vence a seed customizada (é o reroll da variante)', () => {
    const { seed, origem } = resolverSeed('random', 12345, 42);
    expect(origem).toBe('aleatoria');
    expect(seed).not.toBe(12345);
  });
});

describe('sortearSeed', () => {
  test('sempre produz um uint32, a mesma faixa da determinística', () => {
    for (let i = 0; i < 1000; i++) {
      const seed = sortearSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThanOrEqual(0xffffffff);
    }
  });

  test('não repete o mesmo número a cada chamada', () => {
    const sorteios = new Set(Array.from({ length: 100 }, () => sortearSeed()));
    expect(sorteios.size).toBeGreaterThan(90);
  });
});
