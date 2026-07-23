/** Templates dos três arquivos de script que acompanham o `.mesh` do
 * `ssm_shared` — mesma estrutura do `sl_shared` original, só com os
 * identificadores renomeados pro prefixo `ssm_` (ver CLAUDE.md) e sem a
 * entity `spider` (não usada por nenhuma espécie hoje — ver future-plans.md). */

export const ENTITIES_ASSET = `
@humanscale = 0.8

entity = {
	name = "ssm_humanoid_01_entity"
	pdxmesh = "ssm_humanoid_01_mesh"

	default_state = "idle"
	state = { name = "idle"       animation = "idle"    animation_blend_time = 0.45 chance = 3.0 looping = no next_state = idle}
	state = { name = "idle"       animation = "idle2"    animation_blend_time = 0.45 chance = 1.0 looping = no next_state = idle}

	state = { name = "sad"       animation = "sad"    animation_blend_time = 0.45 chance = 3.0 looping = no next_state = sad}
	state = { name = "sad"       animation = "sad2"    animation_blend_time = 0.45 chance = 1.0 looping = no next_state = sad}
	scale = 1.1
}
`;

export const MESHES_GFX = `objectTypes = {

	pdxmesh = {
		name = "ssm_humanoid_01_mesh"
		file = "gfx/models/portraits/ssm_shared/humanoid_01_portrait.mesh"
		animation = { id = "idle"	type = "ssm_humanoid_01_happy_animation" }
		animation = { id = "idle2"	type = "ssm_humanoid_01_happy_2_animation" }
		animation = { id = "sad"	type = "ssm_humanoid_01_sad_animation" }
		animation = { id = "sad2"	type = "ssm_humanoid_01_sad_2_animation" }
		scale = 1.0
	}

}
`;

export const ANIMATIONS_ASSET = `
animation = {
	name = "ssm_humanoid_01_happy_animation"
	file = "humanoid_01_portrait_happy.anim"
}

animation = {
	name = "ssm_humanoid_01_happy_2_animation"
	file = "humanoid_01_portrait_happy_2.anim"
}

animation = {
	name = "ssm_humanoid_01_sad_animation"
	file = "humanoid_01_portrait_sad.anim"
}

animation = {
	name = "ssm_humanoid_01_sad_2_animation"
	file = "humanoid_01_portrait_sad_2.anim"
}
`;
