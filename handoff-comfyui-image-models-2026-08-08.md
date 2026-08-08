# Handoff — Setup de modelos de geração de imagem no ComfyUI (Stability Matrix)

**Data:** 2026-08-08
**Sessão original:** instalação/configuração de 4 famílias de modelo no ComfyUI local, via skill `questione-me`.
**Próximo foco (conforme pedido do usuário):** usar o que foi aprendido aqui para criar instruções de uso e de criação de workflows a serem consultadas a partir de `D:\dev\stellaris-mods\sagittarius-species` — provavelmente para gerar assets de arte (retratos de espécie) pro mod usando os modelos já instalados.

Nenhum spec/PRD/ADR foi criado nesta sessão — todo o histórico de decisões vive só nesta conversa e neste documento. Não há commits/diffs envolvidos (o projeto `D:\StabilityMatrix` não é um repositório git).

---

## Ambiente

- **Instalação**: Stability Matrix em `D:\StabilityMatrix`, com o pacote ComfyUI em `D:\StabilityMatrix\Packages\ComfyUI` (v0.31.0 no início da sessão, com frontend/templates bem atualizados — já tinha suporte nativo a modelos recentes).
- **GPU**: NVIDIA RTX 3060, **12GB VRAM** (Ampere — evitar formatos otimizados só pra Blackwell, como NVFP4, a não ser via dequant por software).
- **Python do ComfyUI**: `D:\StabilityMatrix\Packages\ComfyUI\venv\Scripts\python.exe` (venv próprio, separado do Python de sistema em `C:\Python311`).
- **Servidor**: roda em `http://127.0.0.1:8188` (inicia/reinicia pela própria UI do Stability Matrix, aba do pacote ComfyUI).
- **Launch args atuais do ComfyUI** (Stability Matrix → settings.json → InstalledPackages): `--preview-method auto`, `--use-pytorch-cross-attention`; sem `--lowvram`/`--cpu`/`--directml`. O gerenciamento automático de VRAM do ComfyUI (offload pra RAM) deu conta de tudo que foi testado nesta sessão sem precisar mexer nessas flags.
- **Hugging Face**: usuário autenticado via `hf`/`huggingface-cli` (`hf auth whoami` → `Rodrigo54mix`), token em `~/.cache/huggingface/token`, visível tanto pro Python de sistema quanto pro venv do ComfyUI. **Importante**: login ≠ acesso a repositório gated — mesmo autenticado, é preciso visitar a página do modelo gated no site e clicar em "Agree and access repository" manualmente antes de baixar (aconteceu com `black-forest-labs/FLUX.1-dev`).

### Mapeamento de pastas de modelo (Stability Matrix ↔ ComfyUI)

O ComfyUI já reconhece essas pastas nativamente, sem precisar editar `extra_model_paths.yaml`:

| Tipo de arquivo | Pasta |
|---|---|
| Checkpoints "tudo em um" (unet+clip+vae juntos) | `Models/StableDiffusion/` |
| UNET/diffusion model isolado (`.safetensors` ou `.gguf`) | `Models/DiffusionModels/` |
| Text encoders (CLIP, T5, Qwen — `.safetensors` ou `.gguf`) | `Models/TextEncoders/` |
| VAE | `Models/VAE/` |
| LoRA | `Models/Lora/` |

**Workflows que devem aparecer na aba "Workflows" da UI do ComfyUI** vão em `Packages/ComfyUI/user/default/workflows/` — **não** em `D:\StabilityMatrix\Workflows` (essa pasta existe mas não é usada pelo painel nativo do ComfyUI).

Templates oficiais prontos (ponto de partida útil pra qualquer modelo novo) ficam em:
`Packages/ComfyUI/venv/Lib/site-packages/comfyui_workflow_templates_json/templates/*.json`

---

## Modelos instalados e testados nesta sessão

Todos com geração de imagem confirmada pelo usuário.

