# Histórico da sessão: correção de UV do `ssm_shared` e a caça ao bug do "fantasma"

Relato detalhado de uma sessão longa que começou como "corrigir o desperdício de UV do `sl_humanoid_01_entity`"
(veja `future-plans.md`) e terminou revertida de propósito depois de expor uma cadeia de bugs cada vez mais
sutis — o último dos quais nunca foi resolvido com confiança. Este arquivo existe pra uma conversa nova poder
retomar o trabalho sem precisar redescobrir tudo isso do zero. Não é um documento de referência permanente do
projeto (como `CLAUDE.md`/`portraits.md`) — é um relatório pontual desta sessão específica; pode ser resumido,
arquivado ou apagado quando o assunto for resolvido de verdade.

## Como chegar no estado em que a sessão terminou

> **Superado — ver seções 13 e 14 pro estado atual.** Hoje o mesh do `ssm_shared` contém um único plano, o
> **`pPlaneShape4`**, escolhido depois de uma cadeia de quatro bugs resolvidos: o fantasma (mesh de 1 plano via
> `removerPlanosOcultos`), a distorção de animação (skinning do plano 2), o quadro vazio do shader de cabelo
> (plano 6, `corrigirShaderDoMesh`) e o corte curvo transparente na cintura (profundidade/curvatura do plano 6) —
> seção 14. Canvas: 980×976. A descrição abaixo é o estado ao fim da primeira sessão, mantida pelo valor
> histórico.

Depois de tudo revertido, o estado do código era:

- `scripts/generate-shared-rig/mesh-uv.ts` — só `escanearPropriedades`, `acharArraysUv`, `remapearUv`,
  `corrigirUvDoMesh`. Nada de `ocultarPlanosTraseiros`, `PLANOS_TRASEIROS`, `UV_RESERVADO`.
- `scripts/generate-shared-rig/index.ts` — gera `ssm_shared/` só com `corrigirUvDoMesh` aplicado ao mesh; as
  `.anim` são copiadas sem alteração (`copyFile`, byte a byte idênticas ao `sl_shared`).
- `scripts/generate-shared-rig/anim-fix.ts` e `anim-fix.test.ts` — **apagados**. A lógica que detectava e
  suavizava os "picos" de rotação nas `.anim` não existe mais no repositório (só neste relato).
- `mod/.../ssm_shared/` já foi regenerado nesse estado revertido e sincronizado com a pasta local do Stellaris
  (`bun run copy`) — o bug do fantasma está de volta, ativo, se você abrir o jogo agora.

Tudo o resto que não é sobre o bug do fantasma/distorção continua como estava (e não precisa ser revertido):
`RIGS`/canvas 1024×976 em `scripts/generate-portraits/types.ts`, o campo `rig` no `portrait.json`, a validação de
dimensão por rig, `assets/portraits/ssm_shared_reference.png`, `assets/portraits/ssm_test_rig/`, o registro do
`ssm_test_rig` em `ssm_species_classes.txt`/`ssm_portrait_sets.txt`, e as seções correspondentes de `CLAUDE.md`.

## Linha do tempo

### 1. Pedido original e decisões (via `/questione-me`)

Pedido: corrigir o desperdício de UV do `sl_humanoid_01_entity` descrito em `future-plans.md`, criando um
`sl_shared` → `ssm_shared` próprio. Uma entrevista estruturada (skill `questione-me`) levou às decisões abaixo,
todas registradas com mais detalhe em `CLAUDE.md` (seção "`sl_shared` vs. `ssm_shared`"):

- **Escopo**: `ssm_shared` como entity irmã isolada — `sl_shared` nunca seria modificado, as 15+ espécies
  publicadas continuariam intocadas. Só espécies novas, opt-in via `"rig": "ssm_shared"` no `portrait.json`,
  usariam o rig novo.
- **Correção de UV**: os 6 planos do mesh (`pPlaneShape2`..`7`) deixariam de ter a divisão frente/trás (cada um
  lendo metade do canvas) e passariam a usar uma única região cobrindo o canvas inteiro.
- **Canvas**: inicialmente cogitado 840×1024 (2x a resolução vanilla, `human_female_body_01.dds` 420×512), depois
  corrigido pra **1024×976** — medindo o bounding box real do mesh (20.21×19.26 unidades, proporção ~1.05:1) e
  confirmando que a UV é uma projeção planar quase linear da posição do vértice (correlação >0.97 entre altura do
  vértice e V). 840×1024 teria esticado a arte verticalmente (~28%) porque o mesh deste mod não tem a mesma
  proporção do mesh vanilla.
- **Execução técnica**: a edição do `.mesh` seria feita via script determinístico (`corrigirUvDoMesh` em
  `mesh-uv.ts`), não manualmente no Blender — a transformação (reescalar o array `u0` de cada plano) é puramente
  geométrica. O Blender/BlenderMCP entraria só pra conferência visual depois.
- **Pipeline**: campo opcional `"rig"` no `portrait.json` (ausente = `sl_shared`, comportamento atual), com
  validação de dimensão do PNG por rig.
