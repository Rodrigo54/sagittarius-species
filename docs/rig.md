# Rig compartilhado de retrato: anatomia, enquadramento e ferramental

Consolidação de tudo que se sabe sobre o rig animado compartilhado por quase todas as espécies do mod —
formato binário, anatomia real do mesh, como o enquadramento é derivado, e o ferramental externo (Blender)
usado pra trabalhar nele. Pra como construir/estender a *animação* em si (clipes, skinning, guia do zero), veja
`docs/rig-animacoes.md`. Pra a narrativa de como se chegou a cada decisão aqui, veja `docs/history/` (sessões
datadas) — este arquivo é só material de consulta, não conta a jornada.

## Visão geral: `sl_shared` vs. `ssm_shared`

Todo `entity` de todo `ssm_<espécie>_portrait.txt` aponta pra um rig (mesh + animações) compartilhado por várias
espécies ao mesmo tempo, dentro de `gfx/models/portraits/<rig>/` — veja "A técnica usada aqui" em
`docs/pipeline-portraits.md` pro histórico completo. Hoje existem dois:

- **`sl_shared/`** — o rig original, herdado do extinto Stellar Legion Mod. **Nenhuma espécie o usa hoje**, e
  ele nunca é modificado: sua UV desperdiça boa parte do canvas (cada um dos 6 planos do mesh lê só metade
  vertical da textura — ver seção 2.1). Continua versionado porque é a **entrada** de `bun run shared-rig` (o
  `ssm_shared` é derivado dele a cada execução) e porque é a única cópia restante desse mesh/animação, já que o
  mod de origem saiu do ar.
- **`ssm_shared/`** — fork do `sl_shared` com o mesh reduzido a **um único plano** (`pPlaneShape4`, escolhido
  entre os 6 originais por ser a camada de corpo com a menor distorção durante as animações — comparação
  completa na seção 2.1), UV remapeada pra usar o canvas inteiro, e **recortado no topo**: as linhas de vértice
  que correspondem à faixa que a câmera de retrato nunca captura são removidas do binário (ver seção 2.4).
  Canvas de `character_textures`: **980×780** (isotrópico — qualquer canvas novo precisa preservar essa
  proporção, e subir densidade é só multiplicar as duas dimensões pelo mesmo fator). É o rig de **todas as 18
  espécies** e o ponto de partida pra espécies novas.

Trocar o rig de uma espécie é editar o campo `rig` do `portrait.json` e rodar `bun run portrait` — o
enquadramento é derivado a cada execução, não existe passo de migração.

`ssm_shared/` é **derivado**, não editado à mão: `scripts/generate-shared-rig/` (comando `bun run shared-rig`)
lê `sl_shared/humanoid_01_portrait.mesh` e aplica, em sequência, `removerPlanosOcultos` (excisa os 5 planos não
mantidos), `corrigirShaderDoMesh` (garante o shader de corpo `PdxMeshPortrait` no plano mantido),
`corrigirUvDoMesh` (remapeia a UV do plano pra cobrir o canvas inteiro) e `recortarPlanoAcima` (remove as linhas
de vértice do topo nunca capturadas pela câmera, reindexando triângulos, skinning e `aabb`). Também copia e
renomeia `.asset`/`.gfx`/`.anim` pro namespace `ssm_`. Rodar de novo é seguro e idempotente: sempre regenera
`ssm_shared/` do zero a partir de `sl_shared/`, nunca edita `sl_shared/` em si. A lógica de patch binário
(`scripts/generate-shared-rig/mesh-uv.ts`) tem teste Bun (`mesh-uv.test.ts`) que confere a excisão, o
remapeamento de UV e o recorte byte a byte contra o arquivo real.

## 1. O formato binário pdxasset (`.mesh` e `.anim`)

Formato da Clausewitz Engine (Paradox), compartilhado por `.mesh` e `.anim`. Todo o conhecimento abaixo foi
confirmado empiricamente contra os arquivos reais do `sl_shared` (contagens batidas exatamente, patches testados
byte a byte, validação in-game).

### Estrutura de tokens

