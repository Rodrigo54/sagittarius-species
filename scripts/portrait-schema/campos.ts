import { z } from 'zod';
import {
  ARQUETIPOS,
  CORES,
  CORES_OLHO,
  ESTADOS_TORSO,
  ESTILOS_CABELO,
  ETNIAS,
  FORMAS_CORPO,
  FORMAS_OLHO,
  GENEROS_PESSOA,
} from './vocabulario';

/** Campos de DADO de cada seção de `geracaoArt` — o que descreve a espécie/
 * indivíduo, sem `template`/`extra` (que são texto de prompt, não dado).
 *
 * Esta separação existe por dois motivos:
 * 1. **São exatamente os campos interpoláveis.** `templates.ts` deriva daqui
 *    o conjunto de caminhos `<secao.campo>` aceitos, sem lista paralela: um
 *    campo novo aqui vira interpolável no mesmo commit. `template`/`extra`
 *    ficam de fora de propósito — um template não referencia outro template.
 * 2. **Quebra o ciclo de import.** `schema.ts` monta cada seção como "estes
 *    campos + template + extra", e o validador de sintaxe de template precisa
 *    dos caminhos; com os shapes isolados aqui, ninguém importa em círculo.
 *
 * Convenção de idioma (CLAUDE.md): chaves em inglês, `.describe(...)` em
 * português — é o texto que o IntelliSense mostra ao editar um
 * `portrait.json`. */

export const CAMPOS_SPECIES = {
  archetype: z
    .enum(ARQUETIPOS)
    .describe(
      'Arquétipo visual — categoria ampla, reaproveitável entre espécies visualmente diferentes (ex.: "Human" cobre ssm_default, ssm_knight, ssm_astral e ssm_mercenary).'
    ),
} as const;

export const CAMPOS_PERSON = {
  age: z.number().positive().optional().describe('Idade aparente do indivíduo.'),
  ethnicity: z.enum(ETNIAS).optional().describe('Etnia.'),
  body_shape: z.enum(FORMAS_CORPO).optional().describe('Tipo físico/corpo.'),
  gender: z
    .enum(GENEROS_PESSOA)
    .optional()
    .describe(
      'Gênero do indivíduo no prompt (Female/Male/Androgynous) — não confundir com a chave de gênero-alvo de geração (male/female/genderless) do bloco pai, que usa outra convenção (inclusive não tem "Androgynous").'
    ),
} as const;

export const CAMPOS_HAIR = {
  style: z.enum(ESTILOS_CABELO).optional().describe('Estilo/corte de cabelo.'),
  primary_color: z.enum(CORES).optional().describe('Cor principal do cabelo.'),
  secondary_color: z.enum(CORES).optional().describe('Cor secundária do cabelo (mechas, dip-dye, etc.).'),
} as const;

export const CAMPOS_EYES = {
  shape: z.enum(FORMAS_OLHO).optional().describe('Formato dos olhos.'),
  color: z.enum(CORES_OLHO).optional().describe('Cor dos olhos.'),
} as const;

export const CAMPOS_TORSO = {
  state: z
    .enum(ESTADOS_TORSO)
    .optional()
    .describe(
      'Estado estruturado do tronco (âncora: prioridade alta, peso automático no prompt). Neutro — não julga "mais coberto é melhor" (escama à mostra é um estado tão correto quanto armadura completa, dependendo da espécie).'
    ),
  primary_color: z
    .enum(CORES)
    .optional()
    .describe('Cor principal do que cobre o tronco (mesmo vocabulário de hair.primary_color, reaproveitado).'),
  secondary_color: z
    .enum(CORES)
    .optional()
    .describe('Cor secundária/acento do que cobre o tronco (mesmo vocabulário de hair.secondary_color, reaproveitado).'),
} as const;

/** Todas as seções, indexadas pelo nome que aparece no caminho de um
 * placeholder (`<torso.primary_color>`). */
export const CAMPOS_POR_SECAO = {
  species: CAMPOS_SPECIES,
  person: CAMPOS_PERSON,
  hair: CAMPOS_HAIR,
  eyes: CAMPOS_EYES,
  torso: CAMPOS_TORSO,
} as const;

export type NomeDeSecao = keyof typeof CAMPOS_POR_SECAO;
