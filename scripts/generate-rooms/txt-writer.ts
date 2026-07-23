import type { RoomsInfo } from './types';

const pad = (n: number) => String(n).padStart(3, '0');

export function gerarConteudoTxt(info: RoomsInfo): string {
  const entradas = info.arquivos
    .map((_, i) => `    "${pad(i + 1)}_room" = { always = yes }`)
    .join('\n');

  return [
    'room_selector = {',
    '  # Script may point to textures in \'gfx\\portraits\\city_sets\\\' that end with "_room.dds" while ignoring the file ending, e.g.: "room = machine_room" will find \'machine_room(.dds)\'.',
    '',
    '  game_setup = {',
    entradas,
    '  }',
    '}',
    '',
  ].join('\n');
}
