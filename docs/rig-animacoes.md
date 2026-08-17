# Animação do rig compartilhado: clipes herdados e como construir do zero

Pré-requisito de leitura: `docs/rig.md` (formato binário, anatomia do rig herdado, ferramental Blender) — este
arquivo não repete aquilo, só aplica ao tema específico de animação.

## Os clipes herdados

- 4 clipes (`happy`, `happy_2`, `sad`, `sad_2`), ~180 frames @ ~30 fps, byte-idênticos entre `sl_shared` e
  `ssm_shared`. **Nunca tiveram defeito** — a "distorção" que uma sessão inteira investigou era o skinning do
  plano 2 (não o plano 4 mantido) exposto por arte cheia.
- Os "picos de rotação de 1 frame" detectados numa análise binária às cegas (saltos de ~90-100° periódicos, fase
  própria por osso) são quase certamente **sign flips de quatérnio** (q e −q são a mesma rotação 3D — métricas
  ingênuas de ângulo acusam salto onde não há movimento). A "correção" que interpolava sobre eles **destruiu
  dados reais** e rasgou o retrato in-game. Nunca "conserte" picos de quatérnio sem validação visual — normalize
  o sinal antes de acusar anomalia.
- O movimento herdado é grande em ossos sem peso no plano mantido (ex.: `Character5_LeftHand` percorre ~7
  unidades no `happy` — ~35% da largura do mesh) — irrelevante pro plano 4, que quase não sente as mãos.

## Criar um rig de retrato do zero: mesh e animação autorais

Guia de partida pra construir um rig de retrato animado **completo e autoral** — mesh, esqueleto, skinning e
`.anim` — sem herdar nada do Stellar Legion Mod, usando tudo que a saga do `ssm_shared` ensinou. Pré-requisito
de leitura: `docs/rig.md` (formato binário, anatomia do rig herdado, ferramental) — este guia não repete
aquilo, só aplica.

### Por que do zero (e por que agora dá)

O `ssm_shared` atual é um *derivado*: um plano recortado de um rig alheio, com esqueleto de 46 ossos desenhado
pra um corpo 3D, skinning difuso que ninguém autorou pra este uso, e proporção de canvas ditada pela geometria
herdada. Funciona — mas cada limitação dele veio de herança, não de escolha. Construindo do zero, todas viram
escolhas:

- **Mesh**: um plano reto (a geometria curva do rig herdado só causou bugs), com a densidade de grade e a
  proporção que *nós* definirmos.
- **Esqueleto**: só os ossos que fazem sentido pra um retrato 2D (raiz, torso/peito, cabeça, sobrancelhas,
  olhos) — uma dúzia com propósito, em vez de 46 herdados dos quais mãos e pernas são peso morto.
- **Skinning**: pesos pintados por região, localizados e previsíveis — a causa raiz de *toda* a distorção da
  saga foi skinning difuso/errado que ninguém desenhou pra arte cheia.
- **Animação**: clipes autorais mirando exatamente esses ossos.

E dá pra fazer porque a saga já entregou: o formato binário é conhecido e validável por script, o
`io_pdx_mesh` importa/exporta mesh e anim no Blender, o loop de validação (Blender → scanner → xadrez in-game)
está rodado, e o contrato de registro (`.asset`/`.gfx`/portrait `.txt`) está mapeado.

### O que é fixo (contrato com o jogo) e o que é livre

**Fixo — o jogo dita:**

- A **câmera de retrato** é fixa e em perspectiva, e não temos os parâmetros dela. O enquadramento comprovado
  in-game é o do volume que os planos herdados ocupam — o caminho seguro é **casar o bounding box do plano 4**
  (X −9.2..+9.7, Z +0.7..+19.5, profundidade Y ≈ −0.5, em unidades do mesh) e calibrar com a arte xadrez no
  primeiro teste in-game. Fora desse volume, é chute.
- O **shader** do material precisa ser `PdxMeshPortrait` (os de cabelo/roupa não renderizam arte comum).
- A textura vem do `texturefile` do portrait `.txt` (BC3, dimensões múltiplas de 4); `diff`/`n`/`spec` do
  material são placeholders (`nonormal.dds`, `nospec.dds`).
- O vínculo `.anim`↔mesh é por **nome de osso**; estados/`chance`/`animation_blend_time` vêm do `.asset`
  (entity), animações registradas no `.gfx`/`.asset` como hoje.
- Normais/winding voltados pra câmera (mesma orientação dos planos herdados: normal média −Z em coordenadas
  PDX).

**Livre — nós escolhemos:**

- Densidade da grade do plano (o herdado usa 11×11 = 121 vértices; uma grade mais densa, ex.: 21×21, deforma
  mais suave por quase nenhum custo).
- Proporção do canvas — **decidir primeiro**, e construir o plano com essa proporção. Do zero não existe o
  descompasso herdado; dá inclusive pra usar a proporção vanilla (840×1024) que a sessão antiga descartou por
  causa do mesh herdado, ou manter 980×976 pra compartilhar arte com o `ssm_shared`.
