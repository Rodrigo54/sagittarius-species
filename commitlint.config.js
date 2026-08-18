// Conventional commits com emoji obrigatório no início
// (ex.: "✨ feat(escopo): descrição").
//
// O parser padrão não entende o prefixo de emoji, então sobrescrevemos o
// headerPattern para capturá-lo antes do <type>(<scope>): <subject>. A regra
// customizada `type-emoji` garante que o emoji corresponde ao tipo, usando o
// mapeamento TYPE_EMOJI abaixo — a fonte da verdade da convenção do projeto.

/** Emoji obrigatório por tipo de commit. */
const TYPE_EMOJI = {
  feat: '✨',
  fix: '🐛',
  docs: '📚',
  style: '💄',
  refactor: '♻️',
  perf: '🚀',
  test: '🧪',
  build: '📦',
  ci: '🚧',
  chore: '🛠️',
  revert: '⏪',
};

/** Trailer de coautoria de assistente de IA — proibido em qualquer commit
 * deste repositório. Casa a linha inteira do trailer, em qualquer posição da
 * mensagem, ignorando caixa. */
const COAUTORIA_IA = /^[ \t]*co-authored-by:.*(claude|anthropic)/im;

/** Remove variation selectors/ZWJ para comparar emojis de forma estável. */
const normalizeEmoji = (value) =>
  (value ?? '').replace(/[\u{FE0E}\u{FE0F}\u{200D}]/gu, '').trim();

/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  parserPreset: {
    parserOpts: {
      headerPattern:
        /^(?:(:\w+:|(?:\p{Emoji_Presentation}|\p{Extended_Pictographic})(?:\u{FE0F}|\u{200D}\p{Extended_Pictographic})*)\s+)?(\w+)(?:\(([^)]+)\))?(!)?: (.+)$/u,
      headerCorrespondence: ['emoji', 'type', 'scope', 'breaking', 'subject'],
    },
  },
  plugins: [
    {
      rules: {
        'type-emoji': ({ type, emoji }) => {
          // Tipo inválido/ausente é responsabilidade do type-enum/type-empty.
          if (!type || !(type in TYPE_EMOJI)) {
            return [true];
          }
          const expected = TYPE_EMOJI[type];
          if (!emoji) {
            return [false, `commit do tipo "${type}" deve começar com o emoji ${expected}`];
          }
          if (normalizeEmoji(emoji) !== normalizeEmoji(expected)) {
            return [false, `emoji "${emoji}" não corresponde ao tipo "${type}" — use ${expected}`];
          }
          return [true];
        },
        'no-ia-coauthor': ({ raw }) => {
          if (COAUTORIA_IA.test(raw ?? '')) {
            return [
              false,
              'a mensagem não pode ter trailer "Co-Authored-By" de Claude/Anthropic — apague a linha',
            ];
          }
          return [true];
        },
      },
    },
  ],
  rules: {
    'type-enum': [2, 'always', Object.keys(TYPE_EMOJI)],
    'type-empty': [2, 'never'],
    'type-case': [2, 'always', 'lower-case'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
    'type-emoji': [2, 'always'],
    'no-ia-coauthor': [2, 'always'],
  },
};
