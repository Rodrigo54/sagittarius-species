# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Idioma

Converse e raciocine em português do Brasil neste repositório. Pense em português do Brasil (inclusive em texto
visível de raciocínio) e responda ao usuário em português do Brasil, mesmo que comandos, nomes de arquivos,
identificadores do mod (`ssm_`) ou trechos de código permaneçam em inglês, já que é a língua do Stellaris e do
Clausewitz script.

## O que é este projeto

Sagittarius Species é um mod para Stellaris (Paradox Interactive) que adiciona retratos de espécies gerados por IA
(15+ espécies: elfos, moluscos, avianos, ciborgues, necromantes, etc.). Este repositório é um pipeline de
conteúdo/assets, não uma aplicação — não existe um passo de build/test/lint no sentido tradicional. As duas coisas
que existem são:

1. **`mod/sagittarius-species/`** — o mod em si, no formato de script Clausewitz da Paradox (`.txt`, `.yml`, `.gfx`,
   `.mod`) mais texturas `.dds` comprimidas. É isso que o Stellaris carrega e o que é publicado no Steam Workshop.
   Fica versionado no git como está (é o "output do build", mas não está no gitignore, já que é o entregável).
2. **Scripts em Bun/TypeScript** (`scripts/`) que convertem a arte-fonte em `assets/` (`.psd`/`.png`) nas texturas
   `.dds` e nos arquivos `.txt`/`.yml` em Clausewitz que ficam dentro de `mod/sagittarius-species/`.

## Comandos

O runtime é o **Bun** (veja `bun.lockb`) — rode os scripts com `bun scripts/xxx.ts`, não `node`/`npm`.

```bash
bun run setup       # bun scripts/download-bin.ts — baixa os binários auxiliares em bin/ (veja seção abaixo)
bun run converter   # roda a conversão de portraits + rooms (processPortraits.ts && processRooms.ts)
bun run portrait     # bun scripts/processPortraits.ts — sincroniza assets/portraits/ com mod/ (DDS + .txt), direto no mod/
bun run rooms         # bun scripts/processRooms.ts — converte assets/city_sets/**/*.png -> DDS, direto no mod/
bun run names          # bun scripts/generate-names/index.ts — gera name_lists + species_names (veja seção abaixo)
bun run copy           # pwsh scripts/copy.ps1 — copia o mod para a pasta local de mods do Stellaris
bun run overwrite       # pwsh scripts/overwrite.ps1 — apaga e recopia o mod na pasta local de mods do Stellaris
```

