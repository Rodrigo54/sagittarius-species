# Pipeline de geração de arte via IA (`bun run art`)

Caminho **alternativo/opt-in** pra produzir os PNGs de origem que o pipeline de portraits consome (ver
`docs/pipeline-portraits.md`) — em vez de arte desenhada à mão, gera via IA (ComfyUI local, modelo
**Flux.2 Klein**) a partir de uma receita declarada em `geracaoArt` no `portrait.json` da espécie. Ausente na
maioria das espécies hoje; presente em `ssm_default` e `ssm_astral`.

**Quem roda `bun run art` (ou qualquer variante futura) é sempre o Rodrigo, nunca o Claude por conta
própria** — geração de imagem consome GPU local por vários segundos a minutos por variante, e rodar sem avisar
pode travar a máquina no meio de outra coisa. Claude pode editar `portrait.json`/prompts/pipeline, rodar
`--export-prompt` (não toca a GPU) e validações pontuais já combinadas explicitamente na conversa — mas
enfileirar geração de verdade no ComfyUI é decisão do Rodrigo, executada por ele.

## Interface de linha de comando

```
bun run art <slug> <male|female|flat> [options]

  -n, --variante <NNN>   variante(s) a gerar; repetível e aceita lista por vírgula
                         (`-n 001,004 -n 007`). Padrão: todas as declaradas
  -s, --seed [N]         fixa a seed da variante e **sempre grava o resultado** no portrait.json:
                         um inteiro fixa aquele valor, `default` volta pra determinística
                         (apagando a chave), sem valor sorteia uma
  -p, --promote          promove o lote do gênero de staging pra assets/portraits/<slug>/
  -e, --export-prompt    imprime os prompts sem enfileirar nada no ComfyUI (não gasta GPU)
  -h, --help             mostra a ajuda
```

O parsing usa **`commander`** (padrão de CLI do repositório): os posicionais são declarados com `.argument()`,
o gênero é validado por `.choices()`, e as combinações inválidas de flags são declaradas com `.conflicts()` —
`--promote` com `--variante`, `--promote` com `--export-prompt`, `--seed` com `--export-prompt`. A única
validação que sobra em código é "`--seed` exige exatamente uma variante em `--variante`" (para **todas** as
formas da flag, `default` inclusive), porque depende da quantidade, não da presença das flags — e porque uma
seed descreve uma imagem só. `-v` fica deliberadamente livre pra um futuro `--verbose`/`--version`.

`--variante` acumula por repetição em vez de ser variádico (`<NNN...>`) de propósito: variádico engoliria os
posicionais escritos depois da flag.

## Peças do pipeline

- **`scripts/portrait-schema/`** — schema `zod` (`schema.ts`) que descreve o `portrait.json` **inteiro**
  (`name`/`gendered`/`rig`/`counts`/`modo`/`ancora` + `geracaoArt`), fonte de verdade única usada tanto por
  `generate-portraits` quanto por `generate-art`. `.strict()` em todo objeto — chave desconhecida é erro, não é
  ignorada em silêncio. `campos.ts` isola os campos de **dado** de cada seção (sem `template`/`extra`): é deles
  que sai o conjunto de caminhos interpoláveis, sem lista paralela. `vocabulario.ts` guarda os enums aceitos
  (etnia, cabelo, olho, corpo — cópia estática, não extraída ao vivo do ComfyUI; mais `ARQUETIPOS`, o arquétipo
  visual da espécie, sem relação com `species_class` do jogo, e `ESTADOS_TORSO`, o que cobre o tronco).
  `interpolacao.ts` é o motor de template (ver "Sintaxe de template" abaixo) e `templates.ts` valida a sintaxe
  de todo `template`/`extra` já na leitura do arquivo. `gerar-json-schema.ts` gera `portrait.schema.json` (via
  `z.toJSONSchema()` nativo do zod v4) — artefato derivado, associado em `.vscode/settings.json` pra
  autocomplete/validação do `portrait.json` direto no editor; rode de novo se `schema.ts` mudar.
