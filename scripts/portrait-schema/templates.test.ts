import { describe, expect, test } from 'bun:test';
import { CAMPOS_POR_SECAO } from './campos';
import { zPortraitConfig } from './schema';
import { CAMINHOS_INTERPOLAVEIS, validarSintaxeDeTemplate } from './templates';

describe('CAMINHOS_INTERPOLAVEIS', () => {
  test('é derivado do schema — todo campo de dado de toda seção está lá, e nada além', () => {
    const esperado = new Set(
      Object.entries(CAMPOS_POR_SECAO).flatMap(([secao, campos]) =>
        Object.keys(campos).map((campo) => `${secao}.${campo}`)
      )
    );
    expect(new Set(CAMINHOS_INTERPOLAVEIS)).toEqual(esperado);
  });

  test('template e extra não são interpoláveis (um template não referencia outro)', () => {
    for (const secao of Object.keys(CAMPOS_POR_SECAO)) {
      expect(CAMINHOS_INTERPOLAVEIS.has(`${secao}.template`)).toBe(false);
      expect(CAMINHOS_INTERPOLAVEIS.has(`${secao}.extra`)).toBe(false);
    }
  });
});

describe('validarSintaxeDeTemplate', () => {
  test('template válido não devolve erro', () => {
    expect(validarSintaxeDeTemplate('fish-scale top in <torso.primary_color>[ and <torso.secondary_color>]')).toBeUndefined();
    expect(validarSintaxeDeTemplate('texto literal, sem placeholder nenhum')).toBeUndefined();
  });

  test('caminho inexistente devolve erro listando os válidos', () => {
    const erro = validarSintaxeDeTemplate('<torso.primary_colour> armor');
    expect(erro).toContain('caminho inexistente');
    expect(erro).toContain('torso.primary_color');
  });

  test('colchete sem par devolve erro', () => {
    expect(validarSintaxeDeTemplate('[<hair.primary_color> hair')).toContain('sem "]"');
  });
});

describe('integração com o schema do portrait.json', () => {
  function config(template: string) {
    return {
      name: 'fixture',
      species_classes: ['HUM'],
      categories: ['humanoids'],
      counts: { male: 1, female: 1 },
      geracaoArt: {
        base: { species: { archetype: 'Mermaid' }, torso: { template } },
        male: { variantes: { '001': {} } },
      },
    };
  }

  test('template inválido reprova já na leitura do portrait.json', () => {
    const resultado = zPortraitConfig.safeParse(config('<torso.cor_principal> armor'));
    expect(resultado.success).toBe(false);
    expect(JSON.stringify(resultado.error?.issues)).toContain('caminho inexistente');
  });

  test('template válido passa', () => {
    expect(zPortraitConfig.safeParse(config('armor in <torso.primary_color>')).success).toBe(true);
  });

  test('species declarada fora de base é recusada (.strict) — é seção da espécie, não do indivíduo', () => {
    const resultado = zPortraitConfig.safeParse({
      name: 'fixture',
      counts: { male: 1, female: 1 },
      geracaoArt: {
        base: { species: { archetype: 'Mermaid' } },
        male: { species: { archetype: 'Elf' }, variantes: { '001': {} } },
      },
    });
    expect(resultado.success).toBe(false);
  });

  test('extra_prompt não existe mais — um portrait.json antigo falha alto, não em silêncio', () => {
    const resultado = zPortraitConfig.safeParse({
      name: 'fixture',
      counts: { male: 1, female: 1 },
      geracaoArt: {
        base: { species: { archetype: 'Mermaid' }, extra_prompt: { positive: 'texto antigo' } },
        male: { variantes: { '001': {} } },
      },
    });
    expect(resultado.success).toBe(false);
  });
});