- **Validação**: teste de script (matemática do remapeamento) + textura xadrez aplicada e visualizada via
  BlenderMCP — sem criar espécie de teste completa nessa fase (isso mudou depois, veja seção 4).

Editar a geometria do mesh pra forçar a proporção 840×1024 vanilla foi **descartado** já nessa fase — exigiria
escala não uniforme sobre uma malha com esqueleto de ~40 ossos, arriscando cisalhar as animações. Essa
preocupação, descartada cedo por precaução, acabou sendo exatamente a causa raiz do primeiro bug de verdade (veja
seção 5).

### 2. Descoberta técnica: como o `.mesh` funciona

Formato binário "pdxasset" da Clausewitz Engine (mesmo formato de `.mesh`/`.anim`), documentado em
`scripts/generate-shared-rig/mesh-uv.ts`:

- Header `@@b@` + sequência de objetos (`[` + nome terminado em zero, profundidade = contagem de `[`) e
  propriedades (`!` + tamanho do nome + nome + dado tipado `i`/`f`/`s`).
- O mesh tem 6 objetos `pPlaneShape2`..`7`, cada um com 121 vértices (grade 11×11), esqueleto próprio (~40-46
  ossos, cópia idêntica em cada um dos 6 objetos) e um array `tri` de 600 índices (200 triângulos).
- Antes da correção: `pPlaneShape2`/`3`/`7` liam a metade de baixo do canvas (V∈[0,0.5]) — confirmado
  empiricamente (via `bun-`, comparando UV contra os pixels reais de `ssm_elves/male/001.png`) que é aí que a
  arte de fato é pintada. `pPlaneShape4`/`5`/`6` liam a metade de cima (V∈[0.5,1]), sempre vazia em toda espécie
  publicada.
- `corrigirUvDoMesh` reescala o V de cada plano pra cobrir 0–1 inteiro (`V×2` pros que usavam a metade de baixo,
  `(V−0.5)×2` pros que usavam a de cima) — patch in-place, mesmo tamanho de arquivo, testado byte a byte contra o
  `.mesh` real.

### 3. `assets/portraits/ssm_shared_reference.png` — imagem de referência

Pedido do Rodrigo pra ter uma referência de reenquadramento. Gerada via BlenderMCP: reimportou o mesh (com o
addon `io_pdx_mesh`, veja seção 8), configurou câmera ortográfica enquadrando exatamente o bounding box do plano
`pPlaneShape2`, e renderizou um preenchimento translúcido ciano em 1024×976 — mostra onde a malha realmente
existe (silhueta ondulada, não um retângulo perfeito). Depois, a pedido, a mesma técnica gerou uma segunda versão
mostrando o esqueleto por cima (marcadores esféricos nas articulações, gerados como geometria renderizável real —
armature não aparece em render final do Blender, só em viewport).

### 4. `ssm_test_rig` — espécie de teste

Criada a pedido: `assets/portraits/ssm_test_rig/portrait.json` com `"rig": "ssm_shared"`, `001.png` placeholder
xadrez com marcadores de canto coloridos (vermelho/verde/azul/amarelo, pra flagrar flip/rotação de longe), depois
`002.png` com arte real pintada pelo Rodrigo. Registrada em `ssm_species_classes.txt` (`ssm_sagittarius`) e
`ssm_portrait_sets.txt` (`ssm_humanoids`) pra aparecer selecionável no jogo. Sincronizada repetidamente via
`bun run copy` ao longo da sessão.

### 5. O bug do "fantasma" (gêmeo atrás)

> **Correção posterior (ver seção 12):** o modelo de causa raiz descrito abaixo — "dois grupos de 3, o de trás
> (`4/5/6`) sempre vazio" — está **incompleto/errado**. A revalidação no Blender (seção 12) mostrou que os 6 planos
> são 6 superfícies curvas *distintas*, cada uma exibindo o retrato **inteiro**, empilhadas em profundidade (relevo
> 2.5D). Esconder só `4/5/6` **não** elimina o fantasma. Leia a seção 12 antes de agir sobre esta.

Ao testar `ssm_test_rig` in-game pela primeira vez: o retrato mostrava um "gêmeo" atrás do personagem principal.

**Causa raiz**: os 6 planos já eram, desde o `sl_shared` original, dois grupos de 3 cópias quase idênticas
empilhadas em profundidades (Z) diferentes. Isso sempre funcionou sem problema porque o grupo "de trás"
(`pPlaneShape4`/`5`/`6`) sempre esteve vazio (nenhuma arte pintada na metade de canvas que ele lia). Ao unificar a
UV, os 6 passaram a mostrar a **mesma** textura, agora totalmente pintada — 3 cópias visíveis viraram 6,
espalhadas numa profundidade bem maior que antes (a "frente" já tinha ~6 unidades de espalhamento entre si; somar
a "trás" espalha por ~22 unidades).

### 6. Tentativa 1 de correção — colapsar posição pro centróide (ERRADA)

Ideia: escalar a posição (`p`) dos vértices dos 3 planos traseiros pra perto do próprio centróide (fator ~0.0005),
tornando-os um ponto imperceptível. Parecia segura (mudança pequena, uniforme, sem tocar esqueleto/skin
explicitamente).

