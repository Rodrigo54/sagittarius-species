import { describe, expect, test } from 'bun:test';
import { ErroCampoObrigatorio, type PortraitConfig } from '../portrait-schema';
import { BASE_ART } from './base';
import { ErroCoberturaDeCampo, validarEspecie } from './validacao';

/** Fixtures montadas na mão (não lidas de `assets/`) — o teste é sobre as
 * duas regras de validação, não sobre o conteúdo das espécies do produto. */
function especie(geracaoArt: PortraitConfig['geracaoArt']): PortraitConfig {
  return {
    name: 'fixture',
    species_classes: ['HUM'],
    categories: ['humanoids'],
    counts: { male: 1, female: 1 },
    geracaoArt,
  } as PortraitConfig;
}

describe('validarEspecie — cobertura', () => {
  test('cor declarada que nenhum template referencia é erro, nomeando variante e campo', async () => {
    const config = especie({
      base: {
        species: { archetype: 'Mermaid' },
        // template literal: descreve a armadura sem citar cor nenhuma
        torso: { state: 'CroppedSleeved', template: 'fish-scale armor top' },
      },
      male: {
        person: { gender: 'Male' },
        variantes: { '001': { torso: { primary_color: 'Salmon' } } },
      },
    });

    await expect(validarEspecie(config, 'mermaids', BASE_ART)).rejects.toThrow(ErroCoberturaDeCampo);
    try {
      await validarEspecie(config, 'mermaids', BASE_ART);
    } catch (erro) {
      expect((erro as ErroCoberturaDeCampo).rotulo).toBe('mermaids/male/001');
      expect((erro as ErroCoberturaDeCampo).caminhos).toEqual(['torso.primary_color']);
    }
  });

  test('a mesma cor passa quando o template da espécie a posiciona', async () => {
    const config = especie({
      base: {
        species: { archetype: 'Mermaid' },
        torso: { state: 'CroppedSleeved', template: 'fish-scale top in <torso.primary_color>' },
      },
      male: { person: { gender: 'Male' }, variantes: { '001': { torso: { primary_color: 'Salmon' } } } },
    });
    expect(await validarEspecie(config, 'mermaids', BASE_ART)).toBe(1);
  });

  test('sem template de espécie, o default do base.json cobre as cores', async () => {
    const config = especie({
      base: { species: { archetype: 'Human' }, torso: { state: 'FullyCovered' } },
      male: {
        person: { gender: 'Male' },
        variantes: { '001': { torso: { primary_color: 'Gold', secondary_color: 'Navy' } } },
      },
    });
    expect(await validarEspecie(config, 'default', BASE_ART)).toBe(1);
  });

  test('campos cobertos por vocabulário posicionado na order não precisam de template', async () => {
    const config = especie({
      base: { species: { archetype: 'Human' } },
      male: {
        person: { gender: 'Male' },
        variantes: { '001': { person: { ethnicity: 'African' }, eyes: { shape: 'Hooded' } } },
      },
    });
    expect(await validarEspecie(config, 'default', BASE_ART)).toBe(1);
  });

  test('template literal sem cor declarada continua válido (caso ssm_astral)', async () => {
    const config = especie({
      base: {
        species: { archetype: 'Human', template: '<species.archetype>, mystical order warrior' },
        torso: { state: 'FullyCovered', template: 'dark purple-violet ornate armor with bronze trim' },
      },
      male: { person: { gender: 'Male' }, variantes: { '001': { person: { age: 21 } } } },
    });
    expect(await validarEspecie(config, 'astral', BASE_ART)).toBe(1);
  });
});

describe('validarEspecie — obrigatoriedade', () => {
  test('placeholder fora de colchetes sem valor na variante é erro', async () => {
    const config = especie({
      base: {
        species: { archetype: 'Mermaid' },
        torso: { state: 'CroppedSleeved', template: 'fish-scale top in <torso.primary_color>' },
      },
      male: {
        person: { gender: 'Male' },
        variantes: { '001': {} }, // não declara a cor que o template exige
      },
    });
    await expect(validarEspecie(config, 'mermaids', BASE_ART)).rejects.toThrow(ErroCampoObrigatorio);
  });

  test('o mesmo campo dentro de colchetes é opcional e não reprova', async () => {
    const config = especie({
      base: {
        species: { archetype: 'Mermaid' },
        torso: { state: 'CroppedSleeved', template: 'fish-scale top[ in <torso.primary_color>]' },
      },
      male: { person: { gender: 'Male' }, variantes: { '001': {} } },
    });
    expect(await validarEspecie(config, 'mermaids', BASE_ART)).toBe(1);
  });
});

describe('validarEspecie — escopo', () => {
  test('confere todas as variantes de todos os gêneros, não só a primeira', async () => {
    const config = {
      name: 'fixture',
      species_classes: ['HUM'],
      categories: ['humanoids'],
      counts: { male: 2, female: 1 },
      geracaoArt: {
        base: { species: { archetype: 'Human' }, torso: { state: 'FullyCovered' } },
        male: {
          person: { gender: 'Male' },
          variantes: { '001': { person: { age: 20 } }, '002': { person: { age: 30 } } },
        },
        female: { person: { gender: 'Female' }, variantes: { '001': { person: { age: 25 } } } },
      },
    } as PortraitConfig;
    expect(await validarEspecie(config, 'fixture', BASE_ART)).toBe(3);
  });

  test('o erro aponta a variante exata, mesmo quando ela é a última do lote', async () => {
    const config = {
      name: 'fixture',
      species_classes: ['HUM'],
      categories: ['humanoids'],
      counts: { male: 3, female: 3 },
      geracaoArt: {
        base: { species: { archetype: 'Human' }, torso: { state: 'FullyCovered', template: 'plain armor' } },
        male: {
          person: { gender: 'Male' },
          variantes: { '001': {}, '002': {}, '003': { torso: { primary_color: 'Gold' } } },
        },
      },
    } as PortraitConfig;
    try {
      await validarEspecie(config, 'fixture', BASE_ART);
      throw new Error('deveria ter reprovado');
    } catch (erro) {
      expect((erro as ErroCoberturaDeCampo).rotulo).toBe('fixture/male/003');
    }
  });

  test('espécie sem geracaoArt não tem nada a validar', async () => {
    expect(await validarEspecie({ name: 'x', counts: { genderless: 1 } } as PortraitConfig, 'x', BASE_ART)).toBe(0);
  });
});