- **`scripts/generate-art/base.json`** — **a fonte única de todo texto de prompt**. Nenhuma frase de prompt mora
  em TypeScript. Quatro seções: `fixed` (estilo de arte, pose, enquadramento de câmera, expressão facial —
  travados pra bater com o rig `ssm_shared`, evitando corte de braço/cabeça — e o negativo compartilhado de
  qualidade/anatomia), `templates` (o template default de cada seção), `vocabulary` (o texto de cada valor de
  enum, com os dois lados: `positive` e, quando há oposto claro, `negative`) e `order` (quais fragmentos entram
  no prompt e em que posição). Reposicionar um fragmento ou reescrever uma frase é editar JSON.
- **`scripts/generate-art/base.ts`** — schema `zod` do `base.json`, construído a partir dos vocabulários de
  `portrait-schema`: cada enum exige **uma entrada por valor** e `.strict()` recusa entrada sobrando. É o que
  garante que um valor novo em `ESTADOS_TORSO` não passe sem texto (a garantia que os `Record` não-`Partial`
  davam em build time), agora falhando em `bun test` e em toda execução — inclusive `-e`, que não toca a GPU.
  Também confere as duas pontas da `order`: nenhuma entrada apontando pro vazio, nenhum texto órfão fora dela.
- **`scripts/generate-art/prompt-builder.ts`** — **motor**, sem texto de prompt: percorre `order` e resolve cada
  entrada (fixo, template de seção, `extra` de seção, ou texto de vocabulário do valor declarado). O peso de
  ênfase é escrito no próprio texto do `base.json`, com disciplina — só nas âncoras historicamente frágeis
  (`eyes.color`, `person.ethnicity`, posicionadas cedo pela `order`) e nas exclusões do negativo. Não depende de
  custom node externo — o texto pronto é injetado direto nos dois `CLIPTextEncode` do grafo (ver `workflow.ts`).
- **`scripts/generate-art/merge.ts`** — mescla `base` → override de gênero → override de variante, raso por
  seção; `extra` de cada seção concatena entre níveis (nunca "o último vence"), pra uma variante acrescentar um
  detalhe sem reescrever o texto da base.
- **`scripts/generate-art/validacao.ts`** — validação cruzada `portrait.json` × `base.json`, sobre **todas** as
  variantes de todos os gêneros declarados, mesmo quando a invocação pediu uma só (`-n 001`), e antes de
  enfileirar qualquer coisa. Duas regras: **cobertura** (todo campo declarado precisa ser referenciado por algum
  template/extra ativo ou posicionado como vocabulário na `order` — declarar `torso.secondary_color` sem que
  nada cite `<torso.secondary_color>` é erro, não uma cor que some em silêncio) e **obrigatoriedade**
  (placeholder fora de colchetes sem valor).
- **`scripts/comfyui/ssm_species_portrait_workflow_distilled.json`** (variante "distilled", **padrão** — 4
  passos, CFG=1, negativo descartado por `ConditioningZeroOut`) e **`ssm_species_portrait_workflow.json`**
  (variante "base" — 20 passos, CFG=5, negativo real, ~5x mais lenta, para o lote final quando a qualidade extra
  compensar) — templates do workflow ComfyUI (formato API): UNET/CLIP/VAE do Flux.2 Klein fixos (um único
  arquivo de cada instalado hoje, sem checkpoint/LoRA configurável por espécie), `ReferenceLatent` encadeado por
  imagem de `referenceImage` (consistência visual, sem ControlNet/img2img/denoise), remoção de fundo com canal
  alfa. `scripts/generate-art/workflow.ts` clona o template e injeta o texto pronto, seed, `steps`/`cfg`/
  resolução e a cadeia de referência — os dois `CLIPTextEncode` não compõem nada internamente.
  **A ordem de `referenceImage` importa** (`workflow.ts`, montagem da cadeia): cada imagem gera um node
  `ReferenceLatent` novo que recebe a *conditioning já processada pela anterior* como entrada (`ReferenceLatent(N)`
  → `conditioning: ReferenceLatent(N-1)`), empilhando na lista `reference_latents` — não é uma mistura simétrica
  das N imagens, é uma cadeia onde a **primeira imagem entra mais cedo e observadamente domina mais** o
  resultado que as seguintes (confirmado em teste real com `ssm_mermaids`, duas referências de paleta bem
  diferente — a primeira da lista puxou mais o resultado). Mesma dinâmica de "o que vem primeiro pesa mais" que
  já vale pra texto (`docs/history/2026-08-08-generate-art-schema-proprio.md`), só que aplicada a imagem: ao
  declarar mais de uma referência por gênero, a ordem é decisão de peso relativo, não uma lista arbitrária —
  coloque a referência que deve dominar em primeiro lugar.
