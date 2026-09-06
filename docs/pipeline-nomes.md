# Pipeline de listas de nomes / localização / species_names

`scripts/generate-names/` (comando `bun run names`, entrada em `index.ts`) usa a biblioteca `jomini` para ir de
uma única fonte JSON até o script Clausewitz, todos os `.yml` de idioma, e o arquivo agregado de espécies-flavor.
Responsabilidades: `types.ts` (tipos compartilhados),
`validation.ts` (chaves reservadas + regra de `sequential_name`), `name-lists.ts` (geração de `.txt`/`.yml` por
name_list) e `species-names.ts` (agregação de `species_names.txt`). A **forma** do JSON de origem é validada por
um schema `zod` próprio (`scripts/name-list-schema/`), no mesmo desenho do `portrait-schema/`: fonte de verdade
em TypeScript, JSON Schema derivado pro autocomplete do VS Code (associado por `json.schemas` no
`.vscode/settings.json`), e `.strict()` — seção escrita errado (`army_name` em vez de `army_names`) é erro na
leitura, não bloco lixo no `.txt`. `scripts/extract-vanilla-keys.ts` é auxiliar, roda à parte (não faz parte do
`bun run names`).

- Fonte: `assets/name_lists/*.json` (ex.: `brazil.json`, `altmer.json`). Cada arquivo tem três blocos de nível
  raiz: `name`/`desc` (metadados do name_list), `ssm_<id>` (o corpo do name_list em si — `ship_names`,
  `army_names`, `character_names`, etc.) e `species_names` (array plano de espécies-flavor que usam esse
  name_list — ver seção abaixo). `species_names` é **irmão** de `ssm_<id>`, nunca aninhado dentro — o `.txt` do
  name_list não aceita essa chave no schema do jogo.
- **Regra de localização do projeto: literal por padrão.** Valores string normais (nomes de nave, personagem,
  planeta) são strings literais, sem prefixo — funcionam em jogo sem tradução por idioma, e é assim que a
  esmagadora maioria do conteúdo do mod já é escrita. O prefixo `l10n|` (ex.: `"l10n|$ORD$ Guarda Nacional"`) é
  reservado **só** para `sequential_name` (campos com placeholder `$ORD$`/`$O$`/`$C$`/`$R$`/`$HEX$`) — é
  requisito funcional do próprio jogo desde o patch 3.6 (sequential_name só templetiza via localisation, uma
  string literal falha silenciosamente), não uma escolha de estilo. Quando usado, o script atribui um token e
  emite tanto a referência do token (no `.txt`) quanto a string real (no `.yml` de cada idioma).
- Saída de localização: `mod/sagittarius-species/localisation/<lang>/name_lists/<fileName>_l_<lang>.yml`, gerada
  para cada idioma de `languages` em `scripts/vanilla-keys.json`. As pastas de destino são criadas quando
  necessário; sua existência não determina quais idiomas são gerados.
  - Arquivos `.yml` precisam ser UTF-8 **com BOM** (prefixo `﻿`) e têm largura máxima de 80 colunas conforme o
    `.editorconfig`.
- Saída de script: `mod/sagittarius-species/common/name_lists/<fileName>.txt` é composta uma vez por cultura.
  O snapshot exige `braz_por`, idioma fonte da verdade do projeto. A geração usa o snapshot e não exige o jogo instalado.
- **Validação (erro, não warning) antes de escrever qualquer arquivo**: `ship_names`/`ship_class_names` (exceto
  `generic`), `army_names` (exceto `generic`/`general`) e `planet_names` (exceto `generic`) precisam usar chaves
  que existam em `scripts/vanilla-keys.json` — um snapshot de `army`/`ship_size`/`planet_class` e `languages`
  extraído da instalação local do Stellaris via `bun scripts/extract-vanilla-keys.ts` (rode de novo manualmente
  quando o jogo receber patch relevante; a instalação vem de `STELLARIS_PATH` no `.env`, com override posicional opcional). Essa
  validação existe porque chaves inventadas (`android_defense_army`, `sponsored_coloniser`) não davam erro
  nenhum até o cwtools rodar — agora travam a geração.

## Composição e sincronização

`gerarNameList` compõe texto Clausewitz e localização em memória antes da escrita. Tokens derivam do caminho
completo, incluindo índices de listas: dois campos com texto igual continuam com tokens distintos. Colisões
de caminhos normalizados em maiúsculas são erros. Aspas, barras e quebras de linha recebem escaping na localização.

A validação também rejeita culturas com o mesmo identificador. Após escrever todas as culturas e o agregado de
espécies-flavor, `sync.ts` remove `ssm_*.txt` e `ssm_*_l_<idioma>.yml` de culturas excluídas, somente nas
pastas de name_lists. A limpeza percorre os idiomas existentes para alcançar saídas antigas, sem usá-los como
fonte dos idiomas a gerar. Arquivos fora desses padrões são preservados.

Atualize o snapshot com `bun run extract-vanilla [instalacao]`. `bun run validate` confere as fontes sem escrever saídas.

## `species_names` (botão de aleatório na criação de império)

`common/species_names/ssm_species_names.txt` é **um único arquivo agregado**, gerado a partir da chave
`species_names` de **todos** os JSONs de `assets/name_lists/` combinados, agrupado por `species_class` (`HUM =
{...}`, `MACHINE = {...}`, etc.) — é o que o jogo lê pra popular o botão de aleatório na tela de criação de
império. Cada entrada do array `species_names` de um JSON tem `key` (identificador único — validado globalmente
entre todos os JSONs, erro se colidir), `name`, `plural`, `home_planet`, `home_system` (todos literais, nunca
`l10n|`) e `species_class`.

`species_class` é **declarada em cada entrada**, e o valor é validado contra o vocabulário do jogo
(`SPECIES_CLASSES_VALIDAS`, a mesma lista que valida o `portrait.json`). Ela existe porque o jogo exige uma
classe válida como chave de agrupamento — uma chave inválida faz o parser desandar e derrubar o arquivo inteiro.

**Não existe vínculo entre espécie-flavor e retrato.** `species_names` não tem campo de portrait em lugar nenhum
do vanilla: ao gerar um império, o jogo sorteia a espécie-flavor e o retrato de forma independente, dentro da
classe. O único elo entre os dois é a `species_class` compartilhada — por isso a classe é declarada aqui em vez
de deduzida de um portrait (relato completo em `docs/history/2026-08-17-taxonomia-de-portraits.md`).

Pra gerar uma cultura nova (name_list + espécies-flavor) inteira via entrevista temática, veja a skill
`.claude/skills/gerar-name-list/SKILL.md` (`/gerar-name-list`).