- **Header**: `@@b@` (4 bytes).
- **Objeto**: um ou mais `[` (a contagem de `[` é a **profundidade** na árvore) + nome terminado em `\0`.
  Ex.: `[object`, `[[pPlaneShape4`, `[[[mesh`.
- **Propriedade**: `!` + tamanho do nome (1 byte) + nome + tipo (1 byte: `i` int32, `f` float32, `s` string) +
  contagem (int32 LE) + payload.
  - `i`/`f`: payload = `contagem × 4` bytes.
  - `s`: contagem é o nº de strings (normalmente 1); cada string no payload = tamanho int32 LE (incluindo o
    `\0` final) + bytes + `\0`. Ex.: `PdxMeshPortrait` ocupa `10 00 00 00` + 16 bytes.

### Propriedades fatais de design (o que torna patches seguros)

- **Não existe tabela global de offsets** — o arquivo é um fluxo linear de tokens. Consequência: **remover ou
  emendar um intervalo contíguo de bytes é uma operação fechada** (nada mais no arquivo aponta pra posições
  absolutas). É isso que torna a excisão de subtree (`removerPlanosOcultos`) e a troca de string de tamanho
  diferente (`corrigirShaderDoMesh`) seguras.
- **Cada subtree `pPlaneShapeN` é autocontido** — mesh + esqueleto próprio (cópia idêntica dos 46 ossos em cada
  um dos 6), sem referência cruzada entre planos. Os `locator` do fim do arquivo não apontam pra plano nenhum.
- Patches que **não mudam contagens** (ex.: reescrever floats de `u0`) são in-place e preservam o tamanho do
  arquivo; patches que mudam tamanho exigem emenda (`Buffer.concat` das partes preservadas).

### O scanner deste repositório

`scripts/generate-shared-rig/mesh-uv.ts` tem o walker de tokens (`varrer`, exposto via `escanearPropriedades` e
`escanearObjetos`): devolve cada propriedade (nome, tipo, contagem, offset do payload, caminho na árvore) e cada
objeto (nome, profundidade, offset de início do subtree). O fim de um subtree = início do próximo objeto de
profundidade igual ou menor, ou EOF. Todo patch novo deve ser construído sobre esse scanner + teste Bun com
**reconstrução independente** (ver seção 4).

### Layout do `.mesh` (o que existe dentro de cada `pPlaneShapeN`)

- `mesh`: arrays `p` (posições, 121 vértices numa grade 11×11), `n` (normais), `u0` (UV, 242 floats), `tri`
  (600 índices = 200 triângulos), e o bloco `material` com `shader`, `diff`, `n`, `spec` (strings).
- `skeleton`: os ossos com transforms de repouso (`tx`) — é contra essa pose de repouso que o skinning deforma.
- `skin`: pesos/índices de skinning por vértice.
- Os nomes de textura em `material.diff` etc. são placeholders — o sistema de retratos do Stellaris injeta a
  textura via `texturefile` do `.txt` de portrait; **o `shader` do material, porém, é lido de verdade** (ver 2.2).

### Layout do `.anim`

- `info`: `fps` (~30.17 nos clipes herdados), `j` (nº de ossos, 46), e uma entrada por osso com a string `sa`
  (quais canais aquele osso anima: `t` translação, `q` rotação/quatérnio, `s` escala — ex.: `"tqs"`, `"ts"`,
  `"s"`) + a pose de repouso (`t`/`q`/`s`).
- `samples`: arrays **flat** `t`/`q`/`s` concatenados por osso, na ordem em que os ossos aparecem em `info`; cada
  osso contribui `total_frames × tamanho_do_canal` elementos **somente** nos canais listados no seu `sa`.
- O vínculo animação↔mesh é **por nome de osso** — qualquer `.anim` com os mesmos nomes de osso funciona no mesh
  (por isso os 4 clipes do `sl_shared` valem sem alteração pro `ssm_shared` de 1 plano; detalhes dos clipes em
  `docs/rig-animacoes.md`).

## 2. Anatomia do rig compartilhado (`sl_shared`)

### 2.1 Os 6 planos são dois conjuntos corpo/cabelo/roupa

