# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Idioma

Converse e raciocine em português do Brasil neste repositório. Pense em português do Brasil (inclusive em texto
visível de raciocínio) e responda ao usuário em português do Brasil, mesmo que comandos, nomes de arquivos,
identificadores do mod (`ssm_`) ou trechos de código permaneçam em inglês, já que é a língua do Stellaris e do
Clausewitz script.

## O que é este projeto

Sagittarius Species é um mod para Stellaris (Paradox Interactive) que adiciona retratos de espécies gerados por IA
(19 espécies: elfos, moluscos, avianos, ciborgues, necromantes, etc.). Este repositório é um pipeline de
conteúdo/assets, não uma aplicação — os comandos de verificação cobrem tipos, testes de lógica e validação das fontes, sem executar o jogo. As duas coisas
que existem são:

1. **`mod/sagittarius-species/`** — o mod em si, no formato de script Clausewitz da Paradox (`.txt`, `.yml`, `.gfx`,
   `.mod`) mais texturas `.dds` comprimidas. É isso que o Stellaris carrega e o que é publicado no Steam Workshop.
   Fica versionado no git como está (é o "output do build", mas não está no gitignore, já que é o entregável).
2. **Scripts em Bun/TypeScript** (`scripts/`) que convertem a arte-fonte em `assets/` (`.psd`/`.png`) nas texturas
   `.dds` e nos arquivos `.txt`/`.yml` em Clausewitz que ficam dentro de `mod/sagittarius-species/`.

## Documentação

A documentação deste repositório é dividida por tempo verbal, e a divisão é obrigatória:

- **`docs/` e os comentários no código descrevem o que existe hoje.** Estado atual, no presente. Nada de "antes
  era X, agora é Y", "isto substituiu Y" ou "removemos Z" — a explicação de uma coisa não deve depender de
  conhecer a coisa que ela substituiu.
- **`docs/history/` guarda o passado**: o relato datado de sessões, decisões e scripts descartados, um arquivo
  por assunto, no formato `YYYY-MM-DD-<assunto>.md`. É onde vive o "por que mudou", incluindo os caminhos que
  não deram certo.

**Mudança enorme atualiza suas docs em `docs/` *e* registra um novo arquivo em `docs/history/` com os motivos
que levaram à mudança.** Um sem o outro deixa a documentação mentindo (se só o history for escrito) ou apaga a
razão de ser da decisão (se só o `docs/` for atualizado).

Enorme é o que muda como o projeto funciona ou por quê: um pipeline novo, a troca de um formato ou de uma
ferramenta, uma regra do enquadramento, uma decisão de conteúdo que valha explicar depois. **Todo o resto não
pede nada disso** — corrigir um typo, ajustar um valor, adicionar uma variante, renomear um arquivo. O teste é
esse: se daqui a seis meses alguém for olhar o resultado e perguntar "por que está assim?", escreva o history;
se a resposta estiver óbvia no próprio arquivo, não escreva. Na dúvida, a mensagem de commit já é registro
suficiente.

## Comandos

O runtime é o **Bun** (veja `bun.lockb`) — rode os scripts com `bun scripts/xxx.ts`, não `node`/`npm`.