- Esqueleto: quantidade, nomes, posições e hierarquia dos ossos.
- Skinning: pesos por região, pintados no Blender com a arte de referência visível.
- Clipes: quantos, duração, fps, conteúdo.

### Esqueleto proposto (ponto de partida, não dogma)

Uma dúzia de ossos com papel claro, posicionados sobre as regiões do canvas (use
`assets/portraits/ssm_shared_reference.png` e a arte de teste como guia visual):

| osso | papel | animação típica |
|---|---|---|
| `root` | âncora, peso das bordas | nada (estabilidade das bordas do quadro) |
| `spine` | torso baixo | balanço lento |
| `chest` | peito | respiração (escala/translação sutil) |
| `shoulder_l` / `shoulder_r` | ombros | acompanham a respiração |
| `head` | cabeça | inclinação leve |
| `brow_l` / `brow_r` | sobrancelhas | expressão, piscada |
| `eye_l` / `eye_r` | olhos | micro-movimento (opcional) |
| `hair` | massa de cabelo | balanço com atraso (opcional) |

Lições da saga aplicadas: **bordas do canvas com peso 1.0 no `root`** (cantos soltos com peso de osso móvel
foram a causa do retrato "nadar"); peso de cada osso **localizado** na sua região com falloff suave; nenhum
osso que você não pretende animar.

### Fluxo recomendado

1. **Decidir canvas e proporção** (ver "Livre" acima). Atualizar/planejar a entrada em `RIGS`
   (`scripts/generate-portraits/types.ts`) pro rig novo (entity + resolução).
2. **Construir o mesh no Blender por script determinístico** (`bpy`): grade plana N×N com o bounding box do
   plano 4, UV planar direta cobrindo [0,1]² (sem metades), material com a arte de teste. Script versionado —
   o mesh é regenerável por parâmetro, não um artefato manual.
3. **Esqueleto + skinning**: armature com os ossos da tabela (posições também por script, projetadas das
   regiões do canvas); pesos pintados no Blender (weight paint é julgamento visual — essa parte é manual mesmo)
   ou gerados por falloff paramétrico se preferir tudo determinístico.
4. **Validar deformação antes de animar**: pose manual exagerada em cada osso + a métrica de strain de aresta
   (`docs/rig.md`, seção 3.2) pra conferir que cada osso arrasta só a sua região.
5. **Animação**: Action por script `bpy` (senos/pulsos paramétricos, loop fechado — primeiro e último frame
   idênticos), ~30 fps, ~180 frames. Orçamento de strain: mediana ≤ 0.3% / máx ≤ 10% (o baseline comprovado
   estável do plano 4).
6. **Exportar** via `io_pdx_mesh`: `export_mesh` (com skeleton) + `export_anim` por clipe. **Validar o binário
   com o scanner** (`escanearPropriedades`/`escanearObjetos` de `mesh-uv.ts`): header, um objeto de shape com
   `p`/`n`/`u0`/`tri`/`material`/`skeleton`/`skin`, shader `PdxMeshPortrait`, UV em [0,1]², contagens de
   `samples` do `.anim` batendo com `frames × canal × ossos`. Re-importar num Blender limpo (round-trip) — o
   caminho de export do addon foi pouco exercitado até aqui, confiança se constrói aí.
7. **Integrar**: os arquivos exportados são **fonte** (versionados em `assets/`, ex.: `assets/rig/`), e um
   pipeline `scripts/generate-<rig-novo>/` (padrão do `CLAUDE.md`: pasta própria, `index.ts` como entry point)
   copia pro `mod/.../gfx/models/portraits/<rig>/` e gera os `.asset`/`.gfx` a partir de templates — mesmo
   desenho do `generate-shared-rig`, sem os patches binários (não há mais nada pra corrigir: o mesh já nasce
   certo).
8. **Registrar e testar in-game**: entity nova nos templates, espécie de teste apontando pro rig novo
   (`portrait.json`), primeiro teste com a **arte xadrez** (marcadores de canto calibram o enquadramento real
   da câmera — se o volume do mesh precisar de ajuste fino, é um parâmetro do script do passo 2, não edição
   manual). Depois arte real. O jogo é o oráculo final (shader/render/enquadramento).

### Armadilhas conhecidas

- **Não invente o volume do mesh**: a câmera é fixa e desconhecida — comece do bounding box comprovado e
  calibre com o xadrez. Um plano bonito no lugar errado é um quadro vazio ou cortado.
- **Bordas sem âncora**: todo vértice de borda com peso total 1.0 no `root` parado — senão o quadro inteiro
  respira junto.
- **Exportador menos maduro que o importador**: valide binário + round-trip antes do jogo; se o export de mesh
  do addon travar em algo, o formato é conhecido o bastante pra gerar o `.mesh` direto por script Bun (o
  scanner já lê tudo; escrever é o mesmo token stream ao contrário).
- **Blender não valida shader/render** — nunca pule o teste in-game.
- **q ≡ −q** nas análises de `.anim` (sign flips são normais; não "conserte").
- **`sl_shared/` e `ssm_shared/` ficam como estão** — o rig novo é uma entity/pasta nova, opt-in por espécie
  via `portrait.json`, com fallback garantido nos rigs existentes.
