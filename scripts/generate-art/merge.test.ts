import { describe, expect, test } from 'bun:test';
import { mesclarCampos } from './merge';

describe('mesclarCampos', () => {
  test('seções (person/hair/eyes/torso): último nível declarado vence, mesclado campo a campo', () => {
    const resultado = mesclarCampos(
      { person: { ethnicity: 'African', body_shape: 'Slim' } },
      { person: { body_shape: 'Muscular' } }, // não redeclara ethnicity
      { person: { age: 25 } }
    );
    expect(resultado.person).toEqual({ ethnicity: 'African', body_shape: 'Muscular', age: 25 });
  });

  test('template segue a regra normal: o nível mais específico que declarar vence', () => {
    const resultado = mesclarCampos(
      { torso: { template: 'template da base', state: 'FullyCovered' } },
      { torso: { template: 'template do gênero' } }
    );
    expect(resultado.torso).toEqual({ template: 'template do gênero', state: 'FullyCovered' });
  });

  test('extra concatena base→gênero→variante, em vez do último vencer', () => {
    const resultado = mesclarCampos(
      { hair: { extra: 'wet hair' } },
      { hair: { extra: 'damp strands' } },
      { hair: { extra: 'seaweed woven in' } }
    );
    expect(resultado.hair?.extra).toBe('wet hair, damp strands, seaweed woven in');
  });

  test('extra concatena por seção, sem misturar seções diferentes', () => {
    const resultado = mesclarCampos(
      { hair: { extra: 'cabelo base' }, torso: { extra: 'torso base' } },
      { hair: { extra: 'cabelo variante' } }
    );
    expect(resultado.hair?.extra).toBe('cabelo base, cabelo variante');
    expect(resultado.torso?.extra).toBe('torso base');
  });

  test('nível sem extra não introduz string vazia na concatenação', () => {
    const resultado = mesclarCampos(
      { person: { extra: 'só a base tem extra' } },
      { person: { age: 30 } },
      { person: { body_shape: 'Slim' } }
    );
    expect(resultado.person).toEqual({ extra: 'só a base tem extra', age: 30, body_shape: 'Slim' });
  });

  test('seção declarada em nenhum nível não gera a chave (evita objeto {} espúrio)', () => {
    const resultado = mesclarCampos({ person: { age: 20 } }, {});
    expect(resultado.hair).toBeUndefined();
    expect(resultado.torso).toBeUndefined();
    expect(Object.keys(resultado)).toEqual(['person']);
  });

  test('species vem da base e atravessa o merge intacta (só a base pode declará-la)', () => {
    const resultado = mesclarCampos(
      { species: { archetype: 'Mermaid', template: 'aquatic humanoid' } },
      { person: { gender: 'Male' } },
      { hair: { primary_color: 'Blonde' } }
    );
    expect(resultado.species).toEqual({ archetype: 'Mermaid', template: 'aquatic humanoid' });
  });

  test('caso ssm_mermaids: template na base, cores na variante — o merge junta os dois níveis', () => {
    const resultado = mesclarCampos(
      { torso: { state: 'CroppedSleeved', template: 'fish-scale top in <torso.primary_color>' } },
      { person: { gender: 'Male' } },
      { torso: { primary_color: 'Salmon', secondary_color: 'Turquoise' } }
    );
    expect(resultado.torso).toEqual({
      state: 'CroppedSleeved',
      template: 'fish-scale top in <torso.primary_color>',
      primary_color: 'Salmon',
      secondary_color: 'Turquoise',
    });
  });

  test('regressão: reforço numa variante não apaga o extra da base (concatenação, não substituição)', () => {
    const resultado = mesclarCampos(
      { hair: { extra: 'no hood, no head covering, full head of hair' } },
      {},
      { hair: { extra: 'wind-blown strands' } }
    );
    expect(resultado.hair?.extra).toBe('no hood, no head covering, full head of hair, wind-blown strands');
  });
});