### 1. Flux.1 Schnell
- Checkpoint tudo-em-um: `Models/StableDiffusion/flux_schnell.safetensors` (17GB, fp8 — unet+clip+t5+vae num arquivo só)
- Workflow: `flux_schnell_teste.json`
- Rápido (1-4 passos), licença Apache 2.0 (uso comercial ok)
- Gotcha: o template nativo esperava o nome `flux1-schnell-fp8.safetensors`; foi corrigido pra apontar pro arquivo real já existente.

### 2. Flux.1 Dev (via GGUF)
- UNET: `Models/DiffusionModels/fluxDevQ5KMGGUFQuantizationA_v10.gguf` (Q5_K_M, 8.4GB)
- CLIP-L: `Models/TextEncoders/clip_l.safetensors` (246MB) — de `comfyanonymous/flux_text_encoders` (público)
- T5-XXL: `Models/TextEncoders/t5-v1_1-xxl-encoder-Q4_K_M.gguf` (2.9GB) — de `city96/t5-v1_1-xxl-encoder-gguf` (público)
- VAE: `Models/VAE/ae.safetensors` (335MB) — de `black-forest-labs/FLUX.1-dev` (**gated**, licença não-comercial)
- **Custom node necessário**: `ComfyUI-GGUF` (git clone em `custom_nodes/` + `pip install -r requirements.txt` no venv do ComfyUI). Exige **reiniciar o ComfyUI** pra carregar.
- Workflow: `flux_dev_gguf_teste.json` — montado manualmente (não existe template nativo pra unet+clip em GGUF combinados)
- Melhor qualidade/prompt-following que o Schnell, mas mais lento (20 passos) e não-comercial

### 3. Z-Image Turbo
- UNET: `Models/DiffusionModels/z_image_turbo_int8_convrot.safetensors` (6.2GB)
- Text encoder: `Models/TextEncoders/qwen_3_4b_fp8_mixed.safetensors` (5.6GB)
- VAE: `Models/VAE/z_image_ae.safetensors` (335MB) — **renomeado** de `ae.safetensors` pra não colidir com o VAE do Flux.1
- Fonte: `Comfy-Org/z_image_turbo` (público, sem gate)
- Suporte nativo do ComfyUI, **sem** custom node
- Workflow: `z_image_turbo_int8_teste.json` (cópia do template oficial `image_z_image_turbo_int8.json`, só com o nome do VAE corrigido)

### 4. Flux.2 Klein 4B (Base + Distilled)
- UNET Base: `Models/DiffusionModels/flux-2-klein-base-4b.safetensors` (7.75GB) — 20 passos, CFG=5 real, aceita prompt negativo
- UNET Distilled: `Models/DiffusionModels/flux-2-klein-4b.safetensors` (7.75GB) — 4 passos, CFG=1, bem mais rápido
- Text encoder (compartilhado pelas duas variantes): `Models/TextEncoders/qwen_3_4b_fp4_flux2.safetensors` (3.85GB)
- VAE (compartilhado): `Models/VAE/flux2-vae.safetensors` (335MB)
- Fonte: `Comfy-Org/flux2-klein` (público, sem gate)
- Suporte nativo, sem custom node
- Workflows: `flux2_klein_base_4b_teste.json`, `flux2_klein_distilled_4b_teste.json`, `flux2_klein_compare_teste.json` (o último roda Base+Distilled juntos com o mesmo prompt, pra comparar lado a lado)
- **Gotcha grande**: o template oficial combinado vem com o ramo Distilled com `"mode": 4` (bypass) tanto no nó do subgrafo quanto no `SaveImage` — desativado por padrão, esperando ativação manual na UI. Ao extrair um workflow isolado só do Distilled, isso teve que ser corrigido pra `"mode": 0` nos dois nós, senão o ComfyUI recusa com "workflow não contém nenhum nó de saída".

---

## Metodologia reutilizável (receita pra instalar um modelo novo neste ComfyUI)