```bash
bun run setup       # bun scripts/download-bin.ts — baixa os binários auxiliares em bin/ (veja seção abaixo)
bun run hooks       # bun scripts/install-git-hooks.ts — copia scripts/git-hooks/ para .git/hooks/ (roda sozinho no `bun install`, via `prepare`)
bun run converter   # roda a conversão de portraits + rooms (bun run portrait && bun run rooms)
bun run portrait     # bun scripts/generate-portraits/index.ts — sincroniza assets/portraits/ com mod/ (DDS + .txt), direto no mod/; aceita um slug opcional (ex.: `bun run portrait ssm_elves`) pra processar uma espécie só. Sempre regenera também o registro (portrait_sets/portrait_categories), do mod inteiro, mesmo sob filtro
bun run taxonomy     # bun scripts/generate-taxonomy/index.ts — regenera só o registro em common/ (portrait_sets + portrait_categories) a partir da filiação declarada nos portrait.json (veja seção abaixo)
bun run shared-rig   # bun scripts/generate-shared-rig/index.ts — deriva gfx/.../ssm_shared/ a partir de sl_shared/ (veja seção "Rig compartilhado")
bun run rooms         # bun scripts/generate-rooms/index.ts — sincroniza assets/city_sets/ com mod/ (DDS + .txt), direto no mod/
bun run names          # bun scripts/generate-names/index.ts — gera name_lists + species_names (veja seção abaixo)
bun run art   # bun scripts/generate-art/index.ts <slug> <male|female|genderless> [-n NNN,...] [-s [N]] [-p] [-e] — gera retratos via IA no ComfyUI local; `-s` sempre grava a seed no portrait.json (valor fixa, sem valor sorteia, `default` volta pra determinística e apaga a chave) (veja seção abaixo)
bun run promo          # bun scripts/generate-promo/index.ts [slug] — gera assets/promo/ssm_<espécie>.png a partir de species-promo.json; aceita um slug opcional pra processar uma espécie só (veja seção abaixo)
bun run copy           # pwsh scripts/copy.ps1 — sincroniza o mod na pasta local de mods do Stellaris (apaga e recopia, reportando a variação de tamanho)
bun run publish-workshop -- [-m|--metadata-only]   # bun scripts/publish-workshop/index.ts — publica no Steam Workshop via steamcmd (veja seção "Publicação no Steam Workshop")
```

- `copy` é exclusivo de PowerShell (Windows, usa `robocopy`) e opera sobre `mod/sagittarius-species`, apagando e
  recopiando a pasta de mesmo nome dentro de `Documents\Paradox Interactive\Stellaris\mod\` (o caminho de
  `Documents` vem de `[Environment]::GetFolderPath('MyDocuments')`, não de `%USERPROFILE%`, pra acompanhar
  redirecionamento de pasta conhecida). Roda com `-NoProfile`: sem isso o `pwsh` carrega o perfil do usuário
  antes do script, e um `Clear-Host` lá dentro apaga o scrollback do terminal que chamou.
- Trocar o rig de uma espécie é editar o campo `rig` do `portrait.json` e rodar `bun run portrait` — o
  enquadramento é derivado a cada execução (veja "Pipeline de portraits" abaixo).
- **Ferramental de enquadramento** (sem entrada no package.json, rodados direto). Existem porque o corte superior
  do quadro de retrato era estimado a olho em screenshots, e esse número define o teto permanente da composição
  de toda arte futura — veja "Enquadramento" em `docs/rig.md`:
  - `scripts/measure-framing/index.ts` — deriva dos `.gui` do Stellaris a janela visível do retrato em cada
    contexto de UI (122 contextos), gravando `contextos.json`. **Se revalida sozinho** a cada patch da Paradox:
    é só rodar de novo. A instalação vem de `STELLARIS_PATH` no `.env` (aceita override por argumento).
  - `scripts/measure-framing/medir-prints.ts` — lê screenshots com a arte de calibração instalada e mede a
    relação entre coordenadas do sprite e do canvas. É a única etapa que exige o jogo aberto; o resultado está
    congelado em `ancora.json`.
  - `scripts/measure-framing/densidade-da-arte.ts` — diagnostica, por espécie, onde a silhueta da arte fica
    sólida, ou seja quanto há de chifre/antena/penacho acima da cabeça. É o que aponta as candidatas a
    `"ancora": "cabeca"`; a decisão em si é visual, espécie a espécie.
  - `scripts/generate-calibration/index.ts` — gera a arte de calibração legível por máquina (a coordenada está
    codificada na cor de cada faixa). Duas imagens, uma por eixo.
  - `scripts/install-calibration/index.ts` — instala essa arte por cima das texturas do `mod/` nas 17 espécies e
    imprime o roteiro de captura. **Destrutivo no `mod/` por construção** (é instrumento, não conteúdo);
    `bun run portrait` desfaz.
- Não existe suíte de testes automatizada de correção *in-game* — validar uma mudança de conteúdo/script Clausewitz
  significa abrir o mod no Stellaris (via `copy`/`overwrite`) ou validar os arquivos com a extensão cwtools do VS
  Code (veja abaixo). Lógica determinística e crítica (ex.: o patch binário do `.mesh` em
  `scripts/generate-shared-rig/mesh-uv.ts`) tem teste Bun (`*.test.ts`, rodável com `bun test`) — não é uma suíte
  cobrindo o repositório inteiro, só os pontos onde um bug é caro/silencioso o bastante pra valer o teste.

### Padrão: pipelines geradores vivem em `scripts/generate-<algo>/`, sem wrapper

Todo pipeline que gera/sincroniza conteúdo em `mod/` (portraits, rooms, name_lists) segue a mesma estrutura,
independente do tamanho: o código mora em `scripts/generate-<algo>/` (uma pasta, dividida em arquivos por
responsabilidade quando cresce — veja `generate-names/` e `generate-portraits/` como referência; um pipeline
pequeno, como `generate-rooms/`, ainda ganha a pasta inteira mesmo cabendo em poucos arquivos curtos, por
consistência), e o `index.ts` dessa pasta **é** o ponto de entrada executável: define um `async function main()`
com toda a orquestração (listar → validar tudo antes de escrever/apagar qualquer coisa →
preparar/converter → escrever ou promover → limpar órfãos) e chama `main()` na última linha do arquivo. **Não existe wrapper `processX.ts`** em
`scripts/` só para chamar a pasta — isso já foi tentado (`processPortraits.ts`, `processRooms.ts`) e removido por
ser indireção sem propósito. O `package.json` aponta direto pro entry point: `"portrait": "bun
scripts/generate-portraits/index.ts"`. Ao criar um pipeline novo, siga esse mesmo formato desde o início.

