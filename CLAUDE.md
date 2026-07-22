# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Idioma

Converse e raciocine em português do Brasil neste repositório. Pense em português do Brasil (inclusive em texto
visível de raciocínio) e responda ao usuário em português do Brasil, mesmo que comandos, nomes de arquivos,
identificadores do mod (`ssm_`, `gsm_`) ou trechos de código permaneçam em inglês, já que é a língua do Stellaris
e do Clausewitz script.

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
bun run converter   # roda a conversão de portraits + rooms (processPortraits.ts && processRooms.ts)
bun run portrait     # bun scripts/processPortraits.ts — converte assets/portraits/**/*.png -> DDS
bun run rooms         # bun scripts/processRooms.ts — converte assets/city_sets/**/*.png -> DDS
bun run copy           # pwsh scripts/copy.ps1 — copia o mod para a pasta local de mods do Stellaris
bun run overwrite       # pwsh scripts/overwrite.ps1 — apaga e recopia o mod na pasta local de mods do Stellaris
```

- `copy`/`overwrite` são exclusivos de PowerShell (Windows) e operam sobre a pasta **modificada mais recentemente**
  dentro de `mod/`, copiando-a para `%USERPROFILE%\Documents\Paradox Interactive\Stellaris\mod\`. Existem
  equivalentes em bash (`scripts/copy-latest-to-local-mod.sh`, `scripts/overwrite-local-mod-with-latest.sh`) para
  uso fora do Windows.
- `scripts/name-lists.ts` e `scripts/txt-to-json.ts` são utilitários avulsos (sem entrada no package.json), rodados
  diretamente com `bun scripts/name-lists.ts`.
- Não existe suíte de testes automatizada. Validar uma mudança significa abrir o mod no Stellaris (via
  `copy`/`overwrite`) ou validar os arquivos de script com a extensão cwtools do VS Code (veja abaixo).

## Pipeline de conversão de texturas (requer Windows + NVIDIA Texture Tools)

`scripts/converter.ts` chama um **caminho local fixo (hardcoded)**:
`C:/Program Files/NVIDIA Corporation/NVIDIA Texture Tools/nvtt_export.exe`. Ele precisa estar instalado para que
`bun run portrait` / `bun run rooms` funcionem. O fluxo:

1. `scripts/utils.ts#listar` percorre `assets/portraits` ou `assets/city_sets` recursivamente atrás de arquivos
   `.png`.
2. `scripts/converter.ts#batchFile` escreve uma linha por arquivo em `batch.nvdds` (no gitignore) com o formato de
   destino e o caminho `--output` dentro de `output/`, espelhando a estrutura de pastas de `assets/`.
   - Portraits usam `bc3` (veja `processPortraits.ts`); texturas de rooms/city-sets usam `bc1` (veja
     `processRooms.ts`).
3. `converter()` chama `nvtt_export.exe --batch-file=batch.nvdds`, gerando os `.dds` dentro de `output/`.
4. **A movimentação de `output/` para `mod/sagittarius-species/gfx/...` é manual, não é automatizada por script** —
   incluindo renomear as pastas do prefixo `gsm_` usado em `assets/portraits/gsm_*` para o prefixo `ssm_` usado em
   `mod/sagittarius-species/gfx/models/portraits/ssm_*`. Não assuma que rodar os scripts de conversão sozinho já
   atualiza o mod publicado.

## Pipeline de listas de nomes / localização

`scripts/name-lists.ts` usa a biblioteca `jomini` para ir de uma única fonte JSON até o script Clausewitz e todos
os arquivos `.yml` de idioma:

- Fonte: `assets/name_lists/*.json` (ex.: `brazil.json`, `altmer.json`). Valores string com o prefixo `l10n|`
  (ex.: `"l10n|Some Name"`) são referências de localização; o script atribui um token a eles e emite tanto a
  referência do token (no `.txt` em Clausewitz) quanto a string real (no `.yml` de cada idioma).
- Saída de localização: `mod/sagittarius-species/localisation/<lang>/name_lists/<fileName>_l_<lang>.yml`, gerada
  para toda pasta de idioma já existente em `localisation/` (english, braz_por, french, german, japanese, korean,
  polish, russian, simp_chinese, spanish).
  - Arquivos `.yml` precisam ser UTF-8 **com BOM** (prefixo `﻿`) e têm largura máxima de 80 colunas conforme o
    `.editorconfig`.
- Saída de script: `mod/sagittarius-species/common/name_lists/<fileName>.txt` só é regenerado a partir da passada
  do locale `braz_por` (veja o trecho `if (loc === 'braz_por')`) — Português do Brasil é o idioma "fonte da
  verdade" deste repositório (veja o `README.md`, escrito para um público brasileiro).
- `scripts/txt-to-json.ts` faz o caminho inverso (Clausewitz `.txt` -> JSON), para inspeção pontual de arquivos em
  `testmod/`; não faz parte do pipeline regular.

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
   retrato macho/fêmea, referenciando texturas em `gfx/models/portraits/ssm_<species>/<gender>/NNN.dds`, além das
   regras de `portrait_groups` que definem qual retrato aparece em qual gênero/contexto.
5. **`gfx/models/portraits/ssm_<species>/{male,female}/NNN.dds`** — as texturas convertidas de fato (veja o
   pipeline acima).

Todos os identificadores dentro do mod usam o **prefixo `ssm_`** (Sagittarius Species Mod) para evitar colisão com
outros mods do Stellaris. As pastas de arte-fonte em `assets/portraits/` usam, em vez disso, o **prefixo `gsm_`**
— essa nomenclatura não é unificada automaticamente; a renomeação acontece no passo manual de cópia de `output/`
para `mod/`.

## Ferramental de script Paradox

- Arquivos `.txt`/`.gfx`/`.gui`/`.mod`/`.yml` são script Clausewitz/Jomini, não texto genérico — o
  `.vscode/settings.json` mapeia todos para o modo de linguagem `paradox` (extensão cwtools do VS Code), para
  destaque de sintaxe e lint.
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
