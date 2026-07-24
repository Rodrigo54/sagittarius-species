import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PASTA_ASSETS, PASTA_MOD, converter } from '../converter';
import { carregarRooms } from './discovery';
import { limparOrfaos } from './sync';
import { gerarConteudoTxt } from './txt-writer';
import { validarRooms } from './validation';

const PASTA_CITY_SETS_ASSETS = join(PASTA_ASSETS, 'city_sets');
const PASTA_CITY_SETS_MOD = join(PASTA_MOD, 'gfx/portraits/city_sets');
const PASTA_ROOM_TXT = join(PASTA_MOD, 'gfx/portraits/asset_selectors');

async function main() {
  const info = await carregarRooms(PASTA_CITY_SETS_ASSETS);

  // Valida tudo antes de mexer em qualquer arquivo — erro trava a geração sem
  // deixar o mod num estado parcialmente limpo/atualizado.
  const erros = validarRooms(info);
  if (erros.length > 0) {
    console.error(
      `${erros.length} erro(s) de validação encontrado(s) — nada foi escrito ou apagado:`
    );
    for (const erro of erros) console.error(` - ${erro}`);
    process.exit(1);
  }

  await limparOrfaos(info, PASTA_CITY_SETS_MOD);

  await converter(info.arquivos, {
    format: 'bc1',
    noMips: true,
    pastaOrigem: PASTA_CITY_SETS_ASSETS,
    pastaDestino: PASTA_CITY_SETS_MOD,
  });

  await writeFile(join(PASTA_ROOM_TXT, 'ssm_room_textures.txt'), gerarConteudoTxt(info));

  console.log(`Gerado: ${info.arquivos.length} room(s) de city_sets.`);
}

main();
