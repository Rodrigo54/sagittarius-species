import { describe, expect, test } from 'bun:test';
import { ESTADOS_TORSO, ETNIAS, FORMAS_OLHO, GENEROS_PESSOA } from '../portrait-schema';
import { BASE_ART, zBaseArt } from './base';

/** Cópia mínima do arquivo real, usada para os casos negativos: adulterar uma
 * cópia mostra a mensagem de erro sem depender do texto de produto. */
function baseValida(): unknown {
  return JSON.parse(JSON.stringify(BASE_ART));
}

describe('base.json (arquivo real)', () => {
  test('passa no schema — é o portão que roda em bun test e em toda execução de bun run art', () => {
    expect(() => zBaseArt.parse(baseValida())).not.toThrow();
  });

  test('todo valor de enum traduzido tem texto positivo (cobertura exaustiva)', () => {
    const cobertura = {
      'torso.state': ESTADOS_TORSO,
      'eyes.shape': FORMAS_OLHO,
      'person.ethnicity': ETNIAS,
      'person.gender': GENEROS_PESSOA,
    };
    for (const [caminho, valores] of Object.entries(cobertura)) {
      for (const valor of valores) {
        expect(BASE_ART.vocabulary[caminho]?.[valor]?.positive).toBeTruthy();
      }
    }
  });

  test('as duas âncoras frágeis entram cedo: cor de olho e etnia logo após o estilo', () => {
    const { positive } = BASE_ART.order;
    expect(positive[0]).toBe('fixed.style');
    expect(positive.indexOf('eyes.template')).toBeLessThan(positive.indexOf('species.template'));
    expect(positive.indexOf('person.ethnicity')).toBeLessThan(positive.indexOf('species.template'));
  });

  test('a cor do torso é posicionada pelo template da seção, não solta antes dele', () => {
    const { positive } = BASE_ART.order;
    expect(positive.indexOf('torso.state')).toBeLessThan(positive.indexOf('torso.template'));
    expect(positive.indexOf('torso.template')).toBeLessThan(positive.indexOf('torso.extra'));
  });
});

describe('validação do base.json', () => {
  test('valor de enum sem texto é erro, nomeando a chave que falta', () => {
    const config = baseValida() as { vocabulary: Record<string, Record<string, unknown>> };
    delete config.vocabulary['torso.state']!.CroppedSleeved;
    const resultado = zBaseArt.safeParse(config);
    expect(resultado.success).toBe(false);
    expect(JSON.stringify(resultado.error?.issues)).toContain('CroppedSleeved');
  });

  test('texto órfão de um valor que não existe mais também é erro (.strict)', () => {
    const config = baseValida() as { vocabulary: Record<string, Record<string, unknown>> };
    config.vocabulary['eyes.shape']!.Reptilian = { positive: 'slit pupils' };
    expect(zBaseArt.safeParse(config).success).toBe(false);
  });

  test('template com sintaxe inválida é erro', () => {
    const config = baseValida() as { templates: Record<string, string> };
    config.templates.hair = '[<hair.primary_color> hair';
    const resultado = zBaseArt.safeParse(config);
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toContain('sem "]" correspondente');
  });

  test('template citando caminho que não existe no schema é erro, listando os válidos', () => {
    const config = baseValida() as { templates: Record<string, string> };
    // formato de caminho correto (senão o erro seria de sintaxe, não de existência)
    config.templates.hair = '<hair.primary_colour> hair';
    const resultado = zBaseArt.safeParse(config);
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toContain('caminho inexistente');
    expect(resultado.error?.issues[0]?.message).toContain('hair.primary_color');
  });

  test('caminho fora do formato "secao.campo" é pego como erro de sintaxe', () => {
    const config = baseValida() as { templates: Record<string, string> };
    config.templates.hair = '<hairPrimaryColor> hair';
    const resultado = zBaseArt.safeParse(config);
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.message).toContain('não está no formato');
  });

  test('entrada de order que não aponta pra texto nenhum é erro', () => {
    const config = baseValida() as { order: { positive: string[] } };
    config.order.positive.push('torso.descricao');
    const resultado = zBaseArt.safeParse(config);
    expect(resultado.success).toBe(false);
    expect(JSON.stringify(resultado.error?.issues)).toContain('torso.descricao');
  });

  test('texto declarado que ficou de fora da order é erro (nunca entraria no prompt)', () => {
    const config = baseValida() as { order: { positive: string[] } };
    config.order.positive = config.order.positive.filter((entrada) => entrada !== 'hair.template');
    const resultado = zBaseArt.safeParse(config);
    expect(resultado.success).toBe(false);
    expect(JSON.stringify(resultado.error?.issues)).toContain('hair.template');
  });
});
