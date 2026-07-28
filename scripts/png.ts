/** Escrita e leitura de PNG RGBA de 8 bits, sem dependência externa.
 *
 * A **escrita** usa filtro `None` em toda linha: a arte de calibração é feita
 * de faixas sólidas, onde filtro não compensa, e manter a saída simples torna
 * o teste de ida e volta uma verificação real do arquivo, não do buffer.
 *
 * A **leitura** entende os cinco filtros do padrão, porque não lê só o que
 * este módulo escreve: lê PNG de terceiros — a saída do texconv na verificação
 * de compressão, e os screenshots do jogo na etapa de medição. O primeiro
 * arquivo externo que passou por aqui já veio com filtro `Sub`.
 *
 * Fora de escopo: entrelace e paleta.
 */

import { deflateSync, inflateSync } from 'node:zlib';

const ASSINATURA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabela[n] = c >>> 0;
  }
  return tabela;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = TABELA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(tipo: string, dados: Buffer): Buffer {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length, 0);
  const corpo = Buffer.concat([Buffer.from(tipo, 'latin1'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo), 0);
  return Buffer.concat([tamanho, corpo, crc]);
}

export interface Imagem {
  largura: number;
  altura: number;
  /** RGBA, 4 bytes por pixel, linha a linha. */
  pixels: Buffer;
}

export function criarImagem(largura: number, altura: number): Imagem {
  return { largura, altura, pixels: Buffer.alloc(largura * altura * 4) };
}

export function pintar(
  img: Imagem,
  x: number,
  y: number,
  cor: { r: number; g: number; b: number },
  alfa = 255
) {
  if (x < 0 || y < 0 || x >= img.largura || y >= img.altura) return;
  const i = (y * img.largura + x) * 4;
  img.pixels[i] = cor.r;
  img.pixels[i + 1] = cor.g;
  img.pixels[i + 2] = cor.b;
  img.pixels[i + 3] = alfa;
}

export function lerPixel(img: Imagem, x: number, y: number) {
  const i = (y * img.largura + x) * 4;
  return {
    r: img.pixels[i],
    g: img.pixels[i + 1],
    b: img.pixels[i + 2],
    a: img.pixels[i + 3],
  };
}

export function pintarRetangulo(
  img: Imagem,
  x0: number,
  y0: number,
  largura: number,
  altura: number,
  cor: { r: number; g: number; b: number }
) {
  for (let y = y0; y < y0 + altura; y++) {
    for (let x = x0; x < x0 + largura; x++) pintar(img, x, y, cor);
  }
}

export function codificarPng(img: Imagem): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.largura, 0);
  ihdr.writeUInt32BE(img.altura, 4);
  ihdr[8] = 8; // profundidade por canal
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compressão deflate
  ihdr[11] = 0; // método de filtro padrão
  ihdr[12] = 0; // sem entrelace

  const bytesPorLinha = img.largura * 4;
  const cru = Buffer.alloc((bytesPorLinha + 1) * img.altura);
  for (let y = 0; y < img.altura; y++) {
    cru[y * (bytesPorLinha + 1)] = 0; // filtro None
    img.pixels.copy(cru, y * (bytesPorLinha + 1) + 1, y * bytesPorLinha, (y + 1) * bytesPorLinha);
  }

  return Buffer.concat([
    ASSINATURA,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(cru, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function decodificarPng(buf: Buffer): Imagem {
  if (!buf.subarray(0, 8).equals(ASSINATURA)) throw new Error('assinatura PNG inválida');

  let pos = 8;
  let largura = 0;
  let altura = 0;
  const partesIdat: Buffer[] = [];

  while (pos < buf.length) {
    const tamanho = buf.readUInt32BE(pos);
    const tipo = buf.subarray(pos + 4, pos + 8).toString('latin1');
    const dados = buf.subarray(pos + 8, pos + 8 + tamanho);

    if (tipo === 'IHDR') {
      largura = dados.readUInt32BE(0);
      altura = dados.readUInt32BE(4);
      if (dados[8] !== 8 || dados[9] !== 6) {
        throw new Error(`só RGBA de 8 bits é suportado (profundidade ${dados[8]}, tipo ${dados[9]})`);
      }
      if (dados[12] !== 0) throw new Error('PNG entrelaçado não é suportado');
    } else if (tipo === 'IDAT') {
      partesIdat.push(Buffer.from(dados));
    } else if (tipo === 'IEND') {
      break;
    }

    pos += 12 + tamanho;
  }

  const cru = inflateSync(Buffer.concat(partesIdat));
  const bytesPorLinha = largura * 4;
  const pixels = Buffer.alloc(bytesPorLinha * altura);
  const BPP = 4; // bytes por pixel, para os filtros que olham o pixel à esquerda

  for (let y = 0; y < altura; y++) {
    const filtro = cru[y * (bytesPorLinha + 1)];
    const entrada = y * (bytesPorLinha + 1) + 1;
    const saida = y * bytesPorLinha;

    for (let i = 0; i < bytesPorLinha; i++) {
      const bruto = cru[entrada + i];
      const esquerda = i >= BPP ? pixels[saida + i - BPP] : 0;
      const acima = y > 0 ? pixels[saida - bytesPorLinha + i] : 0;
      const diagonal = y > 0 && i >= BPP ? pixels[saida - bytesPorLinha + i - BPP] : 0;

      let valor: number;
      switch (filtro) {
        case 0: // None
          valor = bruto;
          break;
        case 1: // Sub
          valor = bruto + esquerda;
          break;
        case 2: // Up
          valor = bruto + acima;
          break;
        case 3: // Average
          valor = bruto + ((esquerda + acima) >> 1);
          break;
        case 4: { // Paeth
          const p = esquerda + acima - diagonal;
          const pe = Math.abs(p - esquerda);
          const pa = Math.abs(p - acima);
          const pd = Math.abs(p - diagonal);
          valor = bruto + (pe <= pa && pe <= pd ? esquerda : pa <= pd ? acima : diagonal);
          break;
        }
        default:
          throw new Error(`linha ${y} usa filtro ${filtro}, que não existe no padrão PNG`);
      }

      pixels[saida + i] = valor & 0xff;
    }
  }

  return { largura, altura, pixels };
}
