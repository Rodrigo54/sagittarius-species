import { describe, expect, test } from 'bun:test';
import { coletarContextos, montarArvore } from './gui-layout';

/** Monta a árvore como o jomini a entrega (um `guiTypes` com filhos) e coleta. */
function coletar(bloco: unknown) {
  return coletarContextos(montarArvore(bloco, 'guiTypes'), 'teste.gui');
}

describe('janela visível do retrato', () => {
  test('caso de referência: empire_view.gui, container 64x76 com clipping', () => {
    // Transcrito do arquivo real (interface/empire_view.gui, "portrait"):
    //   containerWindowType = { size = { width = 64 height = 76 } clipping = yes
    //     iconType = { spriteType = "GFX_portrait_character" scale = 0.26
    //                  position = { x = -45 y = -12 } } }
    const [ctx] = coletar({
      containerWindowType: {
        name: 'portrait',
        position: { x: 12, y: 12 },
        size: { width: 64, height: 76 },
        clipping: true,
        iconType: {
          name: 'portrait',
          spriteType: 'GFX_portrait_character',
          scale: 0.26,
          position: { x: -45, y: -12 },
        },
      },
    });

    expect(ctx.ressalvas).toEqual([]);
    expect(ctx.sprite).toBe('GFX_portrait_character');
    // topo = (0 − (−12)) / 0.26 ; base = (76 − (−12)) / 0.26
    expect(ctx.janela!.y0).toBeCloseTo(46.1538, 3);
    expect(ctx.janela!.y1).toBeCloseTo(338.4615, 3);
    expect(ctx.janela!.x0).toBeCloseTo(173.0769, 3);
    expect(ctx.janela!.x1).toBeCloseTo(419.2308, 3);
  });

  test('iconType sem scale usa 1 (diplomacy_event_view.gui)', () => {
    // O caso que a varredura heurística inicial errava: sem `scale` declarado.
    const [ctx] = coletar({
      containerWindowType: {
        name: 'portrait_background',
        position: { x: 17, y: 45 },
        size: { width: 964, height: 350 },
        clipping: true,
        iconType: { name: 'portrait', position: { x: 250, y: 0 }, spriteType: 'GFX_portrait_character' },
      },
    });

    expect(ctx.scale).toBe(1);
    expect(ctx.janela).toEqual({ x0: -250, y0: 0, x1: 714, y1: 350 });
  });

  test('sem nenhum ancestral com clipping, o contexto mostra o sprite inteiro', () => {
    const [ctx] = coletar({
      containerWindowType: {
        name: 'solto',
        size: { width: 300, height: 300 },
        iconType: { spriteType: 'GFX_portrait_character', scale: 0.5, position: { x: 10, y: 10 } },
      },
    });

    // Não é falha de análise: é o caso mais generoso, e não tem ressalva.
    expect(ctx.semRecorte).toBe(true);
    expect(ctx.janela).toBeNull();
    expect(ctx.ressalvas).toEqual([]);
  });

  test('orientation ambígua acima do container que recorta não invalida o contexto', () => {
    // O deslocamento move a janela e o retrato juntos, então some na diferença.
    const [ctx] = coletar({
      containerWindowType: {
        name: 'avo_sem_size',
        containerWindowType: {
          name: 'pai_com_orientation_ambigua',
          orientation: 'LEFT',
          position: { x: 10, y: 20 },
          size: { width: 64, height: 76 },
          clipping: true,
          iconType: {
            spriteType: 'GFX_portrait_character',
            scale: 0.26,
            position: { x: -45, y: -12 },
          },
        },
      },
    });

    expect(ctx.ressalvas).toEqual([]);
    expect(ctx.janela!.y0).toBeCloseTo(46.1538, 3);
  });

  test('clipping aninhado é a interseção dos recortes', () => {
    // Externo recorta 0..100 em y; o interno começa em y=40 e tem 100 de
    // altura, então o visível é 40..100 no espaço do externo = 0..60 no dele.
    const [ctx] = coletar({
      containerWindowType: {
        name: 'externo',
        size: { width: 200, height: 100 },
        clipping: true,
        containerWindowType: {
          name: 'interno',
          position: { x: 0, y: 40 },
          size: { width: 200, height: 100 },
          clipping: true,
          iconType: { spriteType: 'GFX_portrait_character', position: { x: 0, y: 0 } },
        },
      },
    });

    expect(ctx.ressalvas).toEqual([]);
    expect(ctx.janela).toEqual({ x0: 0, y0: 0, x1: 200, y1: 60 });
  });

  test('orientation ancora no tamanho do pai', () => {
    // Pai 100x200, filho com orientation=center e position (10,20):
    // deslocamento efetivo = (50+10, 100+20) = (60,120).
    const [ctx] = coletar({
      containerWindowType: {
        name: 'pai',
        size: { width: 100, height: 200 },
        clipping: true,
        containerWindowType: {
          name: 'filho',
          orientation: 'CENTER',
          position: { x: 10, y: 20 },
          size: { width: 40, height: 40 },
          iconType: { spriteType: 'GFX_portrait_character', position: { x: 0, y: 0 } },
        },
      },
    });

    expect(ctx.ressalvas).toEqual([]);
    // clip do pai (0..100, 0..200) visto de dentro do filho, deslocado
    expect(ctx.janela).toEqual({ x0: -60, y0: -120, x1: 40, y1: 80 });
  });

  test('orientation ambígua vira ressalva, não um número chutado', () => {
    const [ctx] = coletar({
      containerWindowType: {
        name: 'pai',
        size: { width: 100, height: 200 },
        clipping: true,
        containerWindowType: {
          name: 'filho',
          orientation: 'LEFT',
          position: { x: 10, y: 20 },
          size: { width: 40, height: 40 },
          iconType: { spriteType: 'GFX_portrait_character', position: { x: 0, y: 0 } },
        },
      },
    });

    expect(ctx.ressalvas.join(' ')).toContain('ambígua');
  });

  test('clipping sem size não inventa recorte', () => {
    const [ctx] = coletar({
      containerWindowType: {
        name: 'sem_size',
        clipping: true,
        iconType: { spriteType: 'GFX_portrait_character', position: { x: 0, y: 0 } },
      },
    });

    expect(ctx.ressalvas.join(' ')).toContain('clipping sem size');
  });

  test('as variantes de câmera são distinguidas', () => {
    const ctxs = coletar({
      containerWindowType: {
        name: 'pai',
        size: { width: 100, height: 100 },
        clipping: true,
        iconType: [
          { spriteType: 'GFX_portrait_character', position: { x: 0, y: 0 } },
          { spriteType: 'GFX_portrait_character_close_up', position: { x: 0, y: 0 } },
          { quadTextureSprite: 'GFX_portrait_character_hologram', position: { x: 0, y: 0 } },
          { spriteType: 'GFX_leader_bg_admiral', position: { x: 0, y: 0 } },
        ],
      },
    });

    expect(ctxs.map((c) => c.sprite)).toEqual([
      'GFX_portrait_character',
      'GFX_portrait_character_close_up',
      'GFX_portrait_character_hologram',
    ]);
  });

  test('chaves com caixa diferente são reconhecidas (Orientation, spritetype)', () => {
    const [ctx] = coletar({
      containerWindowType: {
        Name: 'pai',
        Size: { width: 100, height: 200 },
        clipping: true,
        iconType: { spritetype: 'GFX_portrait_character', Position: { x: 5, y: 5 }, Scale: 0.5 },
      },
    });

    expect(ctx.scale).toBe(0.5);
    expect(ctx.janela).toEqual({ x0: -10, y0: -10, x1: 190, y1: 390 });
  });
});
