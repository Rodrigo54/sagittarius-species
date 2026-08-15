# Pipeline de listas de nomes / localização / species_names

`scripts/generate-names/` (comando `bun run names`, entrada em `index.ts`) usa a biblioteca `jomini` para ir de
uma única fonte JSON até o script Clausewitz, todos os `.yml` de idioma, e o arquivo agregado de espécies-flavor.
É uma pasta (não um arquivo único) porque passou de ~300 linhas: `types.ts` (tipos compartilhados),
`portrait-map.ts` (lê `species_class` a partir de portrait), `validation.ts` (chaves reservadas + regra de
`sequential_name`), `name-lists.ts` (geração de `.txt`/`.yml` por name_list) e `species-names.ts` (agregação de
`species_names.txt`). `scripts/extract-vanilla-keys.ts` é auxiliar, roda à parte (não faz parte do
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
  para toda pasta de idioma já existente em `localisation/` (english, braz_por, french, german, japanese,
  korean, polish, russian, simp_chinese, spanish).
  - Arquivos `.yml` precisam ser UTF-8 **com BOM** (prefixo `﻿`) e têm largura máxima de 80 colunas conforme o
    `.editorconfig`.
- Saída de script: `mod/sagittarius-species/common/name_lists/<fileName>.txt` só é regenerado a partir da
  passada do locale `braz_por` (veja o trecho `if (loc === 'braz_por')`) — Português do Brasil é o idioma
  "fonte da verdade" deste repositório (veja o `README.md`, escrito para um público brasileiro).
- **Validação (erro, não warning) antes de escrever qualquer arquivo**: `ship_names`/`ship_class_names` (exceto
  `generic`), `army_names` (exceto `generic`/`general`) e `planet_names` (exceto `generic`) precisam usar chaves
  que existam em `scripts/vanilla-keys.json` — um snapshot congelado de `army`/`ship_size`/`planet_class`
  extraído da instalação local do Stellaris via `bun scripts/extract-vanilla-keys.ts` (rode de novo manualmente
  só quando o jogo receber patch relevante; o caminho da instalação está hardcoded no topo do script). Essa
  validação existe porque chaves inventadas (`android_defense_army`, `sponsored_coloniser`) não davam erro
  nenhum até o cwtools rodar — agora travam a geração.

## `species_names` (botão de aleatório na criação de império)

`common/species_names/ssm_species_names.txt` é **um único arquivo agregado**, gerado a partir da chave
`species_names` de **todos** os JSONs de `assets/name_lists/` combinados, agrupado por `species_class` (`HUM =
{...}`, `MACHINE = {...}`, etc.) — é o que o jogo lê pra popular o botão de aleatório na tela de criação de
império. Cada entrada do array `species_names` de um JSON tem `key` (identificador único — validado globalmente
entre todos os JSONs, erro se colidir), `name`, `plural`, `home_planet`, `home_system` (todos literais, nunca
`l10n|`) e `portrait`.

`species_class` **não** é um campo manual normal: é derivado automaticamente do `portrait` via
`common/portrait_sets/ssm_portrait_sets.txt` (cada portrait pertence a uma `species_class`). Só é obrigatório
informar `species_class` explicitamente quando o `portrait` for ambíguo — hoje isso é `ssm_necron` (`HUM` ou
`NECROID`) e `ssm_green_elves` (`HUM` ou `PLANT`), os únicos dois que aparecem em mais de um `portrait_set`.

Pra gerar uma cultura nova (name_list + espécies-flavor) inteira via entrevista temática, veja a skill
`.claude/skills/gerar-name-list/SKILL.md` (`/gerar-name-list`).
