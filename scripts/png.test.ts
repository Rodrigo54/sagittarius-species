import { describe, expect, test } from 'bun:test';
import { deflateSync } from 'node:zlib';
import { decodificar } from './generate-calibration/encoding';
import { gerarCalibracao } from './generate-calibration/index';
import { RIGS } from './generate-portraits/types';
import { codificarPng, criarImagem, decodificarPng, lerPixel, pintar } from './png';

/** Monta um PNG RGBA a partir de scanlines já filtradas, para exercitar a
 * leitura com filtros que o nosso escritor nunca produz. */
function montarPngCom(largura: number, altura: number, scanlines: Buffer): Buffer {
  const crcTabela = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTabela[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (tipo: string, dados: Buffer) => {
    const tam = Buffer.alloc(4);
    tam.writeUInt32BE(dados.length, 0);
    const corpo = Buffer.concat([Buffer.from(tipo, 'latin1'), dados]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(corpo), 0);
    return Buffer.concat([tam, corpo, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(largura, 0);
  ihdr.writeUInt32BE(altura, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(scanlines)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('PNG', () => {
  test('ida e volta preserva os pixels', () => {
    const img = criarImagem(7, 5); // dimensões ímpares de propósito
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 7; x++) {
        pintar(img, x, y, { r: x * 30, g: y * 50, b: (x + y) * 20 }, 200 + x);
      }
    }

    const lida = decodificarPng(codificarPng(img));

    expect(lida.largura).toBe(7);
    expect(lida.altura).toBe(5);
    expect(lida.pixels.equals(img.pixels)).toBe(true);
  });

  test('pintar fora dos limites não estoura nem escreve', () => {
    const img = criarImagem(4, 4);
    const antes = Buffer.from(img.pixels);
    pintar(img, -1, 0, { r: 255, g: 0, b: 0 });
    pintar(img, 0, 9, { r: 255, g: 0, b: 0 });
    expect(img.pixels.equals(antes)).toBe(true);
  });

  test('recusa PNG que este leitor não entende', () => {
    expect(() => decodificarPng(Buffer.alloc(64))).toThrow('assinatura');
  });

  test('lê os cinco filtros do padrão', () => {
    // O leitor não consome só o que este módulo escreve: lê a saída do texconv
    // e os screenshots do jogo. O primeiro PNG externo que passou por aqui já
    // veio com filtro Sub, e um filtro mal implementado corrompe em silêncio.
    const LARGURA = 9;
    const ALTURA = 6;
    const original = criarImagem(LARGURA, ALTURA);
    for (let y = 0; y < ALTURA; y++) {
      for (let x = 0; x < LARGURA; x++) {
        pintar(original, x, y, { r: (x * 37) % 256, g: (y * 53) % 256, b: (x * y * 11) % 256 }, 255);
      }
    }

    const bytesPorLinha = LARGURA * 4;
    const BPP = 4;

    for (const filtro of [0, 1, 2, 3, 4]) {
      // Aplica o filtro à mão e remonta o PNG, para exercitar a leitura.
      const cru = Buffer.alloc((bytesPorLinha + 1) * ALTURA);
      for (let y = 0; y < ALTURA; y++) {
        cru[y * (bytesPorLinha + 1)] = filtro;
        for (let i = 0; i < bytesPorLinha; i++) {
          const atual = original.pixels[y * bytesPorLinha + i];
          const esquerda = i >= BPP ? original.pixels[y * bytesPorLinha + i - BPP] : 0;
          const acima = y > 0 ? original.pixels[(y - 1) * bytesPorLinha + i] : 0;
          const diagonal =
            y > 0 && i >= BPP ? original.pixels[(y - 1) * bytesPorLinha + i - BPP] : 0;

          let previsto = 0;
          if (filtro === 1) previsto = esquerda;
          else if (filtro === 2) previsto = acima;
          else if (filtro === 3) previsto = (esquerda + acima) >> 1;
          else if (filtro === 4) {
            const p = esquerda + acima - diagonal;
            const pe = Math.abs(p - esquerda);
            const pa = Math.abs(p - acima);
            const pd = Math.abs(p - diagonal);
            previsto = pe <= pa && pe <= pd ? esquerda : pa <= pd ? acima : diagonal;
          }

          cru[y * (bytesPorLinha + 1) + 1 + i] = (atual - previsto) & 0xff;
        }
      }

      const png = montarPngCom(LARGURA, ALTURA, cru);
      const lida = decodificarPng(png);
      expect(lida.pixels.equals(original.pixels)).toBe(true);
    }
  });

  test('recusa um filtro que não existe no padrão', () => {
    const cru = Buffer.alloc((4 + 1) * 1);
    cru[0] = 9;
    expect(() => decodificarPng(montarPngCom(1, 1, cru))).toThrow('filtro 9');
  });
});

describe('arte de calibração', () => {
  // O canvas real do rig, não números soltos: a arte é instalada por cima das
  // texturas dele, e um teste ancorado numa geometria antiga deixaria de
  // cobrir a que o jogo recebe.
  const { largura: LARGURA, altura: ALTURA } = RIGS.ssm_shared.canvas;

  test('todo pixel é opaco', () => {
    // Borda transparente não revelaria onde o quadro corta — é o motivo de a
    // arte cobrir o canvas inteiro.
    const img = gerarCalibracao(LARGURA, ALTURA, 'y');
    for (let i = 3; i < img.pixels.length; i += 4) {
      expect(img.pixels[i]).toBe(255);
    }
  });

  test('a cor em cada linha decodifica para a própria coordenada', () => {
    // Lê do arquivo PNG codificado, não do buffer em memória: o teste cobre o
    // caminho inteiro, incluindo a serialização.
    const img = decodificarPng(codificarPng(gerarCalibracao(LARGURA, ALTURA, 'y')));

    // Coluna longe das bordas, para não cair nos cantos nem nos pips.
    const x = Math.floor(LARGURA / 2);
    for (let y = 40; y < ALTURA - 40; y++) {
      const p = lerPixel(img, x, y);
      expect(decodificar(p)).toBe(Math.floor(y / 8));
    }
  });

  test('no eixo x, a cor de cada coluna decodifica para a coordenada x', () => {
    const img = decodificarPng(codificarPng(gerarCalibracao(LARGURA, ALTURA, 'x')));

    const y = Math.floor(ALTURA / 2);
    for (let x = 40; x < LARGURA - 40; x++) {
      expect(decodificar(lerPixel(img, x, y))).toBe(Math.floor(x / 8));
    }
  });

  test('os quatro cantos são distinguíveis entre si', () => {
    const img = gerarCalibracao(LARGURA, ALTURA, 'y');
    const cantos = [
      lerPixel(img, 4, 4),
      lerPixel(img, LARGURA - 5, 4),
      lerPixel(img, 4, ALTURA - 5),
      lerPixel(img, LARGURA - 5, ALTURA - 5),
    ].map((p) => `${p.r},${p.g},${p.b}`);

    expect(new Set(cantos).size).toBe(4);
    // E nenhum deles pode ser confundido com um código de coordenada.
    for (const p of [
      lerPixel(img, 4, 4),
      lerPixel(img, LARGURA - 5, 4),
      lerPixel(img, 4, ALTURA - 5),
      lerPixel(img, LARGURA - 5, ALTURA - 5),
    ]) {
      expect(decodificar(p)).toBeNull();
    }
  });

  test('recusa gerar se as faixas não couberem no espaço de índices', () => {
    // 512 índices × 8 px = 4096 px é o limite; acima disso a arte mentiria.
    expect(() => gerarCalibracao(100, 5000, 'y')).toThrow('excedem');
  });
});