- **`geracaoArt` no `portrait.json`**: `base` (`species` — só aqui, ver abaixo —, `torso`, `eyes`/`hair`/`person`
  quando fixos pra toda espécie), `modelo` (`variant`: `"distilled"` (padrão) ou `"base"`;
  `steps`/`cfg`/`aspectRatio` — sem checkpoint/LoRA/sampler, ver `scripts/portrait-schema/schema.ts`),
  `male`/`female`/`flat` (`referenceImage`
  como **lista** de imagens de referência/conceito por gênero + `variantes` nomeadas `"001"`..`"NNN"`, uma por
  indivíduo, contagem batendo exato com `counts.<gênero>` — conferido pelo schema via `.superRefine`). Cada
  variante aceita ainda um `seed` opcional (`noise_seed` do ComfyUI): a seed **da imagem que está em disco**
  naquela variante, gravada automaticamente por `--seed` (ver abaixo) ou colada à mão. Gravar é fixar — dali em
  diante, toda execução sem `--seed` reproduz aquela imagem. Precedência de **leitura** em `generate-art/index.ts`
  (`resolverSeed`, `generate-art/seed.ts`): `--seed` da CLI → `seed` da variante no `portrait.json` → seed
  determinística (`seedDeterministica`, hash de espécie+gênero+variante, o piso padrão quando nenhum dos dois
  está presente).
- **`--seed` é sempre uma declaração persistente** — não existe "seed só desta execução". As três formas geram a
  imagem e depois deixam o `portrait.json` descrevendo o que foi gerado:

  | invocação | seed usada | `variantes.NNN.seed` |
  | --- | --- | --- |
  | `-s 88767400` | 88767400 | passa a valer `88767400` |
  | `-s` (sem valor) | sorteada, mesma faixa de 32 bits da determinística | passa a valer a sorteada (é o *reroll*) |
  | `-s default` | determinística | a chave é **removida** (ou nada acontece, se já não existia) |
  | sem a flag | a do `portrait.json`, ou a determinística | intocado |

  Três invariantes sustentam isso. **(a)** A escrita acontece **depois** de o PNG existir em staging: se o ComfyUI
  falhar ou a execução for interrompida, o arquivo não é tocado — inclusive no `default`, em que a seed antiga
  sobrevive porque a imagem em disco ainda é a antiga. **(b)** `-s default` é idempotente: sem chave pra remover,
  `resolverSeed` colapsa a origem em `'deterministica'` e o arquivo não é reescrito, então rodar duas vezes não
  produz diff na segunda. **(c)** O campo descreve a imagem em disco, não a última coisa digitada na CLI — é o que
  o torna confiável pra reproduzir um retrato meses depois. A escrita parte do texto cru do arquivo
  (`generate-art/persistir-seed.ts`), nunca do objeto validado pelo zod — que reconstrói as chaves na ordem do
  *schema* e reordenaria o `portrait.json` inteiro; o diff sai com duas ou três linhas. Como `--seed` exige
  exatamente uma variante em `--variante`, cada execução mexe no máximo numa seed.
- **`--export-prompt`** — monta e imprime o prompt (positivo + negativo) de uma ou mais variantes sem enfileirar
  nada no ComfyUI, ciclo de debug instantâneo sem custo de GPU. Incompatível com `--seed` (nada é gerado, então
  não há seed a registrar) e com `--promote`.
- Skill dedicada pra preencher `geracaoArt` de uma espécie via entrevista: `.claude/skills/gerar-geracao-arte/`
  (`/gerar-geracao-arte`).

## Sintaxe de template

