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
bun run converter   # roda a conversão de portraits + rooms (bun run portrait && bun run rooms)
bun run portrait     # bun scripts/generate-portraits/index.ts — sincroniza assets/portraits/ com mod/ (DDS + .txt), direto no mod/; aceita um slug opcional (ex.: `bun run portrait ssm_elves`) pra processar uma espécie só
bun run shared-rig   # bun scripts/generate-shared-rig/index.ts — deriva gfx/.../ssm_shared/ a partir de sl_shared/ (veja seção "sl_shared vs. ssm_shared")
bun run rooms         # bun scripts/generate-rooms/index.ts — sincroniza assets/city_sets/ com mod/ (DDS + .txt), direto no mod/
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
- `scripts/restore-masters/index.ts` (também sem entrada no package.json) é um one-shot já executado: restaurou a
  arte-fonte das 16 espécies do `ssm_shared` ao estado pré-migração, trimada, quando `assets/portraits/` passou a
  guardar master nativo. Fica no repositório como registro executável da operação; não precisa rodar de novo.
  **Não existe mais um script de "migrar espécie de rig"** — trocar o rig de uma espécie é editar o campo `rig` do
  `portrait.json` e rodar `bun run portrait`, já que o enquadramento é derivado a cada execução (veja "Pipeline de
  portraits" abaixo).
- **Ferramental de enquadramento** (sem entrada no package.json, rodados direto). Existem porque o corte superior
  do quadro de retrato era estimado a olho em screenshots, e esse número define o teto permanente da composição
  de toda arte futura — veja "Enquadramento: o que a câmera de retrato mostra" abaixo:
  - `scripts/measure-framing/index.ts` — deriva dos `.gui` do Stellaris a janela visível do retrato em cada
    contexto de UI (122 contextos), gravando `contextos.json`. **Se revalida sozinho** a cada patch da Paradox:
    é só rodar de novo. O caminho da instalação do jogo está hardcoded no topo (aceita override por argumento).
  - `scripts/measure-framing/medir-prints.ts` — lê screenshots com a arte de calibração instalada e mede a
    relação entre coordenadas do sprite e do canvas. É a única etapa que exige o jogo aberto; o resultado está
    congelado em `ancora.json`.
  - `scripts/generate-calibration/index.ts` — gera a arte de calibração legível por máquina (a coordenada está
    codificada na cor de cada faixa). Duas imagens, uma por eixo.
  - `scripts/install-calibration/index.ts` — instala essa arte por cima das texturas do `mod/` nas 16 espécies e
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
com toda a orquestração (listar → validar tudo antes de escrever/apagar qualquer coisa → limpar órfãos →
converter/gerar → escrever) e chama `main()` na última linha do arquivo. **Não existe wrapper `processX.ts`** em
`scripts/` só para chamar a pasta — isso já foi tentado (`processPortraits.ts`, `processRooms.ts`) e removido por
ser indireção sem propósito. O `package.json` aponta direto pro entry point: `"portrait": "bun
scripts/generate-portraits/index.ts"`. Ao criar um pipeline novo, siga esse mesmo formato desde o início.

## Binários auxiliares (`bin/`)

`bin/` guarda ferramentas de linha de comando de terceiros usadas pelo projeto. A pasta **não é versionada**
(está no `.gitignore`) — rode `bun run setup` (`scripts/download-bin.ts`) pra baixá-las:

- **`bin/texconv/texconv.exe`** — [texconv](https://github.com/microsoft/DirectXTex) (Microsoft DirectXTex, MIT,
  código aberto). É o motor de conversão de texturas do pipeline (veja seção abaixo) — substituiu o
  `nvtt_export.exe`, que não é mais usado em lugar nenhum do repositório.
- **`bin/imagemagick/magick.exe`** (+ DLLs e arquivos de suporte) — [ImageMagick](https://imagemagick.org)
  portátil, pra manipulação de imagem via linha de comando (resize, crop, conversão de formato, composição) sem
  depender do Photoshop. É o motor de imagem do enquadramento em `scripts/generate-portraits/framing.ts`
  (trim/resize/composição da arte-fonte no canvas do rig — veja "Pipeline de portraits"); também serve pra uso
  manual/ad-hoc.

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

Os dois pipelines que usam esse utilitário seguem o mesmo formato (validar → limpar órfãos → converter → escrever
`.txt`), com formato de textura e forma de pasta diferentes — veja `generate-rooms/` e `generate-portraits/`
abaixo. `bun run rooms` usa `bc1` → `BC1_UNORM`; `bun run portrait` usa `bc3` → `BC3_UNORM`. Só as variantes
lineares/UNORM são usadas (nunca as sRGB), porque o Stellaris não suporta essas últimas (ver `image.md`).

### Pipeline de rooms: `assets/city_sets/` → `mod/` sempre em sincronia

`scripts/generate-rooms/` (comando `bun run rooms`) mantém tanto as texturas quanto o `ssm_room_textures.txt`
sempre espelhando exatamente o que existe em `assets/city_sets/`, toda vez que roda:

1. Os PNGs de `assets/city_sets/` precisam ser `001_room.png`..`NNN_room.png`, sequenciais e zero-padded a 3
   dígitos, sem buracos — qualquer divergência é erro e trava a geração sem escrever nem apagar nada (mesmo
   padrão de `generate-portraits/`).
2. Só depois de validado: qualquer `.dds` já existente em `mod/sagittarius-species/gfx/portraits/city_sets/` que
   não corresponda a um PNG de origem é **apagado** (limpeza total, sem exceção — mesma política de
   `generate-portraits/`). Depois disso, os PNGs são convertidos via `converter.ts`, e
   `gfx/portraits/asset_selectors/ssm_room_textures.txt` é regenerado do zero.
3. O `.txt` gerado contém **só as entradas do mod** (`room_selector.game_setup` com `"NNN_room" = { always = yes
   }` pra cada PNG) — nenhum `ruler` e nenhuma entrada vanilla duplicada. O `room_selector` é mesclado por chave
   entre arquivos diferentes dentro de `gfx/portraits/asset_selectors/` (é assim que mods de rooms coexistem com
   o `room_textures.txt` vanilla sem precisar redefini-lo), então duplicar conteúdo vanilla aqui seria só um
   risco de manutenção (uma cópia congelada que pode ficar desatualizada e sobrescrever silenciosamente lógica
   que a Paradox atualizar depois) sem nenhum benefício — os quartos vanilla (`personality_*_room`, `ruler`,
   etc.) continuam funcionando normalmente via o próprio arquivo do jogo.

### Pipeline de portraits: `assets/portraits/` → `mod/` sempre em sincronia

`scripts/generate-portraits/` (comando `bun run portrait`) mantém tanto as texturas quanto o
`ssm_<espécie>_portrait.txt` de cada espécie sempre espelhando exatamente o que existe em
`assets/portraits/ssm_<espécie>/`, toda vez que roda:

1. Cada pasta `assets/portraits/ssm_<espécie>/` tem um **`portrait.json` obrigatório**:
   `{ "name": "<espécie sem prefixo>", "gendered": boolean, "rig"?: "sl_shared" | "ssm_shared", "modo"?: "largura"
   | "altura", "counts": { "male"?, "female"?, "flat"? } }`. Espécies `gendered: true` têm subpastas
   `male/`/`female/`; `gendered: false` são "flat" (PNGs `NNN.png` direto na raiz da pasta da espécie, ex.:
   `ssm_cyborg`, `ssm_new_order`). O arquivo é a fonte de verdade declarada — não é inferido a partir da contagem
   real de arquivos. `rig` omitido = `"sl_shared"`; `modo` omitido = `"largura"` (só faz sentido em rig com guia,
   veja abaixo).
2. **Dois contratos de arte, um por rig** (`RIGS` em `scripts/generate-portraits/types.ts`):
   - **`ssm_shared` — master + enquadramento derivado.** `assets/` guarda a arte **nativa**, em qualquer resolução,
     trimada no bounding box de conteúdo. O enquadramento (trim → resize → composição no canvas do rig) roda a
     cada `bun run portrait`, em `framing.ts`, escrevendo em `.portraits-framed/` (fora do git, veja
     `.gitignore`), que é o que alimenta o `converter.ts`. O guia de enquadramento é expresso em **fração do
     canvas** — é isso que torna o canvas do rig uma constante trocável, sem recalibrar nada e sem reprocessar a
     arte-fonte. `modo` escolhe entre escalar pela largura do guia (padrão) ou pela altura mínima (composições
     atipicamente largas). Efeito colateral útil: `.portraits-framed/` é o enquadramento final em PNG, conferível
     a olho sem abrir um DDS.
   - **`sl_shared` — legado congelado.** O PNG em `assets/` já vem enquadrado e é usado como está, exigindo o
     canvas exato do rig (825×1650). É copiado byte a byte para o staging, então cópia idêntica ⇒ DDS idêntico:
     as duas espécies que restaram aqui são estruturalmente imunes a mudanças no enquadramento.
3. **Validação antes de qualquer escrita ou remoção** (mesmo padrão de `scripts/generate-names/`): confere que
   `name` bate com o nome da pasta, que a contagem declarada em `counts` bate exatamente com os PNGs encontrados,
   que os arquivos são `001.png`..`NNN.png` sequenciais e zero-padded a 3 dígitos, sem buracos, e — conforme o
   contrato do rig — ou que o PNG tem o canvas exato (legado), ou que o master tem canal alfa e a geometria
   calculada cabe no canvas (`ssm_shared`). Qualquer divergência é erro — nada é escrito nem apagado se houver um
   erro em qualquer espécie.
4. Só depois de validado tudo: para cada espécie, qualquer `.dds` já existente em
   `mod/sagittarius-species/gfx/models/portraits/ssm_<espécie>/` que não corresponda a um PNG de origem é
   **apagado** (limpeza total, sem exceção — histórico: essa decisão já removeu deliberadamente texturas órfãs
   sem PNG de origem que estavam publicadas, como `ssm_cyborg/013.dds`). Depois disso, a arte é enquadrada e
   convertida via `converter.ts`, e o `ssm_<espécie>_portrait.txt` inteiro é regenerado a partir do zero.
5. O template do `.txt` gerado é 100% derivado da forma da pasta (`gendered` vs. flat) e da contagem de arquivos —
   `clothes_selector`, `attachment_selector` e `custom_attachment_label` são sempre os mesmos valores constantes em
   toda espécie hoje; `entity` é `sl_humanoid_01_entity` ou `ssm_humanoid_01_entity` conforme o `rig` do
   `portrait.json` (`RIGS` em `scripts/generate-portraits/types.ts`); `greeting_sound` varia só por gênero
   (`human_male_greetings_01` / `human_female_greetings_01`, sempre macho pras espécies flat); cada espécie tem
   sempre um único grupo de retrato por gênero (sufixo `_01`); o bloco `portrait_groups` segue o boilerplate padrão
   (`game_setup`, `species`, `pop`, `leader`, `ruler`) idêntico ao que já existia manualmente.

### `sl_shared` vs. `ssm_shared`: o rig compartilhado de retrato animado

Todo `entity` de todo `ssm_<espécie>_portrait.txt` aponta pra um rig (mesh + animações) compartilhado por várias
espécies ao mesmo tempo, dentro de `gfx/models/portraits/<rig>/` — veja "A técnica usada aqui" em `portraits.md`
pro histórico completo. Hoje existem dois:

- **`sl_shared/`** — o rig original, herdado do extinto Stellar Legion Mod. **Usado por todas as 15+ espécies
  publicadas** e nunca modificado: sua UV desperdiça boa parte do canvas de `character_textures` (cada um dos 6
  planos do mesh lê só metade vertical da textura, e a arte em si ainda usa só uma fração dessa metade — ver
  `future-plans.md`), mas mudar isso quebraria a arte de toda espécie já publicada, então fica como está.
- **`ssm_shared/`** — fork isolado do `sl_shared`, com as mesmas animações e o mesmo esqueleto, mas com o mesh
  reduzido a **um único plano** (`pPlaneShape4` — os outros 5 são removidos do binário) e a UV desse plano
  remapeada pra usar o canvas inteiro (sem a divisão frente/trás). Os 6 planos do `sl_shared` original são dois
  conjuntos completos corpo/cabelo/roupa do sistema vanilla de camadas de retrato, empilhados em profundidade
  (relevo 2.5D) — funciona com arte pequena e central, mas com arte preenchendo o canvas as camadas viram um
  "fantasma"/gêmeo atrás do personagem (ver `ssm-shared-historico-da-sessao.md`). O plano mantido é o
  `pPlaneShape4` porque cada camada difere em skinning, shader e geometria, e os outros candidatos falharam
  in-game: o `pPlaneShape2` era a "camada do braço direito" (83% do peso de skinning na cadeia do braço — a
  gesticulação dos `.anim` esticava arte cheia em até 29% de strain, a "distorção"); o `pPlaneShape6`, o mais
  rígido, é camada de *cabelo* e fica fundo e curvado (a borda inferior curlada aparecia no quadro como um "papel
  curvado" transparente na cintura). O plano 4 é camada de **corpo** (shader `PdxMeshPortrait`, renderiza arte
  comum), praticamente sem curvatura (0.12 unidades), quase na origem, com strain baixo (10.1% máx / 0.3%
  mediana — 8x melhor que o plano 2). O plano também é **recortado no topo**: as duas primeiras linhas de
  vértices da grade 11×11 são removidas, deixando 9×11 (99 vértices, 160 triângulos). A faixa removida
  corresponde aos 195 px superiores do canvas antigo, que a câmera de retrato **nunca captura** — medição
  in-game situa o topo do sprite em `y_canvas ≈ 199` (ver `scripts/measure-framing/ancora.json` e a seção 2.3
  da referência técnica). Canvas de `character_textures` nesse rig: **980×780**, que cobre exatamente o plano
  recortado preservando a densidade anterior (`976 − 195 = 781`, arredondado pra 780 porque o BC3 exige múltiplos
  de 4). Preservar a proporção é obrigatório: a projeção do canvas no mesh é isotrópica (medido: `k_x` 2.034
  contra `k_y` 2.042, 0.4% de diferença), então esticar um eixo esticaria a arte. **É aqui que a densidade sobe
  quando houver arte em resolução maior** — multiplicar as duas dimensões pelo mesmo fator, e mais nada.
  O canvas anterior era 980×976, escolhido pra bater com o bounding box do plano inteiro (18.90 × 18.86 unidades
  de mesh) na mesma densidade da textura vanilla equivalente (`human_female_body_01.dds`, 420×512 — ~2x essa
  resolução). Cogitamos usar a proporção vanilla direto (840×1024), mas o mesh deste mod não tem a proporção do
  mesh vanilla — bater a proporção vanilla teria esticado a arte verticalmente (~28%) em vez de só aumentar a
  densidade; editar a geometria pra forçar 840×1024 foi descartado por mexer em escala não uniforme sobre uma
  malha com esqueleto de ~40 ossos, arriscando cisalhamento nas animações sem forma barata de validar.
  É o rig de **16 das 18 espécies** (`"rig": "ssm_shared"` no `portrait.json`) e o ponto de partida pra espécies
  novas; só `ssm_mermaids` e `ssm_astral` permanecem no `sl_shared`, congeladas por decisão da release 1.8.0.
  Trocar o rig de uma espécie é editar o campo `rig` e rodar `bun run portrait` — não existe mais um passo de
  migração, porque o enquadramento é derivado a cada execução.

`ssm_shared/` é **derivado**, não editado à mão: `scripts/generate-shared-rig/` (comando `bun run shared-rig`) lê
`sl_shared/humanoid_01_portrait.mesh` e aplica quatro transformações em sequência: `removerPlanosOcultos` excisa os
subtrees dos 5 planos não mantidos do binário (cada plano é autocontido — mesh + esqueleto próprio, sem referência
cruzada — e o formato é um fluxo de tokens sem tabela de offsets, então remover intervalos contíguos de bytes é
uma operação fechada; a remoção estrutural foi escolhida no lugar de triângulos degenerados porque faces
degeneradas crasham o importador do Blender, e validação visual via Blender importa); `corrigirShaderDoMesh`
garante o shader de corpo (`PdxMeshPortrait`) no material do plano mantido — no-op pro `pPlaneShape4`, que já é
camada de corpo, mas fica de guarda porque os shaders de cabelo/roupa (`PdxMeshPortraitHair`/`Clothes`) esperam
máscara de tintura/seleção e não renderizam arte comum: com um deles o retrato aparece in-game como um quadro
vazio, só canal alfa, apesar de renderizar normal no Blender, que ignora o shader; `corrigirUvDoMesh`
reescala o array `u0` (UV) do plano restante (`(V−0.5)×2` — o `pPlaneShape4` lia a metade de cima do canvas, a
sempre-vazia na arte legada; nenhuma
posição de vértice, osso ou animação muda); por fim `recortarPlanoAcima` remove as linhas de vértices do topo do
plano que a câmera nunca captura, reescalando a UV do que sobra pra voltar a cobrir 0..1. Este último é o único
que **encurta arrays** — mexe em tudo que é indexado por vértice (`p`, `n`, `ta`, `u0`, pesos de skinning),
reindexa os triângulos, recalcula a `aabb` e reescreve o int32 de contagem que antecede cada payload; continua
fechado no formato pelo mesmo motivo dos outros (fluxo de tokens, sem tabela global de offsets). Não gera faces
degeneradas, pelo mesmo motivo da excisão de planos. O resultado vai pra `ssm_shared/`, junto com os `.asset`/`.gfx`
renomeados pro namespace `ssm_` (`ssm_humanoid_01_entity`, `ssm_humanoid_01_mesh`,
`ssm_humanoid_01_{happy,happy_2,sad,sad_2}_animation`) e cópia dos `.anim` (que não mudam — as animações
continuam valendo pro plano mantido). Rodar `bun run shared-rig` de novo é seguro e idempotente: sempre regenera
`ssm_shared/` do zero a partir de `sl_shared/`, nunca edita `sl_shared/` em si. A lógica de patch binário do
`.mesh` (`scripts/generate-shared-rig/mesh-uv.ts`) tem teste Bun (`mesh-uv.test.ts`) que confere, contra o
arquivo real, que a excisão é exatamente a emenda dos segmentos preservados (byte a byte, por derivação
independente), que só o payload de `u0` do plano mantido muda no remapeamento, e que o recorte remove
exatamente as linhas previstas sem mover nenhum vértice, mantendo índices de triângulo válidos, esqueleto e
locators intactos e `U` inalterado.
`sl_spider_01_entity` (variante do `sl_shared` com escala maior, não usada por nenhuma espécie hoje) não tem
equivalente no `ssm_shared` — só é criado se/quando alguma espécie precisar dele.
Referência aprofundada: `ssm-shared-referencia-tecnica.md` (formato binário pdxasset, anatomia dos 6 planos —
shader/UV/geometria/skinning de cada um —, ferramental Blender e lições de método) e
`ssm-shared-animacao-do-zero.md` (guia pra construir um rig de retrato inteiro do zero — mesh, esqueleto,
skinning e animação autorais).

### Enquadramento: o que a câmera de retrato mostra

O enquadramento do retrato **não é uma câmera opaca do engine** — é declarado nos `.gui` do jogo. Cada contexto de
UI é um `containerWindowType` com `size` + `clipping = yes`, contendo um `iconType` que desenha um `portraitType`
numa `position` e `scale`. A janela visível é aritmética de layout, em coordenadas do sprite de retrato:

```
topo_visível = (clip.y0 − icone.y) / scale
```

`scripts/measure-framing/` deriva isso pros **122 contextos** que exibem retrato (a lista de sprites de retrato
vem dos próprios `.gfx`, por `type = character` — reconhecer por prefixo de nome perderia
`GFX_contacts_portrait_character_masked` e `GFX_FC_portrait_character_masked`, que são a tela de contatos e a de
primeiro contato).

O que **não** está em arquivo nenhum é qual pedaço do canvas de textura a câmera captura. Isso foi medido
in-game uma vez, com arte de calibração que codifica a coordenada na cor de cada faixa, e está congelado em
`scripts/measure-framing/ancora.json` com as validações que o sustentam. O resultado prático:

- o topo do sprite cai em **`y_canvas ≈ 199`** do canvas antigo de 976 — a faixa acima disso nunca chega à tela,
  e é exatamente ela que `recortarPlanoAcima` remove;
- em X a câmera captura **mais largo que a textura** (`x_canvas = 0` cai em `x_sprite = 45`), então o canvas
  inteiro entra no quadro e **não há faixa morta horizontal a recuperar** — apertar a UV em U cortaria o
  enquadramento;
- a projeção é **isotrópica** (`k_x` 2.034 contra `k_y` 2.042), o que obriga qualquer canvas novo a preservar a
  proporção;
- as variantes de `portraitType` (`close_up`, `gamesetup_mask`, `hologram`, …) **não mudam a câmera**, só máscara
  e efeito — uma âncora só serve pra todos os contextos.

Números derivados de `contextos.json` + `ancora.json` que valem pra compor arte nova: o contexto mais agressivo
começa a exibir em `y_canvas ≈ 457` (do canvas antigo), e a arte hoje começa em 339 — ou seja, **7 dos 90
contextos com janela já cortam o topo da arte atual**, e sempre cortaram. A faixa entre o contexto mais generoso
e o mais agressivo é a zona de elementos sacrificáveis (pontas de cabelo, chifres, ornamentos).

Refazer a medição só é necessário se o canvas do rig mudar ou se um patch mexer na câmera; a tabela de contextos
se revalida sozinha rodando `scripts/measure-framing/index.ts` de novo.

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

Para a mecânica vanilla por trás dessa cadeia (os 6 escopos de `portrait_groups`, por que o rig animado de todas as
espécies vem de um mod terceiro hoje extinto, cumprimentos/insultos por `species_class`, `greeting_sound`, etc.),
veja `portraits.md`.

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