**Por que quebrou**: *skinning* deforma cada vértice em relação à pose de repouso que os ossos esperam (guardada
em `skeleton`/`tx`, não tocada por essa mudança). Ao mover só o vértice sem mover o osso correspondente, assim
que a animação (`idle`/`sad`) girava um osso, o vértice deslocado "explodia" pra uma posição arbitrária em vez de
continuar perto de onde tinha sido colapsado. Resultado: em vez do fantasma parado, uma distorção de animação —
a malha se contorcendo, muito pior visualmente.

O Rodrigo confirmou visualmente ("a distorção agora está com uma distorção muito horrível") e a hipótese técnica
foi confirmada matematicamente depois (relação vértice↔osso incompatível sob esse tipo de edição).

### 7. Tentativa 2 — degenerar triângulos (NÃO RESOLVEU)

Ideia: fazer todo índice do array `tri` dos 3 planos traseiros apontar pro vértice 0 — cada "triângulo" vira área
zero, sem tocar `p`/`skin`/`skeleton` em nenhum momento. Teoricamente à prova de animação (triângulo de área zero
nunca deixa de ter área zero, não importa a pose).

**Resultado**: o fantasma continuou sumido (confirmado depois, retroativamente), mas o Rodrigo reportou que a
distorção "ainda está distorcido igual da última vez" — ou seja, essa tentativa não resolveu o problema real.
Suspeita levantada (nunca confirmada, só descartada por eliminação depois): triângulos degenerados causando algum
problema no recálculo de normal/tangente por quadro numa malha animada.

### 8. Investigação do Blender/`io_pdx_mesh` (paralela às tentativas 1-2)