O texto de cada seção do prompt é um **template**: um texto com buracos que o valor da variante preenche. É o
que faz `torso.primary_color: "Salmon"` virar *"top de escamas em salmon"* em vez de um `"salmon"` solto no meio
do prompt, largando pra IA decidir o que é salmon.

```jsonc
"torso": {
  "state": "CroppedSleeved",
  "template": "cropped fish-scale armor top in <torso.primary_color>, high-waisted waistband in <torso.secondary_color>"
}
```

Duas construções, só:

- **`<secao.campo>`** — injeta o valor daquele campo do objeto **já mesclado** (`base` → gênero → variante), o
  que permite o template morar na `base` e a cor vir da variante. Resolve em duas camadas: se o campo tem texto
  de vocabulário no `base.json`, sai o texto (`<person.gender>` com `"Male"` → `"man"`); senão sai o valor cru
  em minúsculas (`<hair.primary_color>` com `"Salmon"` → `"salmon"`). **Fora de colchetes o campo é
  obrigatório**: não estar declarado é erro nomeando a variante, não um prompt silenciosamente incompleto.
- **`[trecho]`** — segmento opcional, **aninhável**. Só entra se todos os placeholders diretos dele resolverem;
  senão some inteiro, preposição e tudo — `"[ with <hair.secondary_color> highlights]"` não deixa
  *"with  highlights"* pra trás. Cada segmento carrega a pontuação que o liga ao vizinho; sobra de vírgula nas
  **bordas** do texto é limpa, mas não existe limpeza no meio (é justamente o que os colchetes resolvem).

Não há sintaxe de escape: `<` e `[` soltos são erro de sintaxe. Nenhum texto do pipeline os usa literalmente.

Sem `template`, a seção usa o **default** de `base.json` — é assim que uma espécie que não precisa de texto
próprio ainda ganha cabelo, olhos e físico no prompt. Com `template`, o default daquela seção é substituído: o
que a espécie escreve é o que sai, então um template de `species` que queira manter o arquétipo precisa citar
`<species.archetype>` (é literalmente o que o default faz).

Além do `template`, toda seção aceita um **`extra`**: texto acrescentado logo depois do template daquela seção,
mesma sintaxe, com ou sem placeholder. Diferente do `template` (onde o nível mais específico vence), o `extra`
**concatena** entre `base` → gênero → variante — a base declara o traço da espécie e a variante acrescenta o
seu, sem reescrever o texto inteiro.

### `species` só existe na `base`

`species` descreve a **espécie inteira** (arquétipo visual + o texto que a diferencia das outras que
compartilham o mesmo arquétipo); `person`/`hair`/`eyes`/`torso` descrevem o **indivíduo** e variam por variante.
Por isso `species` só é aceita em `geracaoArt.base` — declará-la num bloco de gênero ou numa variante é erro de
`.strict()`, com a chave nomeada.

### Onde cada validação mora

| validação | onde | quando |
| --- | --- | --- |
| sintaxe do template, caminho existente | schema `zod` (`portrait-schema/templates.ts`) | leitura de qualquer `portrait.json`, inclusive `bun run portrait` |
| cobertura de enum, `order` sem órfão | schema do `base.json` (`generate-art/base.ts`) | `bun test` e toda execução de `bun run art` |
| cobertura de campo, obrigatoriedade | `generate-art/validacao.ts` | antes de enfileirar, sobre todas as variantes de todos os gêneros |

Este pipeline (Flux.2 Klein) substituiu de vez um pipeline anterior baseado em SDXL clássico (checkpoint/LoRA/
ControlNet OpenPose/img2img), apagado do repositório. Relato completo de como o pipeline original foi criado e
depois evoluído (bugs, decisões, configuração testada — histórico, não reflete o código/schema atual):
`docs/history/2026-07-28-generate-art-v1.md` (sessão que criou o pipeline original baseado em `ComfyUI-OOP`),
depois `docs/history/2026-08-08-generate-art-schema-proprio.md` (sessão que aboliu essa dependência e desenhou o
schema `zod` que o pipeline atual ainda usa).

## Setup do ComfyUI local (Stability Matrix)

