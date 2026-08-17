import { describe, expect, test } from 'bun:test';
import { zNameList } from './schema';

/** Cultura mínima válida — os testes partem daqui e estragam um pedaço de cada
 * vez, pra que a mensagem de erro afirmada seja sobre aquele pedaço só. */
function cultura(corpo: Record<string, unknown> = {}, extras: Record<string, unknown> = {}) {
  return {
    name: 'Sagittarius - Teste',
    desc: '§YShips:§! Exemplo',
    ssm_teste: { category: 'Humanoid', ...corpo },
    ...extras,
  };
}

describe('estrutura do arquivo', () => {
  test('cultura mínima passa', () => {
    expect(zNameList.safeParse(cultura()).success).toBe(true);
  });

  test('o corpo aceita script Clausewitz aninhado à vontade', () => {
    const resultado = zNameList.safeParse(
      cultura({
        ship_names: { generic: ['Aurora', 'Boreal'], corvette: { sequential_name: 'l10n|SSM_%O%' } },
        character_names: { main: { first_names_male: ['Andre'], second_names: [] } },
      })
    );
    expect(resultado.success).toBe(true);
  });

  test('seção escrita errado é erro — hoje isso vira bloco lixo no .txt', () => {
    const resultado = zNameList.safeParse(cultura({ army_name: { generic: ['X'] } }));
    expect(resultado.success).toBe(false);
    expect(JSON.stringify(resultado.error?.issues)).toContain('army_name');
  });

  test('corpo sem category é erro', () => {
    const resultado = zNameList.safeParse({ name: 'x', desc: 'y', ssm_teste: { ship_names: {} } });
    expect(resultado.success).toBe(false);
  });

  test('arquivo sem a chave ssm_<cultura> é erro', () => {
    const resultado = zNameList.safeParse({ name: 'x', desc: 'y' });
    expect(resultado.success).toBe(false);
    expect(JSON.stringify(resultado.error?.issues)).toContain('falta a chave');
  });

  test('duas chaves de corpo é erro — o .txt gerado carrega um wrapper só', () => {
    const resultado = zNameList.safeParse({
      name: 'x',
      desc: 'y',
      ssm_um: { category: 'Humanoid' },
      ssm_dois: { category: 'Humanoid' },
    });
    expect(resultado.success).toBe(false);
    expect(JSON.stringify(resultado.error?.issues)).toContain('encontrou 2');
  });

  test('chave de corpo sem o prefixo do mod é erro', () => {
    const resultado = zNameList.safeParse({ name: 'x', desc: 'y', altmer: { category: 'Humanoid' } });
    expect(resultado.success).toBe(false);
    expect(JSON.stringify(resultado.error?.issues)).toContain('ssm_<cultura>');
  });

  test('_meta é livre: é registro de autoria, não entra no .txt', () => {
    const resultado = zNameList.safeParse(
      cultura({}, { _meta: { ship_names: { corvette: { theme: 'divas pop', target_count: 20 } } } })
    );
    expect(resultado.success).toBe(true);
  });
});

describe('species_names', () => {
  test('entrada completa passa', () => {
    const resultado = zNameList.safeParse(
      cultura({}, {
        species_names: [
          { key: 'Nirn', name: 'Altmer', plural: 'Altmers', home_planet: 'Nirn', species_class: 'HUM' },
        ],
      })
    );
    expect(resultado.success).toBe(true);
  });

  test('entrada sem plural é erro', () => {
    const resultado = zNameList.safeParse(
      cultura({}, { species_names: [{ key: 'Nirn', name: 'Altmer', species_class: 'HUM' }] })
    );
    expect(resultado.success).toBe(false);
    expect(JSON.stringify(resultado.error?.issues)).toContain('plural');
  });

  test('campo desconhecido na entrada é erro, não descartado em silêncio', () => {
    const resultado = zNameList.safeParse(
      cultura({}, {
        species_names: [
          { key: 'Nirn', name: 'Altmer', plural: 'Altmers', species_class: 'HUM', homeworld: 'Nirn' },
        ],
      })
    );
    expect(resultado.success).toBe(false);
    expect(JSON.stringify(resultado.error?.issues)).toContain('homeworld');
  });
});

describe('species_class', () => {
  test('classe fora do vocabulário do jogo é erro', () => {
    const resultado = zNameList.safeParse(
      cultura({}, {
        species_names: [{ key: 'X', name: 'X', plural: 'Xs', species_class: 'HUMANOID' }],
      })
    );
    expect(resultado.success).toBe(false);
  });

  test('classe de ship set (PSIONIC/CYBERNETIC) é recusada — não sorteia império de IA', () => {
    for (const classe of ['PSIONIC', 'CYBERNETIC']) {
      const resultado = zNameList.safeParse(
        cultura({}, { species_names: [{ key: 'X', name: 'X', plural: 'Xs', species_class: classe }] })
      );
      expect(resultado.success).toBe(false);
    }
  });

  test('entrada sem species_class é erro — o jogo exige a classe como chave de agrupamento', () => {
    const resultado = zNameList.safeParse(
      cultura({}, { species_names: [{ key: 'X', name: 'X', plural: 'Xs' }] })
    );
    expect(resultado.success).toBe(false);
    expect(JSON.stringify(resultado.error?.issues)).toContain('species_class');
  });
});
