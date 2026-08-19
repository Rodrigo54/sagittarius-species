import type { GeneroAlvo } from '../portrait-schema';
import { pad } from '../utils';
import { RIGS, RIG_PADRAO, type SpeciesInfo } from './types';

function blocoPortraitEntry(
  groupId: string,
  greetingSound: string,
  texturas: string[],
  entity: string
): string {
  const lista = texturas.map((t) => `      "${t}"`).join('\n');
  return [
    `  ${groupId} = {`,
    `    entity = "${entity}"`,
    `    clothes_selector = "no_texture"`,
    `    attachment_selector = "no_texture"`,
    `    greeting_sound = "${greetingSound}"`,
    `    custom_attachment_label = "HAIR_STYLE"`,
    `    character_textures = {`,
    lista,
    `    }`,
    `  }`,
  ].join('\n');
}

function blocoAddComTrigger(triggerLinhas: string[], grupo: string): string {
  const trigger = triggerLinhas.map((linha) => `          ${linha}`).join('\n');
  return [
    `      add = {`,
    `        trigger = {`,
    trigger,
    `        }`,
    `        portraits = {`,
    `          ${grupo}`,
    `        }`,
    `      }`,
  ].join('\n');
}

function triggerGeneroRuler(genero: 'female' | 'male'): string[] {
  return [
    `ruler = {`,
    `  OR = {`,
    `    gender = ${genero}`,
    `    gender = indeterminable`,
    `  }`,
    `}`,
  ];
}

function triggerGenero(genero: 'female' | 'male'): string[] {
  return [`OR = {`, `  gender = ${genero}`, `  gender = indeterminable`, `}`];
}

function triggerPopExclui(genero: 'male' | 'female'): string[] {
  return [`NOR = {`, `  species = {`, `    species_gender = ${genero}`, `  }`, `}`];
}

function blocoPortraitGroups(
  slug: string,
  grupoDefault: string,
  grupoMale: string,
  grupoFemale: string
): string {
  return [
    `portrait_groups = {`,
    `  ${slug} = {`,
    `    default = ${grupoDefault}`,
    `    game_setup = {`,
    blocoAddComTrigger(triggerGeneroRuler('female'), grupoFemale),
    blocoAddComTrigger(triggerGeneroRuler('male'), grupoMale),
    `    }`,
    `    species = {`,
    `      # generic portrait for a species`,
    `      add = {`,
    `        portraits = {`,
    `          ${grupoMale}`,
    `        }`,
    `      }`,
    `    }`,
    `    pop = {`,
    `      #for a specific pop`,
    blocoAddComTrigger(triggerPopExclui('male'), grupoFemale),
    blocoAddComTrigger(triggerPopExclui('female'), grupoMale),
    `    }`,
    `    leader = {`,
    `      # scientists, generals, admirals, governor`,
    blocoAddComTrigger(triggerGenero('female'), grupoFemale),
    blocoAddComTrigger(triggerGenero('male'), grupoMale),
    `    }`,
    `    ruler = {`,
    `      # portraits used for rulers`,
    blocoAddComTrigger(triggerGenero('female'), grupoFemale),
    blocoAddComTrigger(triggerGenero('male'), grupoMale),
    `    }`,
    `  }`,
    `}`,
  ].join('\n');
}

export function gerarConteudoTxt(slug: string, info: SpeciesInfo): string {
  const entity = RIGS[info.config.rig ?? RIG_PADRAO].entity;

  // Toda textura vive sob a pasta do gênero a que pertence, `genderless/`
  // inclusive — o caminho aqui é o mesmo de `assets/portraits/<slug>/<gênero>/`,
  // porque o staging e a conversão só espelham o caminho relativo.
  const texturas = (genero: GeneroAlvo) =>
    info.arquivos[genero]!.map((_, i) => `gfx/models/portraits/${slug}/${genero}/${pad(i + 1)}.dds`);

  // A espécie sem gênero gera UM portrait, usado nas três posições de
  // portrait_groups; a com gênero gera dois, cada um com trigger de gênero.
  // A diferença é de estrutura do arquivo gerado, não de iteração.
  if (info.arquivos.genderless === undefined) {
    const grupoMale = `${slug}_male_01`;
    const grupoFemale = `${slug}_female_01`;

    const texturasMale = texturas('male');
    const texturasFemale = texturas('female');

    const portraits = [
      `portraits = {`,
      blocoPortraitEntry(grupoMale, 'human_male_greetings_01', texturasMale, entity),
      blocoPortraitEntry(grupoFemale, 'human_female_greetings_01', texturasFemale, entity),
      `}`,
    ].join('\n');

    const portraitGroups = blocoPortraitGroups(slug, grupoMale, grupoMale, grupoFemale);

    return `${portraits}\n\n${portraitGroups}\n`;
  }

  const grupo = `${slug}_01`;

  const portraits = [
    `portraits = {`,
    blocoPortraitEntry(grupo, 'human_male_greetings_01', texturas('genderless'), entity),
    `}`,
  ].join('\n');

  const portraitGroups = blocoPortraitGroups(slug, grupo, grupo, grupo);

  return `${portraits}\n\n${portraitGroups}\n`;
}
