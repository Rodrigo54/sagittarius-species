import { nomesNumerados } from '../utils';
import { limparArquivos } from '../shared/files';
import type { RoomsInfo } from './types';

const roomDdsNumerado = (nome: string) => /^\d{3,}_room\.dds$/.test(nome);

/** Apaga, na pasta de destino em mod/, qualquer .dds que não corresponda a um
 * PNG de origem — limpeza total, sem exceção, mesma política dos portraits. */
export async function limparOrfaos(info: RoomsInfo, pastaDestino: string) {
  await limparArquivos(pastaDestino, roomDdsNumerado, nomesNumerados(info.arquivos.length, '_room.dds'));
}