A descoberta central: os 6 `pPlaneShapeN` **não** são 6 cópias do retrato — são **dois conjuntos completos do
sistema vanilla de camadas de retrato** (corpo + cabelo tingível + roupa trocável), empilhados em profundidade
(relevo 2.5D, era daí que vinha a paralaxe do rig original). Cada camada difere em **shader, metade da UV,
geometria e skinning** — qualquer escolha de plano precisa pesar os quatro:

| plano | shader | metade da UV (PDX V) | profundidade Y | curvatura | dimensões (X×Z) | skinning dominante | strain máx/mediana* |
|---|---|---|---|---|---|---|---|
| `pPlaneShape2` | `PdxMeshPortrait` (corpo) | baixo [0, 0.5] | +1.07..+5.04 (frente) | 3.97 | 20.21×19.26 | **83% na cadeia do braço direito** (mão 35%, incl. 51% nos cantos superiores do canvas) | 28.9% / 2.5% |
| `pPlaneShape3` | `PdxMeshPortraitHair` | baixo | −0.10..+0.53 | ~0.6 | ~18.9×18.8 | difuso (ombro/sobrancelha/peito) | 17.1% / 0.6% |
| **`pPlaneShape4`** | **`PdxMeshPortrait` (corpo)** | **cima [0.5, 1]** | **−0.54..−0.43** | **0.12 (plano)** | **18.90×18.86** | difuso (cabeça 16%, braço 13%, spine/sobrancelhas) | **10.1% / 0.3%** |
| `pPlaneShape5` | `PdxMeshPortraitClothes` | cima | −0.82..−0.70 | 0.12 | 18.90×18.86 | ≈ plano 4 | 10.2% / 0.3% |
| `pPlaneShape6` | `PdxMeshPortraitHair` | cima | −2.88..−0.28 (fundo) | 2.60 | 18.88×18.83 | o mais rígido | 6.9% / 0.1% |
| `pPlaneShape7` | `PdxMeshPortraitClothes` | baixo | −1.27..−1.14 | ~0.1 | ~18.9×18.8 | spine-dominante | 13.8% / 0.3% |

\* strain de aresta = variação relativa máxima do comprimento de cada aresta ao longo do clipe `happy` inteiro
(medido no Blender via depsgraph + numpy, ver 3.2). A **mediana** domina a percepção visual; o máximo indica os
piores rasgos localizados.

- A "metade de cima sempre vazia" da arte legada (825×1650) era a região de arte do **segundo conjunto**
  (corpo/roupa/cabelo de trás) — não uma metade morta.
- **O plano mantido no `ssm_shared` é o `pPlaneShape4`**: shader de corpo (renderiza arte comum sem patch),
  praticamente plano (nenhuma borda curva pra entrar no quadro), quase na origem (renderiza no tamanho
  comprovado in-game) e strain baixo. O `pPlaneShape2` distorcia (skinning de braço); o `pPlaneShape6` era
  cabelo (quadro vazio) e fundo/curvado (corte curvo transparente na cintura).
- **Topologia do plano**: grade regular **11×11** (121 vértices, 200 triângulos, 4 influências de osso por
  vértice). As linhas de vértice caem em `y_canvas` 2, 97, 195, 293, 390, 488, 586, 684, 782, 879, 976 — o eixo
  de altura é `p[1]` (0,666..19,522) e V cresce para baixo. No `ssm_shared` as duas primeiras linhas são
  removidas (ver 2.4), deixando **9×11**: 99 vértices e 160 triângulos. Que a linha 195 caia 4 px acima do
  limite medido de 199 é sorte com consequência prática — torna o recorte uma remoção pura, sem reposicionar
  vértice nem interpolar UV.

### 2.2 Shaders de retrato

- `PdxMeshPortrait` — renderiza a arte do `texturefile` diretamente. É o único adequado pra arte "tudo em um".
- `PdxMeshPortraitHair` / `PdxMeshPortraitClothes` — esperam máscara de tintura de cabelo / seleção de roupa;
  com arte comum renderizam **100% transparente** (in-game: quadro vazio, só canal alfa).