Caminhos, catálogo de espécies, vocabulário do jogo e operações de arquivos compartilhados moram em `scripts/shared/` (ver `docs/estrutura-scripts.md`). Helpers de numeração e listagem moram em `scripts/utils.ts` — hoje a numeração zero-padded a 3 dígitos
(`pad`, `nomesNumerados`) e a ordenação numérica de arquivos (`ordenarNumericamente`), que portraits e rooms
compartilham. Helper usado por um pipeline só continua dentro da pasta dele.

## Binários auxiliares (`bin/`)

`bin/` guarda ferramentas de terceiros usadas pelo pipeline (não versionada, está no `.gitignore` — baixe com
`bun run setup`): **texconv** (motor de conversão PNG→DDS), **ImageMagick** (motor de imagem do enquadramento
de portraits) e **steamcmd** (publicação no Steam Workshop — veja "Publicação no Steam Workshop" abaixo).
`texconv`/`imagemagick` têm versão fixada manualmente por reprodutibilidade, instalação idempotente por
comparação de versão (arquivo `.version` por subpasta). `steamcmd` é diferente: é um bootstrapper que se
auto-atualiza sozinho a cada execução, então não tem versão fixável — a instalação só verifica se o executável
já existe e, nesse caso, nunca reinstala por cima (a pasta também guarda a sessão de login cacheada depois do
primeiro uso). Detalhes completos (layout de `download-bin.ts`, por que o ImageMagick precisa de `7zip-bin`):
`docs/pipeline-texturas.md`.

## Pipeline de conversão de texturas

`scripts/converter.ts` converte PNG em DDS via texconv no destino informado pelo pipeline.
Rooms escreve no mod em BC1_UNORM; portraits prepara em `.portrait-staging/mod/` em BC3_UNORM e promove
após conferir o lote. A limpeza de órfãos ocorre depois da escrita bem-sucedida. Consulte
`docs/pipeline-texturas.md` ao mudar formatos, conversão ou o pipeline de rooms.

## Pipeline de portraits

`bun run portrait [especie]` valida fontes e taxonomia, prepara PNGs em `.portrait-staging/png/` e DDS/scripts
em `.portrait-staging/mod/`, confere o lote e promove automaticamente para `mod/`. A taxonomia sempre abrange
todas as espécies. O estágio de preparação preserva o mod; a cópia final pode falhar parcialmente, com recuperação
pelo Git. O staging fica ignorado pelo Git.

