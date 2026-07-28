import { describe, expect, test } from 'bun:test';
import { extrairTiposDeTexto } from './portrait-types';

describe('descoberta dos portraitType de personagem', () => {
  test('reconhece pelo bloco, não pelo nome', () => {
    // Transcrito de interface/core.gfx. O caso que importa é o terceiro: um
    // sprite de retrato cujo nome não começa com "GFX_portrait_character" e
    // que um filtro por prefixo perderia — é a tela de contatos.
    const tipos = extrairTiposDeTexto(
      `
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
`,
      'core.gfx'
    );

    expect(tipos.map((t) => t.nome)).toEqual([
      'GFX_portrait_character',
      'GFX_portrait_character_close_up',
      'GFX_contacts_portrait_character_masked',
    ]);
    expect(tipos[1].closeUp).toBe(true);
    expect(tipos[0].closeUp).toBe(false);
  });

  test('ignora portraitType que não é de personagem', () => {
    const tipos = extrairTiposDeTexto(
      `portraitType = {
		name = "GFX_portrait_planet"
		type = planet
	}`,
      'core.gfx'
    );

    expect(tipos).toEqual([]);
  });

  test('bloco sem name é ignorado em vez de quebrar', () => {
    const tipos = extrairTiposDeTexto(
      `portraitType = {
		type = character
		character = yes
	}`,
      'core.gfx'
    );

    expect(tipos).toEqual([]);
  });
});
