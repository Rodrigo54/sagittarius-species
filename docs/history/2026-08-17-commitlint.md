# Commitlint: convenção de commits com emoji, validada por hook

Registro de 2026-08-17. O estado atual está em `docs/convencao-de-commits.md`; aqui fica o porquê.

## O gatilho

O histórico do repositório já vinha em Conventional Commits, mas por hábito e sem nenhuma validação: tipos fora
da lista, mensagens em inglês e português misturadas, e nada impedindo um commit fora do formato. A decisão foi
tornar a convenção executável — e, junto, adotar um emoji por tipo, que dá leitura rápida do `git log` sem
depender de ler o tipo por extenso.

Os commits **anteriores** a esta data não têm emoji e continuam como estão: o `commit-msg` só vê mensagens
novas, e reescrever o histórico para satisfazer a regra custaria mais do que vale.

## Por que não husky

O caminho óbvio (e o que a maioria dos projetos JS faz) seria husky, que aponta `core.hooksPath` para uma pasta
versionada. Aqui isso **quebraria o git-lfs**: os `.psd` de `assets/` são rastreados por LFS, e o
`git lfs install` deste clone escreveu `post-checkout`, `post-commit`, `post-merge` e `pre-push` dentro de
`.git/hooks/`. Trocar o `hooksPath` faria o git parar de olhar essa pasta — sem erro, sem aviso; o sintoma seria
`.psd` chegando como ponteiro de texto depois de um checkout.

Em vez disso, `scripts/install-git-hooks.ts` copia cada hook versionado de `scripts/git-hooks/` para
`.git/hooks/`, deixando os hooks do LFS intactos. É menos "padrão de mercado", mas o repositório ganha uma
dependência a menos e nenhum ponto de falha silenciosa.

## A proibição de coautoria de IA

A segunda regra própria, `no-ia-coauthor`, existe porque o padrão do Claude Code é fechar toda mensagem de
commit com `Co-Authored-By: Claude ... <noreply@anthropic.com>`. Aqui o histórico registra quem assume o
commit, e uma ferramenta não assume nada — o trailer só polui o `git log`, a lista de contribuidores do GitHub e
qualquer `git shortlog`.

Pedir no `CLAUDE.md` resolveria a maior parte dos casos, mas depende de o agente da vez ler e lembrar; a regra
faz o hook reprovar de qualquer jeito. Ela olha a mensagem crua, e não o `footer` parseado, para não depender de
como o parser segmenta corpo e rodapé: a linha é rejeitada onde quer que caia.

## Por que a regra de emoji é própria

O parser do `@commitlint/config-conventional` não conhece prefixo de emoji: ele leria `✨ feat` como o tipo
literal `"✨ feat"` e reprovaria tudo. A correção tem duas partes, ambas em `commitlint.config.js`:

1. um `headerPattern` próprio, que captura o emoji num grupo separado antes do `<tipo>(<escopo>): <assunto>` —
   com `headerCorrespondence` nomeando esse grupo como `emoji`;
2. uma regra `type-emoji`, escrita como plugin inline, que compara o emoji capturado com o esperado para o tipo.

Não existe pacote pronto que faça isso do jeito que se queria (a maioria dos presets com emoji troca o *tipo*
pelo emoji, em vez de exigir os dois). A comparação normaliza variation selectors e ZWJ antes de comparar, senão
`♻` e `♻️` — indistinguíveis na tela, diferentes em bytes — se comportariam de forma diferente dependendo de
onde a mensagem foi digitada.
