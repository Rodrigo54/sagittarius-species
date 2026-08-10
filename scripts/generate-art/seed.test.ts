import { describe, expect, test } from 'bun:test';
import { resolverSeed, seedDeterministica } from './seed';

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
});