- **O Blender ignora completamente o shader da Clausewitz** — um mesh com shader de cabelo renderiza
  perfeitamente no Blender e invisível no jogo. Blender valida geometria/UV/skinning/animação; shader e render
  final, **só o jogo valida**.

### 2.3 Esqueleto, câmera e enquadramento

- 46 ossos (`Character5_*` pra corpo — Hips/Spine/Spine1/Spine2/Head/ombros/braços/mãos/pernas — mais
  `brows_L*`/`brows_R*`, `chest_L`/`chest_R`, `R_eye_1` etc.), idênticos em cada plano.
- A UV de cada plano é uma **projeção planar quase linear** da posição X/altura do vértice (R² > 0.998 num
  ajuste linear (x,z)→(u,v)) — dá pra projetar posições de osso pro espaço do canvas com esse ajuste (é assim
  que `assets/portraits/ssm_shared_reference.png` é gerado: grade da malha + 33 ossos que caem no canvas).
- A câmera de retrato do jogo é **em perspectiva**: planos mais fundos renderizam menores, e as bordas do mesh
  (fora do quadro no plano 2) podem entrar no enquadramento. Não temos os parâmetros da câmera.
- **O enquadramento, porém, não é opaco** — ver 2.4. Só a relação sprite↔canvas exige o jogo aberto; qual
  pedaço do sprite cada contexto de UI mostra está declarado nos `.gui` e sai por aritmética.
- Canvas do `ssm_shared`: **980×780** (era 980×976 antes do recorte do topo do plano). Cobre o plano recortado
  preservando a densidade anterior; ambas as dimensões múltiplas de 4 (exigência do BC3). A proporção é casada
  com o bounding box do plano na mesma densidade de pixel da textura vanilla equivalente
  (`human_female_body_01.dds` 420×512).

### 2.4 Enquadramento: o que a câmera mostra, e como se sabe

O enquadramento do retrato **não é uma câmera opaca do engine** — é declarado nos `.gui` do jogo. Cada contexto
de UI é um `containerWindowType` com `size` + `clipping = yes`, contendo um `iconType` que desenha um
`portraitType` numa `position` e `scale`. A janela visível é aritmética de layout, em coordenadas do sprite:

```text
topo_visível = (clip.y0 − icone.y) / scale
```

O número importa porque define o **teto permanente da composição** de toda arte futura. Duas partes, com custos
bem diferentes:

**Parte derivável dos arquivos (grátis, e se revalida a cada patch).** `scripts/measure-framing/index.ts`
percorre os `.gui` do jogo e resolve **122 contextos**, gravando `contextos.json` — roda de novo a cada patch da
Paradox, sem precisar do jogo aberto. Armadilhas que custaram erro e estão cobertas por teste:

- **Deslocamento de ancestral só conta depois que existe um recorte.** Acima do container que recorta, mover um
  nó move o retrato e a janela juntos, e a diferença — que é o que se mede — não muda. Acumular essas ressalvas
  descartava 27 contextos perfeitamente resolvíveis por causa de um `orientation = center` irrelevante.
- **O conjunto de sprites de retrato não é reconhecível por prefixo.** Lendo os blocos `.gfx` por
  `type = character` aparecem 17 `portraitType`, incluindo `GFX_contacts_portrait_character_masked` e
  `GFX_FC_portrait_character_masked` — tela de contatos e primeiro contato, que um filtro por
  `GFX_portrait_character` descartaria em silêncio. Cobertura foi de 90 para 122.
- **Ambiguidade é reportada, nunca chutada.** 4 contextos declaram `clipping` sem `size` e ficam fora da tabela;
  a tabela de `orientation` omite de propósito `top`, `left` e `right`, cuja grafia não diz se o outro eixo é
  borda ou centro.
- **"Sem recorte" é resultado, não falha.** 28 contextos não têm nenhum ancestral com `clipping`: exibem o
  sprite inteiro, e são eles que provam que o topo do sprite chega à tela.

**Parte que exige o jogo aberto (uma vez).** Nada nos arquivos diz qual pedaço do canvas de textura a câmera
captura. Mediu-se pintando a coordenada na **cor** de cada faixa de uma arte de calibração
(`scripts/generate-calibration/`), instalando-a nas espécies do `ssm_shared` e lendo screenshots por script. O
resultado está congelado em `scripts/measure-framing/ancora.json`, com as validações que o sustentam:

```text
y_canvas = 198.8 + 2.042 · y_sprite          x_canvas = −91.5 + 2.034 · x_sprite
```

Achados que importam mais que os números em si:

1. **O topo do sprite cai em `y_canvas ≈ 199`** (do canvas antigo de 976). A faixa `0..199` — 20,4% da altura —
   não chega à tela em contexto nenhum. É ela que `recortarPlanoAcima` remove.
2. **A projeção é isotrópica**: `k_x` 2,034 contra `k_y` 2,042, 0,4% de diferença. Confirma por medição a
   escolha do canvas quase quadrado, e obriga qualquer canvas novo a preservar a proporção.
3. **As variantes de `portraitType` não mudam a câmera.** Um ajuste feito sobre um contexto `close_up` prevê
   corretamente a escala de um contexto `gamesetup_mask` cujo `scale` de 0,8 foi lido do `.gui` e nunca entrou
   na conta. Uma âncora só serve para os 122 contextos.
4. Em X a câmera captura **mais largo que a textura** (`x_canvas = 0` cai em `x_sprite = 45`), então o canvas
   inteiro entra no quadro e **não há faixa morta horizontal a recuperar** — apertar a UV em U cortaria o
   enquadramento em vez de recuperar resolução.
5. O contexto mais agressivo começa a exibir em `y_canvas ≈ 457` (do canvas antigo) e a arte hoje começa em
   339 — **7 dos 90 contextos com janela já cortam o topo da arte atual**, e sempre cortaram. A faixa entre o
   contexto mais generoso e o mais agressivo é a **zona de sacrifício**: onde pontas de cabelo, chifres e
   ornamentos podem entrar sabendo que serão cortados às vezes, não sempre. Os números por contexto estão em
   `scripts/measure-framing/contextos.json`.

**Lições de método desta medição**, que valem para a próxima:

- **Localizar por cor não funciona.** A tolerância que o BC3 exige (±12 sobre passo 32) aceita 78% dos valores
  por canal, então ~58% dos pixels de uma tela qualquer decodificam por acaso. O que identifica a calibração é a
  **linearidade** — só nela o índice cresce monotonicamente por dezenas de pixels.
- **Codifique com Gray, não com base direta.** Mistura de duas faixas vizinhas é rejeitada pela tolerância, mas
  mistura de **três** nunca é rejeitável: a média de três níveis consecutivos é ela mesma um nível válido. Não há
  defesa local — só a escolha de fazer a resposta sair certa. Com Gray refletido (forma canônica, paridade sobre
  os dígitos já convertidos), 120/120 acertos com desvio 0; com base 8 direta, 90/120 e um erro de 19 faixas.
- **Duas medidas que fixam dois parâmetros não validam nada.** A confiança veio de três previsões que não
  alimentaram o ajuste (altura da região na tela, escala e base visível de um contexto de outra variante).
- **Divergência precisa de explicação, não de tolerância maior.** O topo visível do banner errou por 259 px — e a
  razão é que o sprite ali é `GFX_portrait_gamesetup_mask`, que desvanece as bordas, com a bandeira do império e
  o título por cima. A base do mesmo banner bate com 0,4%.

Se subir densidade um dia (arte em resolução maior disponível): multiplicar as duas dimensões do canvas em
`RIGS` (`scripts/generate-portraits/types.ts`) pelo mesmo fator e rodar `bun run portrait`. Nada mais — o
enquadramento é derivado a cada execução, sem recalibração manual.

### 2.5 Âncora vertical: bounding box ou cabeça

O enquadramento encosta a arte no topo do guia. **O que** encosta é escolha por espécie (`"ancora"` no
`portrait.json`): o bounding box do conteúdo (padrão) ou a **cabeça**.

O problema que motivou a alternativa: os `ssm_green_elves` têm chifres de veado. Ancorados pelo bounding box, os
chifres tomam o topo do guia e empurram a cabeça para baixo — o personagem renderiza menor e mais baixo que os
outros elfos. Com âncora na cabeça, o ornamento sobe para a faixa acima do guia, que é visível em parte dos
contextos e cortada nos mais agressivos: exatamente onde elemento sacrificável deve ficar.