Modelos instalados, mapeamento de pastas e pegadinhas encontradas ao configurar o ambiente de geração local
(sessão de 2026-08-08, via skill `questione-me`).

### Ambiente

- **Instalação**: Stability Matrix em `D:\StabilityMatrix`, com o pacote ComfyUI em
  `D:\StabilityMatrix\Packages\ComfyUI` (v0.31.0 na instalação, frontend/templates atualizados — já tinha
  suporte nativo a modelos recentes).
- **GPU**: NVIDIA RTX 3060, **12GB VRAM** (Ampere — evitar formatos otimizados só pra Blackwell, como NVFP4, a
  não ser via dequant por software).
- **Python do ComfyUI**: `D:\StabilityMatrix\Packages\ComfyUI\venv\Scripts\python.exe` (venv próprio, separado
  do Python de sistema).
- **Servidor**: roda em `http://127.0.0.1:8188` (inicia/reinicia pela própria UI do Stability Matrix, aba do
  pacote ComfyUI).
- **Launch args**: `--preview-method auto`, `--use-pytorch-cross-attention`; sem `--lowvram`/`--cpu`/`--directml`
  — o gerenciamento automático de VRAM do ComfyUI (offload pra RAM) dá conta sem precisar mexer nessas flags.
- **Hugging Face**: usuário autenticado via `hf`/`huggingface-cli`, token em `~/.cache/huggingface/token`,
  visível tanto pro Python de sistema quanto pro venv do ComfyUI. **Login ≠ acesso a repositório gated** — mesmo
  autenticado, é preciso visitar a página do modelo gated no site e clicar em "Agree and access repository"
  manualmente antes de baixar (caso de `black-forest-labs/FLUX.1-dev`).

### Mapeamento de pastas de modelo (Stability Matrix ↔ ComfyUI)

O ComfyUI já reconhece essas pastas nativamente, sem precisar editar `extra_model_paths.yaml`:

| Tipo de arquivo | Pasta |
|---|---|
| Checkpoints "tudo em um" (unet+clip+vae juntos) | `Models/StableDiffusion/` |
| UNET/diffusion model isolado (`.safetensors` ou `.gguf`) | `Models/DiffusionModels/` |
| Text encoders (CLIP, T5, Qwen — `.safetensors` ou `.gguf`) | `Models/TextEncoders/` |
| VAE | `Models/VAE/` |
| LoRA | `Models/Lora/` |

**Workflows que devem aparecer na aba "Workflows" da UI do ComfyUI** vão em
`Packages/ComfyUI/user/default/workflows/` — **não** em `D:\StabilityMatrix\Workflows` (essa pasta existe mas
não é usada pelo painel nativo do ComfyUI). Templates oficiais prontos (ponto de partida útil pra qualquer
modelo novo) ficam em `Packages/ComfyUI/venv/Lib/site-packages/comfyui_workflow_templates_json/templates/*.json`.

### Modelos instalados

Todos com geração de imagem confirmada.

**1. Flux.1 Schnell** — checkpoint tudo-em-um `Models/StableDiffusion/flux_schnell.safetensors` (17GB, fp8).
Rápido (1-4 passos), licença Apache 2.0 (uso comercial ok). Workflow: `flux_schnell_teste.json`.

**2. Flux.1 Dev (via GGUF)** — UNET `fluxDevQ5KMGGUFQuantizationA_v10.gguf` (Q5_K_M, 8.4GB) + CLIP-L
`clip_l.safetensors` (246MB, de `comfyanonymous/flux_text_encoders`) + T5-XXL
`t5-v1_1-xxl-encoder-Q4_K_M.gguf` (2.9GB, de `city96/t5-v1_1-xxl-encoder-gguf`) + VAE `ae.safetensors` (335MB,
de `black-forest-labs/FLUX.1-dev`, **gated**, licença não-comercial). Exige custom node `ComfyUI-GGUF` (git
clone em `custom_nodes/` + `pip install -r requirements.txt`, reiniciar o ComfyUI pra carregar). Melhor
qualidade/prompt-following que o Schnell, mas mais lento (20 passos) e não-comercial. Workflow:
`flux_dev_gguf_teste.json` (montado manualmente — não existe template nativo pra unet+clip em GGUF combinados).

