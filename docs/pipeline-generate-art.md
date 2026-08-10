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

## Peças do pipeline

- **`scripts/portrait-schema/`** — schema `zod` (`schema.ts`) que descreve o `portrait.json` **inteiro**
  (`name`/`gendered`/`rig`/`counts`/`modo`/`ancora` + `geracaoArt`), fonte de verdade única usada tanto por
  `generate-portraits` quanto por `generate-art` (substituiu validação manual duplicada nos dois). `.strict()`
  em todo objeto — chave desconhecida é erro, não é ignorada em silêncio. `vocabulario.ts` guarda os enums
  aceitos (etnia, cabelo, olho, corpo — cópia estática, não mais extraída ao vivo do ComfyUI; e dois vocabulários
  novos, exclusivos deste schema: `TIPOS`, o arquétipo visual da espécie, sem relação com `species_class` do
  jogo; e `ESTADOS_TORSO`, o que cobre o tronco). `gerar-json-schema.ts` gera `portrait.schema.json` (via
  `z.toJSONSchema()` nativo do zod v4) — artefato derivado, associado em `.vscode/settings.json` pra
  autocomplete/validação do `portrait.json` direto no editor; rode de novo se `schema.ts` mudar.
- **`scripts/generate-art/base.json`** — tudo que é fixo/global na geração (não configurável por espécie):
  estilo de arte, pose, enquadramento de câmera e expressão facial (travados pra sempre bater com o rig
  `ssm_shared`, evitando corte de braço/cabeça), e o negativo compartilhado de qualidade/anatomia.
- **`scripts/generate-art/prompt-builder.ts`** — compõe os prompts final (positivo e negativo) inteiramente em
  TypeScript a partir dos campos de `geracaoArt` + `base.json`, com ordem fixa e peso automático nos campos-âncora
  (`tipo`, `torso.state`, `eyes.color` — os que mais se perdem quando são só texto solto). Não depende de nenhum
  custom node externo pra isso — o texto pronto é injetado direto nos dois `CLIPTextEncode` do grafo (ver
  `scripts/generate-art/workflow.ts`).
- **`scripts/generate-art/merge.ts`** — mescla `base` → override de gênero → override de variante, raso por
  seção; `extra_prompt.positive`/`.negative` concatenam entre níveis (nunca "o último vence").
- **`scripts/comfyui/ssm_species_portrait_workflow.json`** (variante "base", padrão) e
  **`ssm_species_portrait_workflow_distilled.json`** (variante "distilled", ~5x mais rápida, útil pra iteração
  de prompt) — templates do workflow ComfyUI (formato API): UNET/CLIP/VAE do Flux.2 Klein fixos (um único
  arquivo de cada instalado hoje, sem checkpoint/LoRA configurável por espécie), `ReferenceLatent` encadeado por
  imagem de `referenceImage` (consistência visual, sem ControlNet/img2img/denoise), remoção de fundo com canal
  alfa. `scripts/generate-art/workflow.ts` clona o template e injeta o texto pronto, seed, `steps`/`cfg`/
  resolução e a cadeia de referência — os dois `CLIPTextEncode` não compõem nada internamente.
- **`geracaoArt` no `portrait.json`**: `base` (`tipo`, `torso`, `eyes`/`hair`/`person` quando fixos pra toda
  espécie, `extra_prompt`), `modelo` (`variant`: `"base"` ou `"distilled"`; `steps`/`cfg`/`aspectRatio` — sem
  checkpoint/LoRA/sampler, ver `scripts/portrait-schema/schema.ts`), `male`/`female`/`flat` (`referenceImage`
  como **lista** de imagens de referência/conceito por gênero + `variantes` nomeadas `"001"`..`"NNN"`, uma por
  indivíduo, contagem batendo exato com `counts.<gênero>` — conferido pelo schema via `.superRefine`). Cada
  variante aceita ainda um `seed` opcional (`noise_seed` do ComfyUI) — override manual, preenchido a posteriori
  (nunca decidido a priori) depois de gostar de um resultado gerado, pra fixá-lo permanentemente em vez de
  depender de lembrar `--seed` a cada execução. Precedência em `generate-art/index.ts` (`resolverSeed`,
  `generate-art/seed.ts`): `--seed` da CLI → `seed` da variante no `portrait.json` → seed determinística
  (`seedDeterministica`, hash de espécie+gênero+variante, o piso padrão quando nenhum dos dois está presente).
- **`--export-prompt`** — monta e imprime o prompt (positivo + negativo) de uma ou mais variantes sem enfileirar
  nada no ComfyUI, ciclo de debug instantâneo sem custo de GPU.
- Skill dedicada pra preencher `geracaoArt` de uma espécie via entrevista: `.claude/skills/gerar-geracao-arte/`
  (`/gerar-geracao-arte`).

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
