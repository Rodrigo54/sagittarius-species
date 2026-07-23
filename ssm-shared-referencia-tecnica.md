# Referência técnica: formato pdxasset, anatomia do rig compartilhado e lições de método

Consolidação de tudo que foi aprendido nas sessões de criação do `ssm_shared` (2026-07, ver
`ssm-shared-historico-da-sessao.md` pra narrativa completa da jornada). Diferente do histórico — que conta *como*
se chegou aqui — este arquivo é **material de consulta**: os fatos sobre o formato binário, a anatomia real do rig
e as lições de processo que custaram caro descobrir. Vale como ponto de partida pra qualquer trabalho futuro
sobre `.mesh`/`.anim` neste repositório.

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
  (por isso os 4 clipes do `sl_shared` valem sem alteração pro `ssm_shared` de 1 plano).

## 2. Anatomia do rig compartilhado (`sl_shared`)

### 2.1 Os 6 planos são dois conjuntos corpo/cabelo/roupa

A descoberta central da saga: os 6 `pPlaneShapeN` **não** são 6 cópias do retrato — são **dois conjuntos
completos do sistema vanilla de camadas de retrato** (corpo + cabelo tingível + roupa trocável), empilhados em
profundidade (relevo 2.5D, era daí que vinha a paralaxe do rig original). Cada camada difere em **shader,
metade da UV, geometria e skinning** — qualquer escolha de plano precisa pesar os quatro:

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
  (fora do quadro no plano 2) podem entrar no enquadramento. Não temos os parâmetros da câmera — o
  enquadramento só é validável in-game (a arte xadrez `ssm_test_rig/001.png`, com marcadores de canto coloridos,
  existe pra calibrar isso empiricamente por screenshot se precisar).
- Canvas do `ssm_shared`: **980×976** (proporção 1.004, casada com o bounding box do plano 4 na mesma densidade
  de pixel da textura vanilla equivalente, `human_female_body_01.dds` 420×512). Ambas as dimensões múltiplas de
  4 (exigência do BC3).

### 2.4 As animações herdadas

- 4 clipes (`happy`, `happy_2`, `sad`, `sad_2`), ~180 frames @ ~30 fps, byte-idênticos entre `sl_shared` e
  `ssm_shared`. **Nunca tiveram defeito** — a "distorção" era o skinning do plano 2 exposto por arte cheia.
- Os "picos de rotação de 1 frame" detectados na análise binária (saltos de ~90-100° periódicos, fase própria
  por osso) são quase certamente **sign flips de quatérnio** (q e −q são a mesma rotação 3D — métricas ingênuas
  de ângulo acusam salto onde não há movimento). A "correção" que interpolava sobre eles **destruiu dados reais**
  e rasgou o retrato in-game. Nunca "conserte" picos de quatérnio sem validação visual.
- O movimento herdado é grande em ossos sem peso no plano mantido (ex.: `Character5_LeftHand` percorre ~7
  unidades no `happy` — ~35% da largura do mesh) — irrelevante pro plano 4, que quase não sente as mãos.

## 3. Ferramental

### 3.1 Blender + io_pdx_mesh + BlenderMCP

- Addon `io_pdx_mesh` v0.91 como extensão (`bl_ext.user_default.io_pdx_mesh`), **patchado no disco** pra
  Python 3.13/Blender 5.x (detalhes em `io_pdx_mesh-atualizacao-blender-5.2.md` e na memória do projeto). Import
  de mesh e de anim funcionam (`bpy.ops.io_pdx_mesh.import_mesh` / `import_anim`); o sistema de material do
  addon é incompatível — aplique material próprio via `bpy`.
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
   (interpolação dos picos) que piorou tudo — e o modelo mental dela (picos = defeito) estava simplesmente
   errado. Toda hipótese sobre efeito visual precisa de confirmação visual (Blender pro que é geometria, jogo
   pro resto) antes de virar código.
2. **O jogo é o oráculo final.** Blender não valida shader, câmera, enquadramento nem render — três dos quatro
   bugs da saga (fantasma, quadro vazio, corte na cintura) só apareceram in-game. A espécie `ssm_test_rig`
   existe exatamente pra esse loop.
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
   o sinal antes de acusar anomalia.
7. **`sl_shared/` é intocável** — 15+ espécies publicadas dependem dele byte a byte. Todo experimento vai pro
   fork derivado (`bun run shared-rig` regenera `ssm_shared/` do zero; nada lá é editado à mão).
