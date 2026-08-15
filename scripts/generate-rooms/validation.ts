import { basename } from 'node:path';
import { pad } from '../utils';
import type { RoomsInfo } from './types';

/** Confere que os arquivos são exatamente "001_room.png".."NNN_room.png",
 * zero-padded a 3 dígitos, sequenciais e sem buracos — mesma convenção usada
 * pelos portraits, aplicada aqui ao sufixo "_room". */
export function validarRooms(info: RoomsInfo): string[] {
  const erros: string[] = [];

  info.arquivos.forEach((arquivo, index) => {
    const nomeEsperado = `${pad(index + 1)}_room.png`;
    if (basename(arquivo) !== nomeEsperado) {
      erros.push(
        `esperava "${nomeEsperado}" na posição ${index} de assets/city_sets/, encontrou "${basename(arquivo)}" — numeração precisa ser sequencial e zero-padded a 3 dígitos, sem buracos`
      );
    }
  });

  return erros;
}
