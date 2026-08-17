import { describe, expect, test } from 'bun:test';
import { criarImagem, pintarRetangulo } from '../png';
import {
  calcularGeometria,
  detectarInicioDoCorpo,
  resolverGuia,
  validarEnquadramento,
  type MedidaTrim,
} from './framing';
import { RIGS } from './types';

const CANVAS = RIGS.ssm_shared.canvas;
const GUIA = resolverGuia(CANVAS, RIGS.ssm_shared.guia!);
const OPACO = { r: 0, g: 0, b: 0 };

const medida = (largura: number, altura: number, inicioDoCorpo?: number): MedidaTrim => ({
  arquivo: 'teste.png',
  largura,
  altura,
  inicioDoCorpo,
});

describe('guia resolvido', () => {
  test('o guia está centrado no canvas', () => {
    expect(GUIA.centroX).toBe(CANVAS.largura / 2);
    expect(GUIA.x).toBe(190);
    expect(GUIA.largura).toBe(600);
    expect(GUIA.topo).toBe(144);
  });
});

describe('detectarInicioDoCorpo', () => {
  test('silhueta sólida desde o topo devolve 0', () => {
    const img = criarImagem(100, 200);
    pintarRetangulo(img, 0, 0, 100, 200, OPACO);
    expect(detectarInicioDoCorpo(img)).toBe(0);
  });

  test('mede densidade, não largura', () => {
    // O caso real: chifres LARGOS mas esparsos. Um detector por largura acharia
    // o topo em 0, porque a primeira linha já é quase tão larga quanto a
    // imagem — só que quase vazia.
    const img = criarImagem(100, 200);
    // "chifres": 10 galhos de 1px espalhados por toda a largura, y 0..49
    for (let x = 0; x < 100; x += 10) pintarRetangulo(img, x, 0, 1, 50, OPACO);
    // "cabeça": bloco sólido mais estreito, y 50..200
    pintarRetangulo(img, 25, 50, 50, 150, OPACO);

    expect(detectarInicioDoCorpo(img)).toBeCloseTo(50 / 200, 3);
  });

  test('ignora ruído esparso acima do corpo', () => {
    const img = criarImagem(100, 100);
    pintarRetangulo(img, 50, 0, 2, 20, OPACO); // antena fina
    pintarRetangulo(img, 10, 20, 80, 80, OPACO);
    expect(detectarInicioDoCorpo(img)).toBeCloseTo(0.2, 2);
  });
});

describe('calcularGeometria', () => {
  test('modo largura ancora no guia, sem âncora de cabeça', () => {
    const g = calcularGeometria(medida(300, 400), 'largura', GUIA);
    expect(g.largura).toBe(600);
    expect(g.altura).toBe(800);
    expect(g.x).toBe(190);
    expect(g.y).toBe(144);
  });

  test('modo altura centraliza no guia', () => {
    const g = calcularGeometria(medida(400, 400), 'altura', GUIA);
    expect(g.altura).toBe(GUIA.alturaMinima);
    expect(g.x + g.largura / 2).toBeCloseTo(GUIA.centroX, 0);
    expect(g.y).toBe(144);
  });

  test('âncora de cabeça sobe a arte pelo tanto que o ornamento ocupa', () => {
    // 10% da altura escalada (800) = 80px acima do guia.
    const g = calcularGeometria(medida(300, 400, 0.1), 'largura', GUIA);
    expect(g.y).toBe(144 - 80);
    // O resto da geometria não muda.
    expect(g.largura).toBe(600);
    expect(g.altura).toBe(800);
  });

  test('a subida para no topo do canvas — acima dele não existe plano', () => {
    const g = calcularGeometria(medida(300, 400, 0.5), 'largura', GUIA);
    expect(g.y).toBe(0);
  });

  test('inicioDoCorpo ausente é idêntico a zero', () => {
    expect(calcularGeometria(medida(300, 400), 'largura', GUIA)).toEqual(
      calcularGeometria(medida(300, 400, 0), 'largura', GUIA)
    );
  });
});

describe('validarEnquadramento', () => {
  test('aceita arte que alcança a base', () => {
    expect(validarEnquadramento([medida(300, 400)], 'largura', GUIA, 'ssm_teste')).toEqual([]);
  });

  test('recusa arte que flutuaria acima da base, e manda trocar o modo', () => {
    // 600 de largura com proporção quase quadrada não alcança 780.
    const erros = validarEnquadramento([medida(600, 500)], 'largura', GUIA, 'ssm_teste');
    expect(erros).toHaveLength(1);
    expect(erros[0]).toContain('flutuaria');
    expect(erros[0]).toContain('"modo": "altura"');
  });

  test('a âncora de cabeça é levada em conta ao checar a base', () => {
    // Alcança a base ancorada no guia (144 + 700 > 780), mas não se subir 30%
    // (0 + 700 < 780). A validação precisa julgar a geometria final.
    expect(validarEnquadramento([medida(600, 700)], 'largura', GUIA, 'ssm_teste')).toEqual([]);
    const comAncora = validarEnquadramento([medida(600, 700, 0.3)], 'largura', GUIA, 'ssm_teste');
    expect(comAncora).toHaveLength(1);
    // Culpa da âncora, não da proporção: trocar o modo aqui só encolheria a
    // arte à toa, então a mensagem tem que apontar a âncora e não o modo.
    expect(comAncora[0]).toContain('âncora "cabeca"');
    expect(comAncora[0]).not.toContain('"modo": "altura"');
  });

  test('recusa conteúdo vazio', () => {
    const erros = validarEnquadramento([medida(0, 0)], 'largura', GUIA, 'ssm_teste');
    expect(erros[0]).toContain('não tem conteúdo');
  });

  test('modo altura recusa arte que estoura o canvas na largura', () => {
    const erros = validarEnquadramento([medida(2000, 400)], 'altura', GUIA, 'ssm_teste');
    expect(erros).toHaveLength(1);
    expect(erros[0]).toContain('ultrapassa o canvas');
  });
});
