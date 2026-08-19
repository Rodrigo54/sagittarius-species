import { describe, expect, test } from 'bun:test';
import { gerarConteudoTxt } from './txt-writer';
import type { SpeciesInfo } from './types';

function infoBase(rig?: SpeciesInfo['config']['rig']): SpeciesInfo {
  return {
    slug: 'ssm_teste',
    pastaAssets: '',
    config: {
      name: 'teste',
      rig,
      species_classes: ['HUM'],
      categories: ['humanoids'],
      counts: { genderless: 1 },
    },
    arquivos: { genderless: ['assets/portraits/ssm_teste/genderless/001.png'] },
  };
}

describe('gerarConteudoTxt — seleção de entity por rig', () => {
  test('rig ausente usa a entity legada (sl_humanoid_01_entity)', () => {
    const txt = gerarConteudoTxt('ssm_teste', infoBase(undefined));
    expect(txt).toContain('entity = "sl_humanoid_01_entity"');
    expect(txt).not.toContain('ssm_humanoid_01_entity');
  });

  test('rig "sl_shared" explícito usa a mesma entity legada', () => {
    const txt = gerarConteudoTxt('ssm_teste', infoBase('sl_shared'));
    expect(txt).toContain('entity = "sl_humanoid_01_entity"');
  });

  test('rig "ssm_shared" usa a entity nova, com UV corrigida', () => {
    const txt = gerarConteudoTxt('ssm_teste', infoBase('ssm_shared'));
    expect(txt).toContain('entity = "ssm_humanoid_01_entity"');
    expect(txt).not.toContain('sl_humanoid_01_entity');
  });
});