- `copy`/`overwrite` são exclusivos de PowerShell (Windows) e operam sobre a pasta **modificada mais recentemente**
  dentro de `mod/`, copiando-a para `%USERPROFILE%\Documents\Paradox Interactive\Stellaris\mod\`. Existem
  equivalentes em bash (`scripts/copy-latest-to-local-mod.sh`, `scripts/overwrite-local-mod-with-latest.sh`) para
  uso fora do Windows.
- `scripts/txt-to-json.ts` é um utilitário avulso (sem entrada no package.json), rodado diretamente com
  `bun scripts/txt-to-json.ts`.
- Não existe suíte de testes automatizada. Validar uma mudança significa abrir o mod no Stellaris (via
  `copy`/`overwrite`) ou validar os arquivos de script com a extensão cwtools do VS Code (veja abaixo).

## Binários auxiliares (`bin/`)

`bin/` guarda ferramentas de linha de comando de terceiros usadas pelo projeto. A pasta **não é versionada**
(está no `.gitignore`) — rode `bun run setup` (`scripts/download-bin.ts`) pra baixá-las:

- **`bin/texconv/texconv.exe`** — [texconv](https://github.com/microsoft/DirectXTex) (Microsoft DirectXTex, MIT,
  código aberto). É o motor de conversão de texturas do pipeline (veja seção abaixo) — substituiu o
  `nvtt_export.exe`, que não é mais usado em lugar nenhum do repositório.
- **`bin/imagemagick/magick.exe`** (+ DLLs e arquivos de suporte) — [ImageMagick](https://imagemagick.org)
  portátil, pra manipulação de imagem via linha de comando (resize, crop, conversão de formato, composição) sem
  depender do Photoshop. Não está ligado a nenhum script ainda; uso manual/ad-hoc por enquanto.

Detalhes de `scripts/download-bin.ts`:

- As versões de cada ferramenta ficam **fixadas manualmente** no array `FERRAMENTAS` do próprio script (não busca
  "latest" automaticamente) — pra manter o pipeline reprodutível. Pra atualizar uma ferramenta, mude a `versao` e
  a `url` dessa entrada.
- O layout é **uma subpasta por ferramenta** dentro de `bin/`.
- É **idempotente**: cada subpasta tem um arquivo `.version` gravado após a instalação; rodar `bun run setup` de
  novo só baixa o que estiver faltando ou com a versão pinada diferente da instalada.
- O ImageMagick só é distribuído como `.7z` (sem `.zip` portátil oficial) — a extração usa `7zip-bin` + `node-7z`
  (devDependencies), que empacotam um `7za` portátil, sem exigir 7-Zip instalado no sistema.

## Pipeline de conversão de texturas (requer Windows, já que o texconv é baseado em DirectX)

`scripts/converter.ts` usa o `texconv` (`bin/texconv/texconv.exe`, baixado por `bun run setup` — veja seção
acima) para converter PNG em DDS, e escreve **direto dentro de `mod/sagittarius-species/gfx/...`** — não existe
mais pasta `output/` intermediária nem passo manual de mover/renomear arquivos. `converter.ts` é só o utilitário
de baixo nível compartilhado: agrupa os arquivos recebidos pela pasta de destino (trocando a raiz `pastaOrigem`
por `pastaDestino`, preservando a subestrutura de pastas), cria cada pasta de destino que ainda não existir, e
roda o `texconv` uma vez por pasta (só aceita um único diretório de saída `-o` por invocação). `noMips: true`
vira `-m 1`; a saída é sempre forçada para `-ft dds -y` (overwrite). Se uma pasta falhar na conversão, o processo
para imediatamente (fail-fast).

Os dois pipelines que usam esse utilitário têm responsabilidades bem separadas:

- **`bun run rooms`** (`processRooms.ts`) é simples: só chama `converter()` com formato `bc1` → `BC1_UNORM`,
  escrevendo em `mod/sagittarius-species/gfx/portraits/city_sets/`. Não apaga nada, não gera nenhum `.txt` —
  `gfx/portraits/asset_selectors/ssm_room_textures.txt` continua **mantido manualmente** (a maior parte desse
  arquivo é lógica de trigger de gameplay sem relação nenhuma com os arquivos de `assets/city_sets/`, então não
  faz sentido gerá-lo automaticamente).
- **`bun run portrait`** (`processPortraits.ts`, que só delega para `scripts/generate-portraits/`) usa formato
  `bc3` → `BC3_UNORM` e faz bem mais que converter imagem — veja a seção seguinte.

Só as variantes lineares/UNORM são usadas (nunca as sRGB), porque o Stellaris não suporta essas últimas
(ver `image.md`).

### Pipeline de portraits: `assets/portraits/` → `mod/` sempre em sincronia

`scripts/generate-portraits/` (chamado por `processPortraits.ts`) mantém tanto as texturas quanto o
`ssm_<espécie>_portrait.txt` de cada espécie sempre espelhando exatamente o que existe em
`assets/portraits/ssm_<espécie>/`, toda vez que `bun run portrait` roda:

1. Cada pasta `assets/portraits/ssm_<espécie>/` tem um **`portrait.json` obrigatório**:
   `{ "name": "<espécie sem prefixo>", "gendered": boolean, "counts": { "male"?, "female"?, "flat"? } }`. Espécies
   `gendered: true` têm subpastas `male/`/`female/`; `gendered: false` são "flat" (PNGs `NNN.png` direto na raiz
   da pasta da espécie, ex.: `ssm_cyborg`, `ssm_new_order`). O arquivo é a fonte de verdade declarada — não é
   inferido a partir da contagem real de arquivos.
2. **Validação antes de qualquer escrita ou remoção** (mesmo padrão de `scripts/generate-names/`): confere que
   `name` bate com o nome da pasta, que a contagem declarada em `counts` bate exatamente com os PNGs encontrados,
   e que os arquivos são `001.png`..`NNN.png` sequenciais e zero-padded a 3 dígitos, sem buracos. Qualquer
   divergência é erro — nada é escrito nem apagado se houver um erro em qualquer espécie.
3. Só depois de validado tudo: para cada espécie, qualquer `.dds` já existente em
   `mod/sagittarius-species/gfx/models/portraits/ssm_<espécie>/` que não corresponda a um PNG de origem é
   **apagado** (limpeza total, sem exceção — histórico: essa decisão já removeu deliberadamente texturas órfãs
   sem PNG de origem que estavam publicadas, como `ssm_cyborg/013.dds`). Depois disso, os PNGs são convertidos via
   `converter.ts`, e o `ssm_<espécie>_portrait.txt` inteiro é regenerado a partir do zero.
4. O template do `.txt` gerado é 100% derivado da forma da pasta (`gendered` vs. flat) e da contagem de arquivos —
   `entity`, `clothes_selector`, `attachment_selector` e `custom_attachment_label` são sempre os mesmos valores
   constantes em toda espécie hoje; `greeting_sound` varia só por gênero (`human_male_greetings_01` /
   `human_female_greetings_01`, sempre macho pras espécies flat); cada espécie tem sempre um único grupo de
   retrato por gênero (sufixo `_01`); o bloco `portrait_groups` segue o boilerplate padrão (`game_setup`,
   `species`, `pop`, `leader`, `ruler`) idêntico ao que já existia manualmente.

## Pipeline de listas de nomes / localização / species_names

`scripts/generate-names/` (comando `bun run names`, entrada em `index.ts`) usa a biblioteca `jomini` para ir de uma
única fonte JSON até o script Clausewitz, todos os `.yml` de idioma, e o arquivo agregado de espécies-flavor. É uma
pasta (não um arquivo único) porque passou de ~300 linhas: `types.ts` (tipos compartilhados), `portrait-map.ts`
(lê `species_class` a partir de portrait), `validation.ts` (chaves reservadas + regra de `sequential_name`),
`name-lists.ts` (geração de `.txt`/`.yml` por name_list) e `species-names.ts` (agregação de `species_names.txt`).
`scripts/extract-vanilla-keys.ts` é auxiliar, roda à parte (não faz parte do `bun run names`).

- Fonte: `assets/name_lists/*.json` (ex.: `brazil.json`, `altmer.json`). Cada arquivo tem três blocos de nível
  raiz: `name`/`desc` (metadados do name_list), `ssm_<id>` (o corpo do name_list em si — `ship_names`,
  `army_names`, `character_names`, etc.) e `species_names` (array plano de espécies-flavor que usam esse
  name_list — ver seção abaixo). `species_names` é **irmão** de `ssm_<id>`, nunca aninhado dentro — o `.txt` do
  name_list não aceita essa chave no schema do jogo.
- **Regra de localização do projeto: literal por padrão.** Valores string normais (nomes de nave, personagem,
  planeta) são strings literais, sem prefixo — funcionam em jogo sem tradução por idioma, e é assim que a
  esmagadora maioria do conteúdo do mod já é escrita. O prefixo `l10n|` (ex.: `"l10n|$ORD$ Guarda Nacional"`) é
  reservado **só** para `sequential_name` (campos com placeholder `$ORD$`/`$O$`/`$C$`/`$R$`/`$HEX$`) — é requisito
  funcional do próprio jogo desde o patch 3.6 (sequential_name só templetiza via localisation, uma string literal
  falha silenciosamente), não uma escolha de estilo. Quando usado, o script atribui um token e emite tanto a
  referência do token (no `.txt`) quanto a string real (no `.yml` de cada idioma).
- Saída de localização: `mod/sagittarius-species/localisation/<lang>/name_lists/<fileName>_l_<lang>.yml`, gerada
  para toda pasta de idioma já existente em `localisation/` (english, braz_por, french, german, japanese, korean,
  polish, russian, simp_chinese, spanish).
  - Arquivos `.yml` precisam ser UTF-8 **com BOM** (prefixo `﻿`) e têm largura máxima de 80 colunas conforme o
    `.editorconfig`.
- Saída de script: `mod/sagittarius-species/common/name_lists/<fileName>.txt` só é regenerado a partir da passada
  do locale `braz_por` (veja o trecho `if (loc === 'braz_por')`) — Português do Brasil é o idioma "fonte da
  verdade" deste repositório (veja o `README.md`, escrito para um público brasileiro).
- **Validação (erro, não warning) antes de escrever qualquer arquivo**: `ship_names`/`ship_class_names` (exceto
  `generic`), `army_names` (exceto `generic`/`general`) e `planet_names` (exceto `generic`) precisam usar chaves
  que existam em `scripts/vanilla-keys.json` — um snapshot congelado de `army`/`ship_size`/`planet_class` extraído
  da instalação local do Stellaris via `bun scripts/extract-vanilla-keys.ts` (rode de novo manualmente só quando o
  jogo receber patch relevante; o caminho da instalação está hardcoded no topo do script). Essa validação existe
  porque chaves inventadas (`android_defense_army`, `sponsored_coloniser`) não davam erro nenhum até o cwtools
  rodar — agora travam a geração.
- `scripts/txt-to-json.ts` faz o caminho inverso (Clausewitz `.txt` -> JSON), para inspeção pontual de arquivos em
  `testmod/`; não faz parte do pipeline regular.

### `species_names` (botão de aleatório na criação de império)

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

## Modelo de dados: como um retrato de espécie é conectado

O sistema de espécies/retratos da Paradox é uma cadeia de arquivos que se referenciam entre si; para adicionar ou
modificar uma espécie, geralmente é preciso mexer em todos estes, dentro de `mod/sagittarius-species/`:

1. **`common/species_classes/ssm_species_classes.txt`** — arquétipos de espécies jogáveis de nível mais alto
   (`ssm_sagittarius` = biológico, `ssm_presapient`, `ssm_robot` = machine). Cada um lista quais entradas de
   retrato (pelo nome, ex.: `"ssm_elves"`) pertencem àquele arquétipo.
2. **`common/portrait_categories/ssm_portrait_categories.txt`** — mapeia uma categoria (ex.: `sagittarius`,
   `humanoids`, `machines`) para os grupos de `portrait_sets` dos quais ela puxa.
3. **`common/portrait_sets/ssm_portrait_sets.txt`** — mapeia uma `species_class` (`HUM`, `MAM`, `MOL`, `AVI`,
   `MACHINE`, ...) para as entradas de retrato individuais (ex.: `ssm_elves`, `ssm_cyborg`) que estão dentro dela.
4. **`gfx/portraits/portraits/ssm_<species>_portrait.txt`** (um arquivo por espécie) — define as entidades de
   retrato (macho/fêmea, ou uma única entidade "flat" pras espécies sem separação de gênero), referenciando
   texturas em `gfx/models/portraits/ssm_<species>/...`, além das regras de `portrait_groups` que definem qual
   retrato aparece em qual gênero/contexto. **Gerado automaticamente** por `scripts/generate-portraits/` a partir
   do `portrait.json` e dos PNGs de `assets/portraits/ssm_<species>/` — não edite esse `.txt` manualmente, edite o
   `portrait.json` e/ou os PNGs de origem e rode `bun run portrait` de novo.
5. **`gfx/models/portraits/ssm_<species>/{male,female}/NNN.dds`** (espécies `gendered: true`) ou
   **`gfx/models/portraits/ssm_<species>/NNN.dds`** (espécies "flat", `gendered: false`) — as texturas convertidas
   de fato (veja o pipeline acima).

Todos os identificadores dentro do mod, **incluindo as pastas de arte-fonte em `assets/portraits/`**, usam o
prefixo `ssm_` (Sagittarius Species Mod) para evitar colisão com outros mods do Stellaris — o prefixo antigo
`gsm_` foi descontinuado e todas as pastas de espécie já foram renomeadas para `ssm_`, eliminando a troca manual
de prefixo que existia antes entre arte-fonte e mod publicado.

## Ferramental de script Paradox

- Arquivos `.txt`/`.gfx`/`.gui`/`.mod`/`.yml` são script Clausewitz/Jomini, não texto genérico — o
  `.vscode/settings.json` mapeia todos para o modo de linguagem `paradox` (extensão cwtools do VS Code), para
  destaque de sintaxe e lint.
- Para que a extensão cwtools **valide de verdade** o conteúdo dentro de `mod/sagittarius-species/`, abra o
  workspace **`sagittarius-species.code-workspace`** (na raiz do repo) em vez da pasta crua — a extensão exige que
  a pasta aberta no VS Code seja a raiz do mod, e aqui ela fica numa subpasta. Veja `cwtools.md` para o porquê
  completo da configuração (workspace multi-root, `.cwtools/` gerado automaticamente dentro da pasta do mod,
  configurações de `cwtools.*` no bloco `settings` do `.code-workspace`).
- `.cwtools/` é um conjunto de definições de regras **vendorizado**, consumido pela extensão/linter cwtools —
  trate como material de referência somente leitura, não algo para editar manualmente ao implementar features.
- `.editorconfig`: arquivos `.yml` são `utf-8-bom`, largura máxima de 80 colunas; `.txt`/`.gfx`/`.mod`/`.json`
  usam indentação de 2 espaços.

## Metadados de release

A versão é rastreada de forma independente em três lugares e precisa ser mantida em sincronia manualmente ao
cortar uma release: `package.json` (`version`), `mod/sagittarius-species/descriptor.mod` (`version`, além de
`supported_version` para a versão compatível do jogo Stellaris) e o badge de versão no `README.md`. O texto da
listagem no Steam Workshop fica em `steam-workshop/description.md` e `steam-workshop/change-notes.md`; o
`remote_file_id` do `descriptor.mod` é o ID do item no Steam Workshop usado para publicação.