**3. Z-Image Turbo** — UNET `z_image_turbo_int8_convrot.safetensors` (6.2GB) + text encoder
`qwen_3_4b_fp8_mixed.safetensors` (5.6GB) + VAE `z_image_ae.safetensors` (335MB, renomeado de `ae.safetensors`
pra não colidir com o VAE do Flux.1). Fonte pública `Comfy-Org/z_image_turbo`, suporte nativo, sem custom node.
Workflow: `z_image_turbo_int8_teste.json`.

**4. Flux.2 Klein 4B (Base + Distilled)** — o modelo usado pelo pipeline `bun run art` deste repo. UNET Base
`flux-2-klein-base-4b.safetensors` (7.75GB, 20 passos, CFG=5 real, aceita prompt negativo) e UNET Distilled
`flux-2-klein-4b.safetensors` (7.75GB, 4 passos, CFG=1, bem mais rápido); text encoder compartilhado
`qwen_3_4b_fp4_flux2.safetensors` (3.85GB); VAE compartilhado `flux2-vae.safetensors` (335MB). Fonte pública
`Comfy-Org/flux2-klein`, suporte nativo, sem custom node. Workflows de teste: `flux2_klein_base_4b_teste.json`,
`flux2_klein_distilled_4b_teste.json`, `flux2_klein_compare_teste.json` (roda Base+Distilled juntos com o mesmo
prompt, pra comparar lado a lado). **Gotcha:** o template oficial combinado vem com o ramo Distilled em
`"mode": 4` (bypass) tanto no nó do subgrafo quanto no `SaveImage` — ao extrair um workflow isolado só do
Distilled, precisa virar `"mode": 0` nos dois nós, senão o ComfyUI recusa com "workflow não contém nenhum nó de
saída".

### Modelos adicionais disponíveis (fora do pipeline atual)

Snapshot do que mais está instalado localmente (`GET /object_info/CheckpointLoaderSimple` e `.../LoraLoader` em
`http://127.0.0.1:8188`, com o ComfyUI rodando) — checkpoints/LoRAs de um pipeline SDXL clássico anterior (ver
`docs/history/2026-07-28-generate-art-v1.md`), não usados pelo pipeline Flux.2 Klein atual, mas ainda no disco
e disponíveis caso um trabalho futuro precise de outro modelo. Pra atualizar esta lista, rode as mesmas duas
chamadas de novo e reescreva as seções abaixo; não há script dedicado pra isso.

Separado em "uso geral" e "ignorados por padrão" seguindo a mesma convenção da skill `gerar-geracao-arte`
(`.claude/skills/gerar-geracao-arte/SKILL.md`): checkpoints/LoRAs com nome claramente de conteúdo adulto ou de
likeness de celebridade só entram numa configuração se o usuário pedir explicitamente.

**Checkpoints (`models/checkpoints/`) — uso geral:** `ProtoGen_X3.4.safetensors`, `aresMix_v02.safetensors`,
`dungeonsAndDiffusion_v3.safetensors`, `flux_schnell.safetensors`, `icbinpICantBelieveIts_mid2024.safetensors`,
`jimEIDOMODE_version10.ckpt`, `juggernautXL_ragnarokBy.safetensors`, `mahuaXLTurbo_v20.safetensors`,
`mahuaXLTurbo10_v10.safetensors`, `majicmixAlpha_v20.safetensors`, `pilgrim2DSDXL_v60.safetensors`,
`pilgrimBASESDXL_v4GMG.safetensors`, `pilgrimMidjourney_v20.safetensors`, `pilgrimUnrealSDXL_v10.safetensors`,
`protovisionXLHighFidelity3D_releaseV660Bakedvae.safetensors`, `revAnimated_v2Rebirth.safetensors`,
`sdXL_v10RefinerVAEFix.safetensors`, `silverstarXL_v6.safetensors`, `silverstarXLFantasy_v4.safetensors`,
`tamarinXL_v10.safetensors`, `turboDiffusionXL_v12.safetensors`, `v2-1_768-ema-pruned.safetensors`,
`wildcardxXLFusion_fusionOG.safetensors`.

