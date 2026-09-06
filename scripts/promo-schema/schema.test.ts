import { describe, expect, test } from 'bun:test';
import { zSpeciesPromoFile } from './schema';

/** Entrada mínima válida — os testes partem daqui e estragam um pedaço de
 * cada vez, pra que a mensagem de erro afirmada seja sobre aquele pedaço só.
 * `variantes` é obrigatório (sem seleção automática), então a entrada mínima
 * já precisa vir com as 3. */
function arquivo(entrada: Record<string, unknown> = {}) {
  return {
    ssm_teste: {
      titulo: 'Espécie Teste',
      subtitulo: 'Um subtítulo qualquer.',
      lore: 'Um parágrafo qualquer.',
      variantes: ['male/001', 'female/002', 'male/003'],
      ...entrada,
    },
  };
}

describe('estrutura do arquivo', () => {
  test('entrada mínima (titulo + subtitulo + lore + variantes) passa', () => {
    expect(zSpeciesPromoFile.safeParse(arquivo()).success).toBe(true);
  });

  test('várias espécies no mesmo arquivo passa', () => {
    const resultado = zSpeciesPromoFile.safeParse({
      ssm_um: {
        titulo: 'Um',
        subtitulo: 'Sub um.',
        lore: 'Lore um.',
        variantes: ['male/001', 'female/002', 'male/003'],
      },
      ssm_dois: {
        titulo: 'Dois',
        subtitulo: 'Sub dois.',
        lore: 'Lore dois.',
        variantes: ['male/001', 'female/002', 'male/003'],
      },
    });
    expect(resultado.success).toBe(true);
  });

  test('chave sem o prefixo ssm_ é erro', () => {
    const resultado = zSpeciesPromoFile.safeParse({
      elves: {
        titulo: 'Elves',
        subtitulo: 'x',
        lore: 'x',
        variantes: ['male/001', 'female/002', 'male/003'],
      },
    });
    expect(resultado.success).toBe(false);
  });

  test('sem lore é erro', () => {
    const resultado = zSpeciesPromoFile.safeParse({
      ssm_teste: { titulo: 'x', subtitulo: 'x', variantes: ['male/001', 'female/002', 'male/003'] },
    });
    expect(resultado.success).toBe(false);
  });

  test('sem subtitulo é erro', () => {
    const resultado = zSpeciesPromoFile.safeParse({
      ssm_teste: { titulo: 'x', lore: 'x', variantes: ['male/001', 'female/002', 'male/003'] },
    });
    expect(resultado.success).toBe(false);
  });

  test('campo desconhecido é erro, não descartado em silêncio', () => {
    const resultado = zSpeciesPromoFile.safeParse(arquivo({ slug: 'ssm_teste' }));
    expect(resultado.success).toBe(false);
    expect(JSON.stringify(resultado.error?.issues)).toContain('slug');
  });
});

describe('variantes (obrigatório, sem seleção automática)', () => {
  test('sem variantes é erro — não há mais seleção automática', () => {
    const resultado = zSpeciesPromoFile.safeParse({
      ssm_teste: { titulo: 'x', subtitulo: 'x', lore: 'x' },
    });
    expect(resultado.success).toBe(false);
  });

  test('3 variantes bem formadas passa', () => {
    const resultado = zSpeciesPromoFile.safeParse(
      arquivo({ variantes: ['male/001', 'female/002', 'male/003'] })
    );
    expect(resultado.success).toBe(true);
  });

  test('menos de 3 variantes é erro — a quantidade é fixa', () => {
    const resultado = zSpeciesPromoFile.safeParse(arquivo({ variantes: ['male/001', 'female/002'] }));
    expect(resultado.success).toBe(false);
  });

  test('mais de 3 variantes é erro — a quantidade é fixa', () => {
    const resultado = zSpeciesPromoFile.safeParse(
      arquivo({ variantes: ['male/001', 'female/002', 'male/003', 'female/004'] })
    );
    expect(resultado.success).toBe(false);
  });

  test('gênero inválido na variante é erro', () => {
    const resultado = zSpeciesPromoFile.safeParse(
      arquivo({ variantes: ['other/001', 'female/002', 'male/003'] })
    );
    expect(resultado.success).toBe(false);
  });

  test('índice sem zero-padding é erro', () => {
    const resultado = zSpeciesPromoFile.safeParse(
      arquivo({ variantes: ['male/1', 'female/002', 'male/003'] })
    );
    expect(resultado.success).toBe(false);
  });
});

describe('override de fundo', () => {
  test('código de 3 dígitos passa', () => {
    expect(zSpeciesPromoFile.safeParse(arquivo({ fundo: '037' })).success).toBe(true);
  });

  test('sem zero-padding é erro', () => {
    expect(zSpeciesPromoFile.safeParse(arquivo({ fundo: '37' })).success).toBe(false);
  });
});
