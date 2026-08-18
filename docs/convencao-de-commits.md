# Convenção de commits

Toda mensagem de commit segue [Conventional Commits](https://www.conventionalcommits.org/) **com um emoji
obrigatório no início**, correspondente ao tipo:

```text
✨ feat(scripts): deriva o registro de portraits da filiação declarada
🐛 fix: corrige as referências de entidade dos retratos de sereia
🛠️ chore: prepara release 1.11.0 (bump de versão + changelog)
```

O formato completo do cabeçalho é `<emoji> <tipo>(<escopo>)<!>: <assunto>`, onde escopo e `!` (breaking change)
são opcionais.

## Tipos e emojis

| Tipo       | Emoji | Uso                                                             |
| ---------- | ----- | --------------------------------------------------------------- |
| `feat`     | ✨    | Funcionalidade nova (script, espécie, conteúdo do mod)           |
| `fix`      | 🐛    | Correção de bug                                                  |
| `docs`     | 📚    | Só documentação (`docs/`, `README.md`, `CLAUDE.md`)              |
| `style`    | 💄    | Formatação/estilo, sem mudar comportamento                       |
| `refactor` | ♻️    | Reorganização de código sem mudar comportamento                  |
| `perf`     | 🚀    | Ganho de desempenho                                              |
| `test`     | 🧪    | Testes                                                           |
| `build`    | 📦    | Dependências, `package.json`, binários de `bin/`                 |
| `ci`       | 🚧    | Automação de CI                                                  |
| `chore`    | 🛠️    | Manutenção geral, release, metadados                             |
| `revert`   | ⏪    | Reversão de um commit anterior                                   |

O emoji é comparado ignorando variation selectors e ZWJ, então `♻` e `♻️` valem a mesma coisa.

## Regras validadas

`commitlint.config.js` estende `@commitlint/config-conventional` e endurece o essencial (todas com severidade de
erro):

- `type-enum` — só os onze tipos da tabela acima;
- `type-emoji` (regra própria, definida no mesmo arquivo) — o emoji tem que existir e bater com o tipo;
- `no-ia-coauthor` (regra própria) — a mensagem inteira não pode conter um trailer
  `Co-Authored-By:` de Claude/Anthropic;
- `type-case` minúsculo, `type-empty`/`subject-empty` proibidos;
- `subject-full-stop` — o assunto não termina em ponto;
- `header-max-length` — 100 caracteres.

A tabela `TYPE_EMOJI` no topo de `commitlint.config.js` é a fonte da verdade: ela alimenta ao mesmo tempo o
`type-enum` e a checagem de emoji.

## Sem coautoria de IA

Nenhum commit leva trailer de coautoria de assistente de IA:

```text
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>    ← rejeitado
```

A regra `no-ia-coauthor` roda sobre a mensagem crua e casa a linha do trailer em qualquer posição, ignorando
caixa, quando o nome ou o e-mail cita Claude/Anthropic. Trailer `Co-Authored-By:` de gente continua válido —
o que a regra rejeita é atribuir autoria a uma ferramenta. A autoria do repositório é de quem commita; o que a
ferramenta ajudou a escrever é irrelevante para o histórico.

Vale para qualquer agente que trabalhe aqui: o padrão do Claude Code é assinar commits com esse trailer, e neste
repositório ele fica desligado — o `CLAUDE.md` diz o mesmo, e o hook é a rede de segurança.

## Como a validação roda

O hook `commit-msg` chama `bunx --no-install commitlint --edit "$1"` e falha o commit quando a mensagem não
passa. O fonte do hook fica versionado em `scripts/git-hooks/commit-msg` e é copiado para `.git/hooks/` por:

```bash
bun run hooks     # bun scripts/install-git-hooks.ts
```

`bun install` já roda isso sozinho (script `prepare`), então um clone novo fica validado depois do primeiro
install.

A instalação **copia arquivo a arquivo** em vez de apontar `core.hooksPath` para uma pasta versionada (o que
husky e afins fazem) porque o `.git/hooks/` deste repositório também guarda os hooks do **git-lfs**
(`post-checkout`, `post-commit`, `post-merge`, `pre-push`), instalados por `git lfs install` para os `.psd` de
`assets/`. Mudar o `hooksPath` desligaria o LFS em silêncio.

Para checar uma mensagem sem commitar:

```bash
echo "✨ feat: mensagem de teste" | bunx commitlint
```