**A heurística óbvia é falsa, e foi medida.** "Estrutura fina é estreita" parece razoável e leva ao lugar errado:
os chifres se espalham lateralmente e ocupam **82% da largura já na primeira linha** — mais que a própria cabeça.
Um detector por largura acharia o topo em 0. O que separa ornamento de crânio é **densidade**: galhos cobrem
pouca área dentro de um bounding box largo. `detectarInicioDoCorpo` mede a fração de pixels opacos por linha e
devolve a primeira que atinge 35% do máximo da imagem.

**A separação é larga, então o limiar não é crítico.** Medido no acervo (`bun
scripts/measure-framing/densidade-da-arte.ts`, que reproduz a tabela a qualquer momento):

| grupo | onde a silhueta fica sólida |
|---|---|
| cabelo normal (8 espécies) | 2,6% a 10,0% da altura |
| chifre / penacho / antena (8 espécies) | 12,7% a 25,2% |

**Sete espécies candidatas a `"ancora": "cabeca"`** (nenhuma aplicada ainda além de `ssm_green_elves` — decisão
pendente, visual, espécie a espécie): `knight` (25,2%), `octopus` (23,0%), `hastur` (19,6%), `necron` (16,7%),
`cyborg` (15,7%), `new_order` (14,6%) e `mercenary` (12,7%). O `octopus` é o caso a tratar com mais cuidado: se
aqueles 23% forem tentáculos (a característica da espécie, não um acessório sacrificável), empurrá-los pra faixa
de corte custa justamente o traço que identifica a espécie — o mesmo risco que `ssm_mermaids` resolve pelo outro
lado do quadro com `modo: "altura"`, pra não perder a transição pra cauda na borda inferior.

**A detecção é por imagem, e isso é o ponto.** Nos `ssm_green_elves`, os machos sobem os 144 px inteiros até o
topo do canvas e as fêmeas sobem 110, porque os chifres delas são menores — as cabeças ficam alinhadas entre si.
Um recuo fixo por espécie não faria isso, e cinco espécies têm variação interna acima de 10 pontos percentuais
(`knight` vai de 4,4% a 28,6%). Vale lembrar que "variantes desalinhadas entre si" é justamente o defeito que fez
`ssm_astral` ser revertida do `ssm_shared` na preparação da 1.8.0 (antes de ser remigrada) — e que um recuo fixo
por espécie não corrigiria.

**Por que não é o padrão.** Metade do acervo tem estrutura fina no topo, e nem toda é sacrificável — em algumas
ela é a característica da espécie (os tentáculos do `ssm_octopus`, com 23%, são o candidato óbvio). Empurrar isso
para a faixa de corte é o mesmo erro que tirou a cauda da sereia do quadro. O script de diagnóstico aponta as
candidatas; a decisão é visual, espécie a espécie, comparando o antes e o depois em `.portraits-framed/`.

**Consequência na validação.** Ancorar pela cabeça sobe a arte, e portanto sobe a base junto. A regra "a arte
precisa alcançar a borda inferior do canvas" passou a ser conferida sobre a geometria final (`y + altura`), e não
sobre a altura isolada assumindo que o topo é o guia. A subida também para no topo do canvas: acima dele não
existe plano, e subir mais só apagaria arte.

## 3. Ferramental

### 3.1 Blender + io_pdx_mesh + BlenderMCP

- Addon `io_pdx_mesh` v0.91 como extensão (`bl_ext.user_default.io_pdx_mesh`), **patchado no disco** pra
  Python 3.13/Blender 5.x (correções completas na subseção 3.1.1 abaixo). Import de mesh e de anim funcionam
  (`bpy.ops.io_pdx_mesh.import_mesh` / `import_anim`); o sistema de material do addon é incompatível — aplique
  material próprio via `bpy`.