A execução filtrada limpa somente excedentes dos gêneros declarados da espécie selecionada. A execução completa
também remove saídas de espécies e gêneros excluídos. Rigs e arquivos fora dos padrões gerados são preservados.
`shared/species.ts` lê o catálogo e valida cada `portrait.json`; `generate-portraits` cuida do enquadramento.
Consulte `docs/pipeline-portraits.md` para contratos dos rigs, composição, promoção e limpeza.

## Pipeline de taxonomia (registro em `common/`)

`scripts/generate-taxonomy/` (comando `bun run taxonomy`, também chamado no fim de `bun run portrait`) gera do
zero `common/portrait_sets/ssm_portrait_sets.txt` e `common/portrait_categories/ssm_portrait_categories.txt` a
partir de dois campos que cada `portrait.json` declara: **`species_classes`** (as classes que a espécie pode
ter, em ordem de preferência) e **`categories`** (as abas do editor de império onde ela aparece). O set não é
declarado em lugar nenhum — é derivado do agrupamento `(species_class × categorias)`, e o gate de DLC vem de
uma tabela por classe no script, nunca do JSON.

O mod **não tem `species_classes` próprias**: o campo `portraits` dentro de um bloco `species_class` é rejeitado
pelo parser do jogo (`Unexpected token: portraits` no `error.log`), e `PSIONIC`/`CYBERNETIC` existem só para o
ship set (`randomized = { always = no }`), então usá-las tiraria a espécie do sorteio de impérios de IA. Ordem
de preferência, fallback por DLC (com as duas regras de UI que o moldam: `playable` falso acinzenta em vez de
esconder, e o jogo deduplica por aba pela primeira ocorrência) e os dois tipos de categoria:
`docs/pipeline-taxonomy.md`; o porquê de tudo isso: `docs/history/2026-08-17-taxonomia-de-portraits.md`.

### Rig compartilhado (`sl_shared` / `ssm_shared`) e enquadramento

Toda espécie reaproveita um rig (mesh + animações) compartilhado em vez de ter um próprio.
**`sl_shared/`** é o legado herdado do extinto Stellar Legion Mod — **nenhuma espécie o usa hoje**, mas ele
continua versionado por dois motivos: é a **fonte de derivação** do `ssm_shared` (`bun run shared-rig` lê o
mesh dele) e é a única cópia restante desse mesh/animação, já que o mod de origem não existe mais.
**`ssm_shared/`** é o fork **derivado** (`bun run shared-rig`, sempre regenerado do zero a partir de
`sl_shared/`, nunca editado à mão) com o mesh reduzido a um único plano (`pPlaneShape4`), UV remapeada pro
canvas inteiro e recortado no topo — canvas **980×780** (isotrópico), usado por **todas as 19 espécies** e
ponto de partida pra espécies novas.
Trocar o rig de uma espécie é só editar `rig` no `portrait.json` e rodar `bun run portrait`, sem passo de
migração.

O enquadramento em si (qual pedaço do canvas de textura a câmera de retrato mostra) é **declarado nos `.gui`
do jogo**, não uma câmera opaca — `scripts/measure-framing/index.ts` deriva isso pros **122 contextos** de UI e
se revalida sozinho a cada patch da Paradox; só a relação sprite↔canvas exigiu medir in-game uma vez
(`y_canvas ≈ 199` é o topo do sprite no canvas antigo de 976 — a faixa acima nunca chega à tela).

Anatomia completa do formato binário pdxasset, derivação do enquadramento, rationale de `"ancora": "cabeca"`
(com candidatas por espécie) e ferramental Blender/`io_pdx_mesh`: `docs/rig.md`. Clipes herdados e guia pra
construir um rig de retrato animado do zero: `docs/rig-animacoes.md`.

## Pipeline de geração de arte via IA (`bun run art`)

Caminho **alternativo/opt-in** pra produzir os PNGs de origem que `bun run portrait` consome: gera via IA
(ComfyUI local, modelo **Flux.2 Klein**) a partir de uma receita `geracaoArt` no `portrait.json`. Ausente na
maioria das espécies hoje; presente em `ssm_default`, `ssm_astral` e `ssm_mermaids`.

