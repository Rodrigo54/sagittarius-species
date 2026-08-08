# Imagens

## Opções para salvar imagens dds

| compressed                      |     |
| ------------------------------- | --- |
| BC1 (Linear, DXT1)              | ✅  |
| BC1 (sRGB, DX 10+)              | ❌  |
| BC2 (Linear, DXT3)              | ✅  |
| BC2 (sRGB, DX10+)               | ❌  |
| BC3 (Linear, DXT5)              | ✅  |
| BC3 (sRGB, DX 10+)              | ❌  |
| BC4 (Linear, Unsigned)          | ❌  |
| BC5 (Linear, Unsigned)          | ❌  |
| BC5 (Linear, Signed)            | ❌  |
| BC6H (Linear, Unsigned, DX 11+) | ❌  |
| BC7 (Linear, DX 11+)            | ❌  |
| BC7 (sRGB, DX 11+)              | ❌  |

| uncompressed                |     |
| --------------------------- | --- |
| B8G8R8A8 (Linear, A8R8G8B8) | ✅  |
| B8G8R8A8 (sRGB, DX 10+)     | ✅  |
| B8G8R8X8 (Linear, X8R8G8B8) | ✅  |
| B8G8R8X8 (sRGB, DX 10+)     | ✅  |

## Modelos disponíveis no ComfyUI

Snapshot do que está instalado localmente (`GET /object_info/CheckpointLoaderSimple` e `.../LoraLoader` em
`http://127.0.0.1:8188`, com o ComfyUI rodando) — não só os já usados em algum `geracaoArt` de `portrait.json`.
Pra atualizar esta lista, rode as mesmas duas chamadas de novo e reescreva as seções abaixo; não há script
dedicado pra isso ainda.

Separado em "uso geral" e "ignorados por padrão" seguindo a mesma convenção da skill `gerar-geracao-arte`
(`.claude/skills/gerar-geracao-arte/SKILL.md`): checkpoints/LoRAs com nome claramente de conteúdo adulto ou de
likeness de celebridade só entram numa configuração se o usuário pedir explicitamente.

### Checkpoints (`models/checkpoints/`)

Uso geral:

- ProtoGen_X3.4.safetensors
- aresMix_v02.safetensors
- dungeonsAndDiffusion_v3.safetensors
- flux_schnell.safetensors
- icbinpICantBelieveIts_mid2024.safetensors
- jimEIDOMODE_version10.ckpt
- juggernautXL_ragnarokBy.safetensors
- mahuaXLTurbo_v20.safetensors
- mahuaXLTurbo10_v10.safetensors
- majicmixAlpha_v20.safetensors
- pilgrim2DSDXL_v60.safetensors
- pilgrimBASESDXL_v4GMG.safetensors
- pilgrimMidjourney_v20.safetensors
- pilgrimUnrealSDXL_v10.safetensors
- protovisionXLHighFidelity3D_releaseV660Bakedvae.safetensors
- revAnimated_v2Rebirth.safetensors
- sdXL_v10RefinerVAEFix.safetensors
- silverstarXL_v6.safetensors
- silverstarXLFantasy_v4.safetensors
- tamarinXL_v10.safetensors
- turboDiffusionXL_v12.safetensors
- v2-1_768-ema-pruned.safetensors
- wildcardxXLFusion_fusionOG.safetensors

Ignorados por padrão (conteúdo adulto/mature pelo nome):

- airfucksBruteMix_v10.safetensors
- airfucksWildMix_v10.safetensors
- homosomnium_v10.safetensors
- homoveritas_v40.safetensors
- maturemalemix_v14.safetensors
- virileFantasy_v11.safetensors
- virileFusion_v10.safetensors
- virileMotion_v10.safetensors
- virileReality_v10.safetensors

### LoRAs (`models/loras/`)

Uso geral:

- DetailedEyes_V3.safetensors
- EasyMalePortrait.safetensors
- Elf_Ears-000009.safetensors
- Fantasy_Races_XL.safetensors
- LoRa_mermaid_dataset_bt04_ep016_09200_768_dim064_a032_LR00020_snr05_noise00_del.safetensors
- Perfect_Eyes.safetensors (SD1.5 — não usar com checkpoint SDXL)
- PerfectEyesXL.safetensors (SDXL)
- add_detail.safetensors
- epi_noiseoffset2.safetensors
- merman.safetensors

Ignorados por padrão (likeness de celebridade pelo nome):

- DylanSprayberryKM.safetensors
- anthonysemerad.safetensors
- antonioostevens.safetensors
- charlieputh.safetensors
- harrystyles.safetensors
- jakipzxxx.safetensors
- jimwookkim.safetensors
- nicholasgalitzine.safetensors
- noahcentineo.safetensors
- rhysmigu3l.safetensors
- sebastian_bonnet-v1.safetensors
- sebastiancroft.safetensors
- troyesivan.safetensors
- zaynmalik.safetensors