**Checkpoints ignorados por padrão** (conteúdo adulto/mature pelo nome): `airfucksBruteMix_v10.safetensors`,
`airfucksWildMix_v10.safetensors`, `homosomnium_v10.safetensors`, `homoveritas_v40.safetensors`,
`maturemalemix_v14.safetensors`, `virileFantasy_v11.safetensors`, `virileFusion_v10.safetensors`,
`virileMotion_v10.safetensors`, `virileReality_v10.safetensors`.

**LoRAs (`models/loras/`) — uso geral:** `DetailedEyes_V3.safetensors`, `EasyMalePortrait.safetensors`,
`Elf_Ears-000009.safetensors`, `Fantasy_Races_XL.safetensors`,
`LoRa_mermaid_dataset_bt04_ep016_09200_768_dim064_a032_LR00020_snr05_noise00_del.safetensors`,
`Perfect_Eyes.safetensors` (SD1.5 — não usar com checkpoint SDXL), `PerfectEyesXL.safetensors` (SDXL),
`add_detail.safetensors`, `epi_noiseoffset2.safetensors`, `merman.safetensors`.

**LoRAs ignorados por padrão** (likeness de celebridade pelo nome): `DylanSprayberryKM.safetensors`,
`anthonysemerad.safetensors`, `antonioostevens.safetensors`, `charlieputh.safetensors`, `harrystyles.safetensors`,
`jakipzxxx.safetensors`, `jimwookkim.safetensors`, `nicholasgalitzine.safetensors`, `noahcentineo.safetensors`,
`rhysmigu3l.safetensors`, `sebastian_bonnet-v1.safetensors`, `sebastiancroft.safetensors`,
`troyesivan.safetensors`, `zaynmalik.safetensors`.

### Metodologia reutilizável (receita pra instalar um modelo novo)

1. **Procure suporte nativo antes de qualquer coisa**: `grep` por `comfy/supported_models.py`,
   `comfy/model_detection.py`, `comfy_extras/*` e a pasta de templates oficiais pelo nome do modelo. Muitas
   vezes já existe suporte + template pronto, sem precisar de custom node.
2. **Confira se o repositório HF é gated antes de planejar downloads**: `HfApi().model_info(repo).gated`. Login
   não é acesso — repositórios gated exigem clicar em "Agree and access repository" no site, mesmo autenticado
   via CLI.
3. **Calcule o orçamento de VRAM** somando as precisões escolhidas de unet + text encoder + vae contra o teto
   de 12GB da 3060. O ComfyUI faz offload automático pra RAM quando não cabe, mas fica bem mais lento — vale a
   pena escolher quantização pra caber quando existir opção.
4. **Arquivos vão nas pastas nativas** (tabela acima) — não precisa editar `extra_model_paths.yaml`.
5. **Workflows visíveis na UI** vão em `Packages/ComfyUI/user/default/workflows/`.
6. **Ao adaptar um template oficial**: sempre confira se o `widgets_values` dos nós loader bate com o nome real
   do arquivo em disco (templates costumam referenciar um nome ligeiramente diferente do que acabou salvo,
   especialmente quando o arquivo já veio importado por outra ferramenta ou foi renomeado pra evitar colisão).
7. **Cuidado com `"mode"` nos nós** ao extrair um pedaço de um template com múltiplas variantes — alguns vêm com
   ramos desativados via `mode: 4` (bypass). Um nó de saída bypassado produz exatamente o erro "workflow não
   contém nenhum nó de saída".
8. **Custom node novo → reiniciar o ComfyUI** antes de tentar usar (não é hot-reload).
9. **Downloads grandes**: rodar em background e monitorar via tamanho do arquivo `.incomplete` no cache do HF
   (`~/.cache/huggingface/hub/models--ORG--REPO/blobs/*.incomplete`) — evita bloquear a conversa esperando.

Nenhuma informação sensível (tokens, senhas) fica registrada aqui — só o fato de que a autenticação HF já está
configurada e onde.