**Quem roda `bun run art` (ou qualquer variante futura) é sempre o Rodrigo, nunca o Claude por conta
própria** — geração de imagem consome GPU local por vários segundos a minutos por variante, e rodar sem avisar
pode travar a máquina no meio de outra coisa. Claude pode editar `portrait.json`/prompts/pipeline, rodar
`--export-prompt` (não toca a GPU) e validações pontuais já combinadas explicitamente na conversa — mas
enfileirar geração de verdade no ComfyUI é decisão do Rodrigo, executada por ele.

Um schema `zod` único (`scripts/portrait-schema/`) valida o `portrait.json` **inteiro** (`.strict()` — chave
desconhecida é erro), usado tanto por `generate-portraits` quanto por `generate-art`. Os prompts (positivo e
negativo) são compostos inteiramente em TypeScript a partir de `geracaoArt` + `base.json`
(`scripts/generate-art/prompt-builder.ts`), sem depender de nenhum custom node externo do ComfyUI. Skill
dedicada pra preencher/ajustar `geracaoArt` de uma espécie via entrevista: `.claude/skills/gerar-art-portrait/`
(`/gerar-art-portrait`).

Este pipeline (Flux.2 Klein) substituiu de vez um pipeline anterior baseado em SDXL clássico (checkpoint/LoRA/
ControlNet OpenPose/img2img), apagado do repositório — relato completo de como o pipeline original foi criado
e depois evoluído: `docs/history/2026-07-28-generate-art-v1.md` e
`docs/history/2026-08-08-generate-art-schema-proprio.md`.

Peças completas do pipeline (schema, `base.json`, `prompt-builder.ts`, templates do workflow ComfyUI,
precedência de seed), setup do ComfyUI local (modelos instalados, pastas, gotchas) e a receita pra instalar um
modelo novo: `docs/pipeline-generate-art.md`.

## Pipeline de imagens promocionais (`bun run promo`)

`scripts/generate-promo/` compõe imagens JPEG 1920×1080 em `assets/promo/`, usando retratos e fundos existentes.
Playwright/Edge renderiza HTML/CSS; ImageMagick mede os recortes. `assets/promo/species-promo.json` declara nome,
lore, três variantes explícitas e overrides de fundo/escalas. `generate-promo/paths.ts` reúne caminhos desse pipeline.
Consulte `docs/pipeline-promo.md` ao alterar composição, fontes, grade, seleção de arte ou formato de saída.

## Pipeline de listas de nomes / localização / species_names

`scripts/generate-names/` (comando `bun run names`) vai de uma única fonte JSON (`assets/name_lists/*.json`)
até o script Clausewitz, todos os `.yml` de idioma, e o arquivo agregado de espécies-flavor
(`ssm_species_names.txt`, agrupado por `species_class`, declarada em cada entrada — o que popula o botão de
aleatório na criação de império; não há vínculo entre espécie-flavor e retrato, o jogo sorteia os dois de forma
independente dentro da classe). A forma do JSON de origem é validada por um schema `zod` próprio
(`scripts/name-list-schema/`, mesmo desenho do `portrait-schema/`). **Regra de localização do projeto: literal
por padrão** — strings normais não têm prefixo; o prefixo
`l10n|` é reservado só pra `sequential_name` (requisito funcional do jogo desde o patch 3.6). Português do
Brasil (`braz_por`) é o idioma "fonte da verdade" deste repositório — o snapshot exige esse locale; o `.txt` é composto uma única vez, independentemente do loop de idiomas. Validação (erro, não warning) trava a geração se `ship_names`/`army_names`/`planet_names`
usarem uma chave que não existe no vanilla (`scripts/vanilla-keys.json`).

Detalhes completos (estrutura dos JSONs, saída de localização, `species_names`) e a skill pra gerar uma cultura
nova via entrevista temática (`/gerar-name-list`): `docs/pipeline-nomes.md`.

Os idiomas são extraídos da instalação por `bun run extract-vanilla` e persistidos em
`scripts/vanilla-keys.json`. A instalação vem de `STELLARIS_PATH` no `.env`; `names` usa somente o snapshot.
Tokens são identificados pelo caminho da propriedade e strings de localização recebem escaping.
Após gerar todas as saídas, `names` remove os arquivos gerados de culturas excluídas.

