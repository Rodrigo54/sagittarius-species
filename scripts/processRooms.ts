import { join } from 'node:path';
import { PASTA_ASSETS, PASTA_MOD, converter } from './converter';
import { listar } from './utils';

export const processRooms = async () => {
  const pastaOrigem = join(PASTA_ASSETS, 'city_sets');
  const pastaDestino = join(PASTA_MOD, 'gfx/portraits/city_sets');
  const { arquivos } = await listar(pastaOrigem);
  await converter(arquivos, {
    format: 'bc1',
    noMips: true,
    pastaOrigem,
    pastaDestino,
  });
};

const main = async () => {
  console.log('Processando City Sets');
  await processRooms();
};

main().then(() => console.log('Fim'));