1. **Procure suporte nativo antes de qualquer coisa**: `grep` por `comfy/supported_models.py`, `comfy/model_detection.py`, `comfy_extras/*` e a pasta de templates oficiais pelo nome do modelo. Muitas vezes já existe suporte + template pronto, sem precisar de custom node.
2. **Confira se o repositório HF é gated antes de planejar downloads**: `HfApi().model_info(repo).gated`. Login não é acesso — repositórios gated exigem clicar em "Agree and access repository" no site, mesmo autenticado via CLI.
3. **Calcule o orçamento de VRAM** somando as precisões escolhidas de unet + text encoder + vae contra o teto de 12GB da 3060. O ComfyUI faz offload automático pra RAM quando não cabe, mas fica bem mais lento — vale a pena escolher quantização pra caber quando existir opção.
4. **Arquivos vão nas pastas nativas** (tabela acima) — não precisa editar `extra_model_paths.yaml`.
5. **Workflows visíveis na UI** vão em `Packages/ComfyUI/user/default/workflows/`.
6. **Ao adaptar um template oficial**: sempre confira se o `widgets_values` dos nós loader bate com o nome real do arquivo em disco (templates costumam referenciar um nome ligeiramente diferente do que acabou salvo, especialmente quando o arquivo já veio importado por outra ferramenta ou foi renomeado pra evitar colisão).
7. **Cuidado com `"mode"` nos nós** ao extrair um pedaço de um template com múltiplas variantes — alguns vêm com ramos desativados via `mode: 4` (bypass). Um nó de saída bypassado produz exatamente o erro "workflow não contém nenhum nó de saída".
8. **Custom node novo → reiniciar o ComfyUI** antes de tentar usar (não é hot-reload).
9. **Automação de navegador (Claude in Chrome) foi instável** contra a aba local do ComfyUI nesta sessão (erro persistente "Frame with ID 0 is showing error page", mesmo com o servidor respondendo normalmente por HTTP). Vale tentar de novo numa sessão nova, mas não confiar cegamente — o fallback que funcionou foi preparar tudo via script e pedir pro usuário testar manualmente na própria aba dele, reportando o resultado.
10. **Downloads grandes**: rodar em background (`run_in_background: true` no Bash) e monitorar via tamanho do arquivo `.incomplete` no cache do HF (`~/.cache/huggingface/hub/models--ORG--REPO/blobs/*.incomplete`) — evita bloquear a conversa esperando.

---

## Estado final

7 workflows de teste funcionando, todos em `D:\StabilityMatrix\Packages\ComfyUI\user\default\workflows\`:
`flux_schnell_teste`, `flux_dev_gguf_teste`, `z_image_turbo_int8_teste`, `flux2_klein_base_4b_teste`, `flux2_klein_distilled_4b_teste`, `flux2_klein_compare_teste`.

Nenhuma pendência aberta desta parte do trabalho — tudo testado e confirmado pelo usuário.

---

## Suggested skills (pra quem pegar o trabalho em `D:\dev\stellaris-mods\sagittarius-species`)

- **`questione-me`** — se o próximo passo for montar um pipeline de geração de assets pro mod (ex: automatizar geração de retratos por espécie, decidir resolução/estilo padrão, escolher entre os 4 modelos instalados pra esse caso de uso) envolvendo decisões reais em aberto, vale rodar essa skill de novo em vez de simplesmente implementar — foi o que guiou toda esta sessão com bons resultados (perguntas uma de cada vez, sempre com opções e recomendação, convergência confirmada antes de agir).
- **`run`** — se o projeto do mod tiver algum app/build pra rodar e visualizar (ex: testar o mod no jogo, rodar um script de validação de assets), essa skill sabe descobrir e disparar o comando certo.
- Não existe skill dedicada a ComfyUI/geração de imagem neste ambiente — a seção "Metodologia reutilizável" acima **é** o playbook a seguir pra qualquer trabalho futuro de instalar/configurar modelo novo ou montar workflow novo.

Nenhuma informação sensível (tokens, senhas) foi incluída neste documento — apenas o fato de que a autenticação HF já está configurada e onde.