## Verificação dos scripts e fontes

- `bun run check`: tipos sem emissão.
- `bun test` / `bun run test`: testes de lógica e arquivos temporários.
- `bun run check:schemas`: confere JSON Schemas derivados sem reescrevê-los.
- `bun run validate [especie]`: valida dados, referências e requisitos de imagens sem geração, navegador ou GPU.
  O filtro restringe retratos/arte/promoção; taxonomia e consistência dos schemas continuam globais.

Consulte `docs/estrutura-scripts.md` ao criar módulos compartilhados ou mudar esses comandos.

## Ferramental de script Paradox

Arquivos `.txt`/`.gfx`/`.gui`/`.mod`/`.yml` são script Clausewitz/Jomini (modo `paradox` no VS Code). Pra a
extensão cwtools **validar de verdade** `mod/sagittarius-species/`, abra o workspace
`sagittarius-species.code-workspace` (multi-root) em vez da pasta crua — a extensão exige que a pasta aberta
seja a raiz do mod, e aqui ela fica numa subpasta. `.cwtools/` é vendorizado (só leitura, não editar
manualmente). `.editorconfig`: `.yml` é `utf-8-bom`, 80 colunas; `.txt`/`.gfx`/`.mod`/`.json` usam indentação
de 2 espaços. Rationale completo da configuração do workspace (por que multi-root, onde fica o cache de regras,
por que as configs ficam no `.code-workspace`): `docs/cwtools.md`.

## Convenção de commits

Mensagem de commit segue Conventional Commits **com emoji obrigatório por tipo** (`✨ feat(escopo): assunto`,
`🐛 fix: ...`, `🛠️ chore: ...`), validada pelo hook `commit-msg` que chama o `commitlint`. A tabela `TYPE_EMOJI`
no topo de `commitlint.config.js` é a fonte da verdade dos tipos aceitos e do emoji de cada um; a regra
`type-emoji`, definida no mesmo arquivo, é própria (nenhum preset pronto exige emoji **e** tipo).

**Nenhum commit deste repositório leva trailer `Co-Authored-By:` de Claude/Anthropic** — não escreva essa linha
ao commitar; a regra `no-ia-coauthor` reprova a mensagem se ela aparecer. Coautoria de pessoas continua valendo.

O hook fica
versionado em `scripts/git-hooks/` e é instalado por cópia (`bun run hooks`, também rodado pelo `prepare` do
`bun install`) em vez de `core.hooksPath`, porque `.git/hooks/` também guarda os hooks do git-lfs.

Tabela completa de tipos/emojis, regras validadas e como testar uma mensagem sem commitar:
`docs/convencao-de-commits.md`; o porquê: `docs/history/2026-08-17-commitlint.md`.

## Metadados de release

A versão é rastreada de forma independente em dois lugares e precisa ser mantida em sincronia manualmente ao
cortar uma release: `package.json` (`version`) e `mod/sagittarius-species/descriptor.mod` (`version`, além de
`supported_version` para a versão compatível do jogo Stellaris). O badge de versão no `README.md` é dinâmico
(`shields.io` lendo `package.json` direto do GitHub) — não precisa de edição manual, só reflete `package.json`
depois do próximo push. O texto da listagem no Steam Workshop fica em `steam-workshop/description.md` e
`steam-workshop/change-notes.md`; o `remote_file_id` do `descriptor.mod` é o ID do item no Steam Workshop usado
para publicação.

## Fluxo de release

Sem PR/aprovação no GitHub — este repositório é um pipeline de conteúdo de um mod solo, não um projeto com
revisão de time, então cortar uma release é sempre um merge local direto `develop` → `main`:

1. Bump de versão na `develop`, **sem commitar**: `package.json` (`version`), `descriptor.mod` (`version`) e uma
   nova seção `## <versão>` no topo de `steam-workshop/change-notes.md` (sem timestamp — quem grava o timestamp é
   o próprio `bun run publish-workshop` na hora do publish, ver seção abaixo).
