import { describe, expect, test } from 'bun:test';
import { extrairNomesDeRetrato } from './portrait-types';

describe('descoberta dos portraitType de personagem', () => {
  test('reconhece pelo bloco, não pelo nome', () => {
    // Transcrito de interface/core.gfx. O caso que importa é o terceiro: um
    // sprite de retrato cujo nome não começa com "GFX_portrait_character" e
    // que um filtro por prefixo perderia — é a tela de contatos.
    const nomes = extrairNomesDeRetrato(`
spriteTypes = {
	portraitType = {
		name = "GFX_portrait_character"
		texturefile = "gfx/interface/main/unselected_portrait.dds"
		type = character
		character = yes
	}

	portraitType = {
		name = "GFX_portrait_character_close_up"
		type = character
		character = yes
		close_up = yes
	}

	portraitType = {
		name = "GFX_contacts_portrait_character_masked"
		type = character
		character = yes
	}

	portraitType = {
		name = "GFX_portrait_room"
		type = room
	}

	spriteType = {
		name = "GFX_leader_bg_admiral"
	}
}
`);

    expect(nomes).toEqual([
      'GFX_portrait_character',
      'GFX_portrait_character_close_up',
      'GFX_contacts_portrait_character_masked',
    ]);
  });

  test('ignora portraitType que não é de personagem', () => {
    const nomes = extrairNomesDeRetrato(`portraitType = {
		name = "GFX_portrait_planet"
		type = planet
	}`);

    expect(nomes).toEqual([]);
  });

  test('bloco sem name é ignorado em vez de quebrar', () => {
    const nomes = extrairNomesDeRetrato(`portraitType = {
		type = character
		character = yes
	}`);

    expect(nomes).toEqual([]);
  });
});