O addon `io_pdx_mesh` (necessário pra importar/exportar `.mesh` no Blender) estava instalado mas não carregava no
Blender 5.2 local (Python 3.13) — usa `from imp import reload`, módulo `imp` removido no Python 3.12+. A
instalação real (via Microsoft Store/MSIX) fica virtualizada fora do `%APPDATA%` literal:
`%LOCALAPPDATA%\Packages\BlenderFoundation.Blender_ppwjx1n5r4v9t\LocalCache\Roaming\Blender Foundation\Blender\5.2\scripts\addons\io_pdx_mesh\`.

Patches manuais aplicados nesse addon (fora deste repositório):
1. `__init__.py`: `from imp import reload` → `from importlib import reload`.
2. `pdx_blender/blender_import_export.py`: `use_auto_smooth`/`normals_split_custom_set_from_vertices` guardados
   com `hasattr` (API removida no Blender 4.1+).
3. Mesmo arquivo: `shadow_method` guardado com `hasattr` (removido no Blender 4.2+/EEVEE Next).
4. O sistema de shader/material do addon (`ShaderNodeSeparateRGB` etc.) tem mais incompatibilidades não
   corrigidas — contornado monkeypatching `create_material` pra no-op e aplicando material próprio (xadrez ou
   preenchimento translúcido) direto via `bpy`, sem passar pelo sistema de material do addon.

Essas correções permitiram importar o mesh, tirar screenshots de viewport e gerar renders (usados nas seções 3 e
9). Foram usadas repetidamente ao longo da sessão — reimportações, criação/remoção de objetos, materiais,
imagens, câmeras, e edição do addon com o Blender já rodando.

**BlenderMCP parou de responder** depois de um uso intenso (edições no addon com Blender já com ele carregado,
`sys.modules` manipulado manualmente, `create_material` monkeypatchado, múltiplas remoções/recriações de
objetos). O processo do Blender em si nunca caiu (confirmado via `Get-Process`, sempre "Responding: True") — só a
ponte MCP (`uvx blender-mcp`) ficou instável, "piscando" entre conectado/desconectado, e mesmo quando
`claude mcp list` reportava conectado, as ferramentas não voltavam a aparecer nesta sessão específica (via
`ToolSearch`) — parece ser uma limitação de sessão, não algo revertível sem uma conversa nova.

**Efeito prático**: a partir de um certo ponto da sessão, não foi mais possível validar visualmente nada no
Blender — as tentativas 3 e a investigação de animação (seções 9-10) foram feitas só analisando os arquivos
binários com scripts, sem confirmação visual.

### 9. Tentativa 3 — UV pra canto reservado transparente (NÃO RESOLVEU A DISTORÇÃO, mas foi a abordagem mais segura)

Ideia: em vez de mexer em geometria/triângulo, voltar a mexer só em `u0` (já validado seguro duas vezes) — apontar
a UV de todo vértice dos 3 planos traseiros pra um ponto fixo dentro de um bloco 8×8 pixels reservado no canto
superior-esquerdo do canvas, que `character_textures` seria obrigado a manter transparente. `001.png` e `002.png`
do `ssm_test_rig` foram ajustados pra ter esse bloco transparente.

**Resultado**: mais uma vez, o fantasma continuou resolvido, mas a distorção de animação persistiu — igual às
tentativas anteriores. Isso foi o sinal decisivo de que **a distorção nunca teve relação com a técnica de
esconder os planos traseiros** — as três tentativas (posição, triângulo, UV) tentaram resolver o mesmo problema
(esconder os 3 planos) de formas cada vez mais conservadoras, e nenhuma delas "causava" nem "curava" a distorção,
porque a distorção era outra coisa completamente.

### 10. A distorção era um bug pré-existente nas `.anim`, exposto pela resolução de escala

Depois de eliminar a hipótese dos planos traseiros, o Rodrigo descreveu a distorção com mais precisão: "uma
versão exagerada/ampliada do mesmo movimento sutil de ombro que o elfo publicado faz". Isso levou a reconsiderar:
o personagem no `ssm_shared` ocupa muito mais do quadro (preenchendo o canvas quase inteiro) que nas espécies
publicadas (~35% do canvas) — não porque a malha mudou de tamanho (não mudou, `p` nunca foi tocado nos planos
frontais), mas porque há muito mais **detalhe visível** (cabelo, rosto, bordas de armadura) pra revelar qualquer
imperfeição da animação que antes passava despercebida.

Investigação binária do `.anim` (mesmo scanner de `mesh-uv.ts`, reaproveitado — o formato `.anim` compartilha o
mesmo header/estrutura de objeto-propriedade do `.mesh`):

- Estrutura: `info.fps` (~30.17), `info.j` (nº de ossos, 46), `info` por-osso com uma string `sa` (`"t"`, `"tqs"`,
  `"ts"`, `"s"` etc. — indica quais canais aquele osso tem) + pose de repouso (`t`/`q`/`s`); `samples.t`/`.q`/`.s`
  são arrays FLAT concatenados por osso, na ordem em que aparecem em `info`, cada um contribuindo
  `total_frames × tamanho_do_canal` elementos se aquele osso tiver aquele canal (contagens totais batidas
  exatamente contra a soma esperada, forte evidência de que o layout foi entendido certo).
- Encontrado: em cada um dos 4 clipes (`happy`/`happy_2`/`sad`/`sad_2`), a rotação (`q`) de ossos animados tem
  "picos" isolados de 1 frame — um salto de ~90-100° em 1/30s, sanduichado entre dois frames vizinhos parecidos
  entre si, repetindo periodicamente (a cada 16-18 frames, varia por clipe).
- **Erro no meio da investigação**: no primeiro clipe testado (`happy`), o pico batia no mesmo frame pra todos os
  ossos — parecia que a pose inteira "saltava junto". Verificando os outros 3 clipes, isso não se confirmou: cada
  osso tem sua **própria fase** dentro do mesmo período (o ombro esquerdo pica num frame, a perna esquerda pica
  em outro). Uma primeira versão da correção (não chegou a ser testada in-game) usava uma lista de frames global;
  foi corrigida pra detectar por osso individualmente antes de aplicar.
- Causa raiz real desconhecida (o `.anim` é herdado do extinto Stellar Legion Mod, exportado por ferramenta
  não-oficial, sem fonte pra consultar) — mas o padrão (periódico, mesmo período mas fase diferente por osso,
  presente nos 4 clipes) sugere um defeito real de exportação/bake, não uma escolha de animação.
- Também encontrado, não corrigido: a primeira e a última transição de cada clipe (frame 0→1 e
  penúltimo→último) têm saltos grandes que o detector "sanduíche" não pega (só detecta picos com os dois
  vizinhos disponíveis). Hipótese não confirmada: são a entrada/saída do clipe via `animation_blend_time` ao
  trocar de estado, categoria estruturalmente diferente do pico "no meio do loop" — mas sem validação visual, não
  dá pra ter certeza se isso também é visível/importa.

**A correção foi implementada** (`anim-fix.ts`, função `corrigirPicosDeAnimacao`): interpola cada frame de pico
detectado usando os vizinhos (slerp pra rotação, média pra posição/escala), por osso, aplicada só nas cópias
`.anim` que iam pro `ssm_shared` (`sl_shared` nunca tocado). Testada (`anim-fix.test.ts`, contra os 4 clipes reais)
confirmando que o maior salto angular interior cai de ~90-100° pra menos de 45° em todo osso afetado, e que só os
bytes dos frames de pico detectados mudam.

**Nunca testada in-game** — a sessão foi interrompida pelo pedido de reverter tudo antes do Rodrigo conseguir
testar essa versão.

> **Correção posterior (ver seção 13):** o parágrafo acima está errado — o Rodrigo **testou sim** essa versão
> in-game (só não tinha relatado na época) e o resultado foi **muito pior que a distorção original**: pose do
> retrato completamente mudada, "rasgando" o retrato. Ou seja, a "correção" dos picos era ativamente danosa.
> Hipótese principal do porquê (não confirmada): os "picos" detectados eram *sign flips* de quatérnio (`q` e
> `−q` representam a mesma rotação 3D — um exportador que alterna o sinal entre frames produz "saltos" enormes
> numa métrica ingênua de ângulo, mas sem efeito visual nenhum), e interpolar por cima deles destruiu dados
> reais. Alternativa: o layout dos arrays `samples` foi lido com offsets errados e a correção escreveu rotação
> de um osso em cima de outro. Nos dois casos, a conclusão é a mesma: **a análise binária às cegas desta seção
> não é confiável como base** — a investigação da distorção precisa recomeçar com validação visual no Blender.

### 11. Decisão de reverter

O Rodrigo pediu pra reverter todas as correções (tentativas 1-3 dos planos traseiros + a correção de animação) e
voltar pro estado só com `corrigirUvDoMesh` — reintroduzindo o bug do fantasma, mas sem a distorção de animação
que veio depois. Motivo dado: "apos isso foi que começou a dar muitos problemas" (referindo-se a alguma correção
das tentativas 1-3) e "o bug do gemeo é entre os bugs o menos distorcido" — ou seja, prefere recomeçar do bug mais
simples/conhecido do que continuar em cima de uma pilha de tentativas que não resolveu nada e piorou por um
tempo.

Reversão executada: `ocultarPlanosTraseiros`/`UV_RESERVADO`/`PLANOS_TRASEIROS` removidos de `mesh-uv.ts`;
`anim-fix.ts`/`anim-fix.test.ts` apagados; `index.ts` voltou a gerar `ssm_shared/` só com `corrigirUvDoMesh`
aplicado ao mesh e as `.anim` copiadas sem alteração. Regenerado (`bun scripts/generate-shared-rig/index.ts` →
`bun run portrait` → `bun run copy`) e sincronizado com o mod local — o fantasma está de volta, ativo.

### 12. Sessão de revalidação (2026-07-23): o modelo "frente/trás" estava errado

Sessão nova, sem escrever código de correção (a pedido) — só reconfigurar o BlenderMCP e **revalidar visualmente o
fantasma**, coisa que a sessão anterior nunca conseguiu (o BlenderMCP tinha morrido, seção 8).

**BlenderMCP voltou a funcionar, limpo.** `claude mcp list` → `blender ✔ Connected`; Blender rodando e responsivo;
ferramentas `mcp__blender__*` carregadas via `ToolSearch`; `get_scene_info` e `get_viewport_screenshot`
respondendo. Diferenças em relação à seção 8:
- O addon `io_pdx_mesh` agora está instalado em
  `%APPDATA%\Blender Foundation\Blender\5.2\extensions\user_default\io_pdx_mesh\` (extensão do Blender 4.2+),
  **não** mais no caminho MSIX virtualizado.
- O `create_shader` do addon **já está patchado** nesta instalação (usa `ShaderNodeSeparateColor`, guardas
  `hasattr` pra `shadow_method`/`blend_method`, trata `Specular IOR Level`) — **não precisou de nenhum monkeypatch**
  pra importar o mesh com material. O import (`bpy.ops.io_pdx_mesh.import_mesh`, mesh+skel+locs+joinmats) rodou
  limpo de primeira. A instabilidade da seção 8 muito provavelmente veio do acúmulo de monkeypatch/`sys.modules`
  numa sessão Blender longa — começar limpo evita isso.

**Validação do fantasma (arte real `002.png` do `ssm_test_rig` aplicada como material unlit nos 6 planos):**
- Isolando **cada plano individualmente**, cada um dos 6 mostra o **personagem completo** — não uma fatia.
- Comparando a geometria: centralizando cada plano no próprio centróide, a diferença ponto-a-ponto vs `pPlane2` é
  de **2,5–2,8 unidades** (pPlane6 ~1,5). Ou seja, **não são cópias redundantes** deslocadas — são 6 superfícies
  **curvas distintas**, cada uma com os mesmos 46 grupos de vértice (ossos), empilhadas em profundidade (eixo Y,
  centróides de +3,55 em `pPlane2` a −1,21 em `pPlane7`, espalhamento ~4,7).

**Modelo mental corrigido:** o rig usa uma técnica de **relevo 2.5D** — empilhar várias folhas curvas, cada uma com
o retrato inteiro, pra fingir volume numa arte plana. Isso só "funciona" sem fantasma quando a arte é pequena e
central (as espécies publicadas): a paralaxe entre as camadas fica minúscula e lê como volume sutil. Quando a arte
preenche o canvas inteiro (o objetivo do `ssm_shared`), as bordas da silhueta das 6 camadas em profundidades
diferentes deixam de coincidir → o fantasma. **A divisão "2/3/7 lê metade de baixo / 4/5/6 lê metade de cima" é
sobre qual região do canvas cada plano lia na UV original — não corresponde a uma separação frente/trás por
profundidade.**

**Consequências para a correção (testadas visualmente, sem código):**
- **Esconder só `4/5/6`** (a hipótese das seções 5–9): de vista 3/4 o fantasma **continua** (2/3/7 ainda estão
  espalhados em profundidade); de quase-frente (~15°) o resíduo fica pequeno — o que provavelmente explica por que
  as tentativas antigas pareceram "resolver" o fantasma in-game, mas não é uma correção limpa por ângulo.
- **Manter 1 único plano** (ex.: só `pPlane2`): elimina o fantasma **em qualquer ângulo** (confirmado por
  screenshot, quase-frente e 3/4). Custo: perde o falso-volume 2.5D — o retrato fica plano (que é como a maioria
  dos mods de retrato funciona). É o candidato mais limpo e à prova de ângulo. Implementação sugerida: no
  `scripts/generate-shared-rig/`, ocultar 5 dos 6 planos via `u0` pra um canto transparente (a técnica `u0` que a
  seção 9 já validou como segura — só que aplicada a 5 planos, não 3).
- Colapsar os 6 na mesma profundidade manteria a tentativa de volume, mas causa z-fighting entre 6 superfícies
  quase-coplanares e exige editar posição de vértice (risco de cisalhar animação, categoria da tentativa 1 —
  seção 6). Descartado como primeira opção.

A **distorção de animação** (seção 10) é independente disto e continua presente em qualquer plano que se mantenha —
não foi tocada nesta sessão.

Estado ao fim desta sessão: **nenhuma mudança de código/mod** (a reversão da seção 11 segue valendo, o fantasma
segue ativo in-game). Só este documento foi atualizado. Decisão de estratégia de correção ficou em aberto.

### 13. Correção do fantasma implementada (2026-07-23): degeneração → remoção estrutural

Mesma sessão da seção 12, continuada. Duas rodadas de implementação (via `/questione-me`):

**Rodada A — triângulos degenerados (funcionou no jogo, mas foi substituída).** `degenerarPlanosOcultos` em
`mesh-uv.ts`: todo índice do array `tri` dos 5 planos não mantidos passou a apontar pro vértice 0 (área zero, GPU
não rasteriza). Testes Bun garantindo patch cirúrgico. **Resultado in-game confirmado pelo Rodrigo: o fantasma
sumiu.** Porém: **importar esse mesh no Blender crasha o Blender** (o importador do `io_pdx_mesh` não sobrevive a
1000 faces degeneradas) — e validação visual no Blender é pré-requisito da investigação da distorção. Além disso,
o Rodrigo revelou nesse teste que o anim-fix da sessão antiga **tinha sido testado e pirou tudo** (ver correção na
seção 10) — o que torna a investigação visual ainda mais necessária.

**Rodada B — remoção estrutural (estado atual).** `degenerarPlanosOcultos` substituída por
`removerPlanosOcultos`: os 5 subtrees `pPlaneShape3`..`7` são **excisados do binário** (cada um é autocontido —
mesh + esqueleto próprio, sem referência cruzada; os `locator` não apontam pra plano nenhum; o formato é fluxo de
tokens sem tabela de offsets, então excisão de intervalo contíguo é operação fechada). O scanner de `mesh-uv.ts`
ganhou `escanearObjetos` (offsets de início de subtree). Pipeline: `corrigirUvDoMesh(removerPlanosOcultos(mesh))`.
O mesh caiu de 103 KB pra 17 KB. Testes reescritos — o mais forte: o resultado é byte a byte igual à
reconstrução manual `[início..fim do pPlaneShape2] + [locators..EOF]` feita por derivação independente.

Validação da rodada B:
- **Blender: importa limpo e instantâneo** (`pPlane2` 121 verts/200 faces/46 vgroups + armature + locators), sem
  crash. Personagem único e limpo na vista 3/4 que revelava o fantasma.
- **Fumaça de `.anim` no Blender: funciona ponta a ponta** — `bpy.ops.io_pdx_mesh.import_anim` sobre o rig
  importado (`happy.anim`, 180 frames @ 30 fps), action criada, ossos animando, mesh deformando via modificador
  `ARMATURE`. A ferramenta pra investigar a distorção visualmente está pronta.
- **Pista pra investigação da distorção** (observada, não investigada): `Character5_LeftHand` percorre **7,15
  unidades** ao longo do clipe `happy` — ~35% da largura total do mesh (~20 unidades). Movimento enorme pra um
  idle sutil; consistente com a descrição da distorção como "versão exagerada do movimento de ombro". Nas
  espécies publicadas (arte pequena e central), a região da mão provavelmente cai fora da arte pintada.
- In-game: fantasma continua sumido (a rodada A já tinha confirmado; a B remove a geometria de vez, não há o que
  renderizar).

Detalhe operacional do Blender pós-crash: ao reabrir, o addon `io_pdx_mesh` estava **desabilitado** (efeito do
crash) — reabilitar via `addon_utils.enable('bl_ext.user_default.io_pdx_mesh', default_set=True,
persistent=True)`. O servidor do BlenderMCP também precisa ser reconectado manualmente na sidebar (N →
BlenderMCP → Connect, porta 9876).

### 14. Correção da distorção de animação (2026-07-23): troca do plano mantido pro `pPlaneShape6`

Rodada nova (via `/questione-me`), com o diagnóstico visual comparativo no Blender como primeiro passo obrigatório
(lição da seção 10: nunca mais patch binário às cegas). Protocolo: `ssm_shared` (arte cheia de teste) e
`sl_shared` (arte legada dos elfos) lado a lado na mesma cena, armatures separados, mesmo `happy.anim` nos dois.

**Diagnóstico — a causa não era a animação, era o skinning do plano escolhido:**

- Os `.anim` são byte a byte os mesmos das 15+ espécies publicadas; o movimento dos ossos é idêntico nos dois
  rigs. A animação nunca esteve "corrompida" — o modelo dos "picos de rotação" (seção 10) morreu de vez.
- **Cada um dos 6 planos do relevo 2.5D tem um skinning completamente diferente** (era daí que vinha a
  paralaxe: cada camada seguia um grupo de ossos). O `pPlaneShape2` — o que a seção 13 manteve — era a **"camada
  do braço direito"**: 83% de todo o peso de skinning na cadeia do braço direito, incluindo **51% de peso da mão
  nos cantos superiores do canvas** (região do cabelo na arte cheia). Quando o braço gesticula, o retrato inteiro
  desliza e o rosto estreita — comparação frame 1 vs 134 no Blender reproduziu exatamente a distorção vista
  in-game. Na arte legada essas regiões são transparentes; por isso ninguém nunca viu.
- Strain de aresta medido por plano no clipe inteiro (numpy sobre o mesh avaliado via depsgraph): `pPlaneShape2`
  **28,9%** máx / 2,5% mediana (o pior dos 6); `pPlaneShape4/5` ~10%; **`pPlaneShape6` 6,9% máx / 0,1% mediana**
  (o melhor — quase rígido, deslocamento máx de vértice 0,31 unidades = balanço sutil de respiração). A excursão
  de ~7 unidades da mão (seção 13) era osso, não vértice — o plano 6 quase não a sente.

**Correção (mínima):** `PLANO_MANTIDO = 'pPlaneShape6'` em `mesh-uv.ts` — a excisão já era genérica. Como o
plano 6 tem outro bounding box (18,88×18,83 unidades, proporção ~1,004 vs 1,049 do plano 2), o canvas mudou de
1024×976 pra **980×976** (mesma altura/densidade, proporção fiel — manter 1024 comprimiria toda arte futura
~4,4% na horizontal). O plano 6 lia a metade de **cima** do canvas em coordenadas PDX (V∈[0.5,1], ramo
`(V−0.5)×2` do `remapearUv` — atenção: o Blender exibe V invertido, o importado aparece como [0,0.5]). Bônus: o
plano 6 é o de menor curvatura (menos warp estático) e a UV dele é uma grade perfeitamente regular. Arte de
teste redimensionada pra 980×976; teste de splice reescrito pra 3 segmentos (o plano mantido agora fica no meio);
`ssm_shared_reference.png` regenerado (980×976, malha + wireframe + 33 ossos projetados por ajuste linear
(x,z)→(u,v) com R²>0.998).

**Validação:** 13 testes Bun verdes; Blender importa limpo (`pPlane6`, 121 verts, liga sozinho no armature);
frames 1 vs 134 (o antigo pico de rasgo) **praticamente idênticos** com arte cheia — proporções do rosto
intactas, só um balanço mínimo no ombro. `bun run portrait` + `bun run copy` rodados.

**Sequela descoberta no teste in-game (mesma data): o shader do plano 6 era de cabelo.** O primeiro teste
in-game do Rodrigo mostrou um **quadro vazio** (só canal alfa). Diagnóstico pelo binário: cada plano tem um bloco
`material` com `shader`, e os 6 planos são **dois conjuntos completos do sistema vanilla de camadas de retrato**
— corpo/cabelo/roupa lendo a metade de baixo do canvas (`pPlaneShape2`=`PdxMeshPortrait`,
`3`=`PdxMeshPortraitHair`, `7`=`PdxMeshPortraitClothes`) e corpo/roupa/cabelo lendo a de cima
(`4`=`PdxMeshPortrait`, `5`=`PdxMeshPortraitClothes`, `6`=`PdxMeshPortraitHair`). Ou seja: a "metade de cima
sempre vazia" era a região de arte do segundo conjunto, e o plano 6 é uma **camada de cabelo** — o shader de
cabelo espera máscara de tintura e não renderiza arte comum (por isso in-game fica transparente; o Blender ignora
o shader da Clausewitz e renderizou normal — mais um lembrete de que Blender valida geometria/skinning, mas
**não** valida shader/render do jogo). Correção: `corrigirShaderDoMesh` em `mesh-uv.ts` — troca a string do
shader do plano mantido pra `PdxMeshPortrait` (emenda de buffer, 20 → 16 bytes; 5 testes novos, total 18).
Pipeline final: `corrigirUvDoMesh(corrigirShaderDoMesh(removerPlanosOcultos(mesh)))`. Hipóteses descartadas no
diagnóstico (com dados): winding/normais (idênticos nos 6 planos, medido no binário e no Blender) e profundidade
(o plano 6 fica em Y −2,9..−0,3, mas camadas de trás sempre renderizaram — o fantasma da 1ª sessão era atrás do
personagem).

**Segundo teste in-game (Rodrigo): arte aparece, sem fantasma e sem distorção — mas com um "papel curvado" na
cintura.** Uma faixa transparente curva no meio do retrato: a **borda inferior do plano 6** entrando no quadro.
Causa geométrica (medida no Blender): o plano 6 fica 3–8 unidades mais fundo que o plano 2 (Y −2,9..−0,3 vs
+1,1..+5,0) — na câmera em perspectiva do jogo, mais fundo = renderiza menor, e as bordas do mesh (fora do quadro
no plano 2) entram no enquadramento; e a metade direita da borda inferior dele curla ~2,9 unidades pra trás
(curvatura total 2,6), então a borda entra **curvada**. De quebra, ficou explícito que a imagem de referência
mostra o espaço de *textura* (UV, que cobre o canvas todo por definição), não a silhueta projetada.

**Troca final: `PLANO_MANTIDO = 'pPlaneShape4'`.** Medindo os 6 planos, o 4 venceu em tudo que importa: camada
de **corpo** (`PdxMeshPortrait` — o patch de shader vira no-op, mantido como guarda), praticamente sem curvatura
(0,12 unidades — nenhuma borda curva pra aparecer), quase na origem (Y −0,54..−0,43 — render próximo do tamanho
do plano 2, cujo enquadramento é comprovado in-game), strain 10,1% máx / 0,3% mediana (vs 6,9%/0,1% do plano 6 e
28,9%/2,5% do plano 2 — a mediana é o que domina a percepção), proporção 1,002 (canvas 980×976 continua válido) e
mesma metade de cima da UV (ramo `(V−0.5)×2`). Teste do caminho de emenda do shader virou round-trip sintético
(constrói variante com shader de cabelo no plano mantido e confere restauração byte a byte). 17 testes verdes;
Blender: frames 1 vs 134 idênticos com arte cheia; `ssm_shared_reference.png` regenerado a partir do plano 4.

**Confirmação in-game final (Rodrigo, 2026-07-23): "funcionou perfeito, sem o corte na cintura."** Saga
encerrada — os quatro bugs (fantasma, distorção de animação, quadro vazio do shader de cabelo, corte curvo na
cintura) estão resolvidos e confirmados no jogo. O `ssm_shared` está funcional de ponta a ponta:
`pPlaneShape4`, canvas 980×976, pipeline `corrigirUvDoMesh(corrigirShaderDoMesh(removerPlanosOcultos(mesh)))`.

## O que se sabe, pra quem for continuar

1. **O fantasma está RESOLVIDO** (seções 12 e 13): causa = 6 folhas curvas distintas, cada uma com o retrato
   inteiro, empilhadas em profundidade (relevo 2.5D). Solução final: **remoção estrutural** — o mesh do
   `ssm_shared` contém um único plano (`removerPlanosOcultos` em `mesh-uv.ts`), validado no Blender e
   in-game. Becos sem saída registrados, pra não repetir: esconder só `4/5/6` (não resolve — 2/3/7 também se
   espalham em profundidade), posição pro centróide (quebra skinning), triângulos degenerados (funciona no jogo
   mas crasha o importador do Blender), UV pra canto transparente (funciona mas impõe contrato permanente na
   arte).
2. **A distorção de animação está RESOLVIDA** (seção 14): não era defeito na animação — era o skinning do plano
   mantido (`pPlaneShape2` = camada do braço direito do relevo). O modelo dos "picos de rotação de 1 frame"
   (seção 10) está morto: os `.anim` são os mesmos das espécies publicadas e nunca tiveram defeito; a correção
   antiga baseada nesse modelo destruiu dados reais (provável *sign flip* de quatérnio lido como anomalia).
   A escolha do plano substituto passou por dois candidatos: o `pPlaneShape6` (o mais rígido) resolveu a
   distorção **confirmado in-game**, mas expôs dois bugs próprios — shader de cabelo (quadro vazio) e
   profundidade/curvatura (corte curvo na cintura). O plano final é o **`pPlaneShape4`** (corpo, plano, na
   origem, strain mediana 0,3%) com canvas 980×976 — cada camada do rig difere em skinning, **shader** e
   **geometria**, e a escolha precisa pesar os três.
3. **BlenderMCP fica instável sob uso pesado** (seção 8), MAS numa sessão limpa funciona bem (seção 12) — a
   revalidação do fantasma foi feita inteira no Blender sem travar. Receita que funcionou: sessão Blender limpa +
   addon `io_pdx_mesh` já patchado no disco (não monkeypatchar em runtime) + evitar `sys.modules`/edição de addon
   com Blender rodando. Ainda assim, reiniciar o Blender entre operações arriscadas e ter plano B (análise binária)
   continua valendo.
4. **Não existe forma de validar visualmente uma correção de `.anim`/`.mesh` sem abrir o jogo ou o Blender** —
   toda a investigação da seção 10 foi feita cega, só com matemática sobre o binário. Isso é arriscado (já errou
   uma vez achando que os picos eram sincronizados entre ossos) e vale muito a pena garantir BlenderMCP estável
   (ou aceitar testar direto no jogo, mais lento) antes de tentar de novo. **E o Blender não substitui o teste
   in-game**: ele ignora o shader da Clausewitz — o quadro vazio do shader de cabelo (seção 14) renderizava
   perfeitamente no Blender. Blender valida geometria/UV/skinning/animação; shader e render final, só o jogo.
5. **Animação nova** (veja "Animações novas no rig compartilhado" no topo de `future-plans.md`) deixou de ser
   necessária como *correção* (a distorção foi resolvida na seção 14 sem tocar nos `.anim`), mas continua na mesa
   como melhoria: com o `pPlaneShape6` quase rígido, o retrato tem movimento sutil — um `.anim` autoral poderia
   dar mais vida (respiração, piscada) já que o ferramental de validação visual está pronto.