2. Rodar `bun run publish-workshop -- [--auto-approve]` a partir desse estado (ainda não commitado) — o publish
   lê os arquivos do disco, não do git, então a versão/changenote publicados já saem corretos.
3. Só depois do publish confirmado, commitar o bump na `develop` (mensagem no padrão `🛠️ chore: prepara release
   <versão> (bump de versão + changelog)`).
4. `git merge --no-ff develop` em `main`, tag `v<versão>` na `main`, push de `main`, `develop` e da tag.

Publicar antes de commitar evita registrar uma versão que não chegou a subir de verdade (steamcmd falha antes,
Steam Guard cancelado, etc.); só o passo 3 grava o bump no histórico do repositório.

## Publicação no Steam Workshop

`scripts/publish-workshop/` (comando `bun run publish-workshop -- [-m|--metadata-only] [--auto-approve]`) publica
o mod no Steam Workshop via `steamcmd`. `title` (campo `name` do `descriptor.mod`) e `description`
(`steam-workshop/description.md` inteiro) são **sempre** enviados, em qualquer modo — todo publish mantém a
descrição da Steam em sincronia com o arquivo, não só um modo dedicado. Dois modos:

- **Normal** (padrão): além de title/description, extrai a seção mais no topo de
  `steam-workshop/change-notes.md` (formato `## <versão>`, sempre a mais recente por convenção — novas entradas
  sempre entram no topo) como changenote da build, e publica o conteúdo do mod.
- **`-m` / `--metadata-only`**: title/description/thumbnail, sem contentfolder, changenote ou cópia local.

`--auto-approve` pula a confirmação ("digite sim") descrita abaixo e segue direto pro publish — o resumo
continua sendo impresso antes, e login/senha/Steam Guard continuam sempre interativos (isso não tem como
automatizar, é a própria Steam pedindo).

Ambos os arquivos `.md` em `steam-workshop/` são Markdown de verdade (não BBCode) — `md-to-bbcode.ts`
(`marked` + renderer próprio) converte pro dialeto BBCode da Steam em tempo de publish. O header de cada seção
de `change-notes.md` ganha automaticamente um timestamp local (`— YYYY-MM-DD HH:mm`) na hora da confirmação —
metadado só pra correlacionar com o histórico da própria Steam, nunca enviado no texto do changenote (a Steam já
carimba isso sozinha, e o changenote de uma build já publicada não pode ser editado depois via `steamcmd`).

Antes de chamar o `steamcmd`, o script pede confirmação explícita, mostrando o conteúdo da atualização.
Somente o modo normal executa `bun run copy`, depois da confirmação. Login usa
`STEAM_USERNAME` (`.env` local, veja `.env.example`) — senha e Steam Guard são sempre interativos, nunca
persistidos; a sessão fica cacheada pelo próprio `steamcmd` em `bin/steamcmd/`. Windows-only, como o resto do
pipeline.

**Limitações conhecidas, de propósito fora do escopo:** sem automação da galeria de screenshots do Workshop
(`steam-workshop/pictures/screenshot__*.jpg` etc. — o `steamcmd`/VDF não expõe isso, só o painel web da Steam
gerencia); sem localização de título/descrição por idioma (a API `ISteamUGC`/`SetItemUpdateLanguage` não é
exposta pelo `steamcmd`, só a versão single-language via VDF); sem sync automático de versão entre
`package.json`/`descriptor.mod`/`README.md` (continua manual, ver "Metadados de release" acima); sem integração
com o fluxo GitFlow/release.

**`commander` é o padrão do projeto pra CLI** (em vez de parsing manual de `process.argv` ou de
`node:util.parseArgs`) — usado por `generate-art` e `publish-workshop`. Entrega de graça o que era código à mão:
`--help`, `.choices()` validando posicional, `.conflicts()` declarando combinações inválidas de flags, e valor
opcional (`-s [N]`, que o `parseArgs` não sabe fazer e foi o gatilho da troca). Convenção do help: cabeçalhos
como o commander emite (inglês), descrições das flags em português.

Detalhes completos (anatomia do VDF, formato exato de `change-notes.md`, escaping do formato Clausewitz-like do
VDF): `docs/pipeline-publish-workshop.md`.