- **Importar um `.mesh` com triângulos 100% degenerados crasha o Blender** (por isso a remoção estrutural venceu
  a degeneração). Após crash, o addon fica desabilitado — reabilitar via
  `addon_utils.enable('bl_ext.user_default.io_pdx_mesh', default_set=True, persistent=True)` e reconectar o
  servidor MCP manualmente (sidebar N → BlenderMCP → Connect, porta 9876).
- O importador **inverte o eixo V da UV** (convenção OpenGL vs DirectX): um plano que lê PDX V∈[0.5,1] aparece
  no Blender como V∈[0,0.5]. Ao comparar UV entre Blender e binário, confira sempre contra o binário.
- Importar um segundo `.mesh` numa cena que já tem um armature compatível **funde os esqueletos** — pra
  comparativos lado a lado, duplique o armature e reaponte os modifiers `ARMATURE` manualmente.
- Receita de estabilidade: sessão limpa + addon patchado no disco (sem monkeypatch em runtime) + evitar editar o
  addon com o Blender aberto.

#### 3.1.1 Patches aplicados pra Blender 5.2 / Python 3.13

O addon publicado mais recente, **0.91.0** (release de 2024-09-23, "Blender 4.2 support"), foi construído para
Python **3.11** e não acompanhou a remoção de APIs do Python 3.12+ nem do EEVEE Next. Documento de trabalho pra
embasar uma futura PR ao upstream [`ross-g/io_pdx_mesh`](https://github.com/ross-g/io_pdx_mesh); reúne as
incompatibilidades encontradas rodando no Blender 5.2 e as correções aplicadas localmente.

**Ambiente:** Blender 5.2.0 instalado via **Microsoft Store (MSIX)**, Python 3.13, addon v0.91.0 (formato
"extensão", `blender_manifest.toml`, `blender_version_min = 4.2.0`). Caminho da instalação (MSIX, virtualizado):
`%LOCALAPPDATA%\Packages\BlenderFoundation.Blender_ppwjx1n5r4v9t\LocalCache\Roaming\Blender Foundation\Blender\5.2\extensions\user_default\io_pdx_mesh\`;
config do addon em `%LOCALAPPDATA%\...\LocalCache\Local\io_pdx_mesh\settings.json` — a pasta de config **não**
fica no `%APPDATA%` literal nessa instalação, é redirecionada pra dentro de `Packages\...\LocalCache\`. Vale pra
qualquer edição manual de addon/extensão no Blender da Store. Instalação válida hoje: **só**
`5.2\extensions\user_default\io_pdx_mesh` (v0.91.0) — uma instalação legada em `scripts/addons/` (v0.9, patchada
à mão) foi removida.

Os números de linha abaixo referem-se ao código da v0.91.0; numa PR contra o `main` do upstream podem diferir.

**Correção 1 — `imp` removido no Python 3.12+ (impede o addon de carregar).** `ModuleNotFoundError: No module
named 'imp'` no import de topo — o módulo `imp` foi removido no Python 3.12. Em `io_pdx_mesh/__init__.py` (crítico
— sem isso o addon não sobe) e `io_pdx_mesh/maya_ui.py` (lado Maya, nunca importado pelo Blender, mas deveria ser
corrigido por consistência):

```diff
- from imp import reload
+ from importlib import reload
```

**Correção 2 — `Material.shadow_method`/`Material.blend_method` removidos no EEVEE Next (Blender 4.2+).**
`AttributeError` em `new_shader.shadow_method = "CLIP"` ao criar material durante o import. Em
`io_pdx_mesh/pdx_blender/blender_import_export.py`, função `create_shader`:

```diff
  new_shader.use_backface_culling = True
- new_shader.shadow_method = "CLIP"
- new_shader.blend_method = "CLIP"
+ if hasattr(new_shader, "shadow_method"):
+     new_shader.shadow_method = "CLIP"
+ if hasattr(new_shader, "blend_method"):
+     new_shader.blend_method = "CLIP"
```

**Correção 3 — `use_auto_smooth` removido no Blender 4.1+.** Já corrigido no upstream v0.91 (guardado por
`try/except AttributeError`). Nada a fazer.

**Correção 4 — sistema de shader/material — trabalho pendente, não corrigido de fato.** `create_shader`/
`create_material` montam a árvore de nós com tipos que mudaram: `ShaderNodeSeparateRGB` foi renomeado pra
`ShaderNodeSeparateColor` no Blender 3.3 (removido depois), mais renomes de sockets do Principled BSDF no
Blender 4.0. **Contorno atual (runtime, não serve pra PR):** monkeypatch de `create_material` pra no-op +
material próprio (xadrez/preenchimento translúcido) aplicado direto via `bpy`, sem passar pelo sistema de
material do addon — destrava import de mesh/viewport/render, mas abandona a reconstrução real do material PDX.
Correção de verdade exigiria trocar `ShaderNodeSeparateRGB` → `ShaderNodeSeparateColor` (com guard por versão),
revisar os sockets do Principled BSDF, e testar o caminho de material ponta a ponta.

Com as correções 1 e 2 o addon carrega e importa geometria no Blender 5.2; a 3 já vinha pronta; a 4 é o que
resta pra material funcionar sem contorno.

### 3.2 Técnicas de medição que funcionaram (Blender + numpy)

- **Strain de aresta por clipe**: avaliar o mesh deformado por frame via
  `obj.evaluated_get(depsgraph).to_mesh()`, medir `|comprimento(f) − comprimento(rest)| / comprimento(rest)`
  por aresta, agregar máx/mediana/p90. É o número que prevê rasgo visível — deslocamento absoluto não
  (translação uniforme não rasga).
- **Atribuição por osso**: peso total de cada vertex group × excursão do osso no clipe aponta os "arrastadores";
  mas atenção: excursão da *cabeça* do osso subestima efeito de rotação em vértices distantes do pivô.
- **Projeção osso→canvas**: ajuste linear (x,z)→(u,v) por mínimos quadrados sobre os vértices do plano
  (R² > 0.998), depois aplicar aos `head_local` dos ossos.

## 4. Lições de método

1. **Diagnóstico visual antes de qualquer patch binário.** A análise binária às cegas produziu uma "correção"
   (interpolação de picos de rotação) que piorou tudo — ver `docs/rig-animacoes.md` pro caso completo do sign
   flip de quatérnio. Toda hipótese sobre efeito visual precisa de confirmação visual (Blender pro que é
   geometria, jogo pro resto) antes de virar código.
2. **O jogo é o oráculo final.** Blender não valida shader, câmera, enquadramento nem render — três dos quatro
   bugs da saga de criação do `ssm_shared` (fantasma, quadro vazio, corte na cintura — ver
   `docs/history/2026-07-23-ssm-shared-rig.md`) só apareceram in-game. A espécie `ssm_test_rig` existe
   exatamente pra esse loop.
3. **Patch binário só com scanner + teste de reconstrução independente.** Todo patch em
   `scripts/generate-shared-rig/` tem teste Bun que reconstrói o resultado esperado por um caminho independente
   da implementação (emenda manual de segmentos, round-trip de shader) e compara byte a byte. É o que permite
   mexer num formato sem documentação oficial com confiança.
4. **Medir em vez de olhar.** "Parece estável" no Blender não detecta 2.5% de strain mediano; a métrica
   detecta — e foi ela que revelou que os 6 planos diferem 4x entre si e que o "mais rígido" nem sempre é o
   melhor (o plano 6 venceu no strain e perdeu em shader e geometria).
5. **Decisões multidimensionais: enumere as dimensões antes de escolher.** A escolha do plano falhou duas vezes
   por otimizar uma dimensão de cada vez (primeiro "o da frente", depois "o mais rígido"). A escolha certa só
   saiu quando skinning, shader e geometria entraram juntos na mesa (tabela da seção 2.1).
6. **q ≡ −q.** Sign flip de quatérnio não é defeito. Métrica de "salto angular" entre frames precisa normalizar
   o sinal antes de acusar anomalia (ver `docs/rig-animacoes.md`).
7. **`sl_shared/` é intocável** — é a entrada da derivação (e a única cópia restante do mesh/animação
   originais), então qualquer edição nele se propaga pro rig de todas as espécies na próxima regeração. Todo
   experimento vai pro fork derivado (`bun run shared-rig` regenera `ssm_shared/` do zero; nada lá é editado à
   mão).
