# O motor de DDS antes do texconv: a era `nvtt_export.exe`

Registro do propósito e da técnica dos artefatos que sustentaram a conversão PNG→DDS deste mod entre 2023 e
2026, todos já apagados do repositório: `dds-preset.dpf`, `scripts/teste.ps1`, `scripts/nvdds.ps1` e a primeira
versão de `scripts/converter.ts`. Não é história de decisão de arquitetura — é a lógica de um conjunto de
scripts descartados, guardada porque o `converter.ts` de hoje ainda carrega uma cicatriz dessa era no código
(veja "A cicatriz que sobrou", no fim).

O motor atual é o `texconv`, e só ele: veja `docs/pipeline-texturas.md`.

## O que era o `nvtt_export.exe`

O **NVIDIA Texture Tools Exporter** — ferramenta gráfica da NVIDIA com uma CLI acoplada, instalada **à mão** em
`C:\Program Files\NVIDIA Corporation\NVIDIA Texture Tools\`. Nunca foi versionada nem baixada por script: era
uma dependência de máquina, presumida presente. Isso é o oposto do `bin/` de hoje, que baixa e fixa a versão de
cada ferramenta (`bun run setup`).

A característica que moldou todo o pipeline em volta dela foi o **`--batch-file`**: uma invocação só do
executável processava um arquivo de texto com uma linha por imagem, cada linha carregando origem, flags e
destino. Converter 500 retratos custava um processo.

## A linhagem

| Quando | Commit | O quê |
| --- | --- | --- |
| 2023-09-15 | `7aae2ae` | `dds-preset.dpf` nasce — o preset da ferramenta. |
| 2023-10-20 | `8bfbabf` | `scripts/nvdds.ps1` — invocava o `nvtt_export.exe` com o batch pronto. |
| 2023-10-29 | `466c1aa` | `scripts/teste.ps1` — o protótipo que **gerava** o batch. |
| 2024-01-17 | `d7f7b74` | O preset passa de `bc3` para `bc1a`. |
| 2024-02-23 | `f2b5007` | Ajustes no `nvdds.ps1` e no `calc-size.ps1`. |
| 2024-04-15 | `f4e0786` | `scripts/converter.ts` v1 — porta o protótipo pra TypeScript, ainda alimentando o `nvtt`. |
| 2025-12-09 | `cbfcfbf` | Caminhos atualizados no rebrand `galaxar-species` → `sagittarius-species`. |
| 2026-07-22 | `2376a1f` | `download-bin.ts` traz o `texconv`; a era `nvtt` termina. |

O `teste.ps1` nasceu no commit "add octopus specie", quando o mod ainda se chamava **`galaxar-species`**. Era um
protótipo em PowerShell: percorria `assets/astral` recursivamente e escrevia `lista_de_arquivos.txt`, uma linha
por PNG, no formato que o `--batch-file` esperava:

```
<origem.png> --format bc3 --quality normal --no-mips --zcmp 5 --output <destino.dds>
```

Em 2025-12-09 ele teve o caminho hardcodado atualizado no rebrand, mas já não rodava havia tempo — `assets/astral`
tinha deixado de existir. Ficou parado no repositório até 2026-08-14.

## As flags, e o que virou delas

O `dds-preset.dpf`, na sua forma final, era uma linha só:

```
--format bc1a --quality production --no-mips --zcmp 5
```

O `teste.ps1` e o `converter.ts` v1 usavam a mesma receita com `--format bc3` (retratos precisam de alfa) e
`--quality` variando entre `normal` e `production`. Mapeamento pro vocabulário do `texconv`:

| `nvtt_export.exe` | `texconv` | Nota |
| --- | --- | --- |
| `--format bc3` | `-f BC3_UNORM` | Retratos (alfa). |
| `--format bc1a` | `-f BC1_UNORM` | Rooms. O `a` do `bc1a` era o alfa de 1 bit do BC1. |
| `--no-mips` | `-m 1` | O Stellaris não usa mipmap nessas texturas. |
| `--quality production` \| `normal` | — | Sem equivalente. Controlava o esforço de busca do compressor; o `texconv` não expõe esse eixo. |
| `--zcmp 5` | — | Sem equivalente, e sem efeito prático aqui: compressão adicional do container que o Stellaris não lê. |

## `converter.ts` v1 — o mesmo desenho, em TypeScript

O `converter.ts` de hoje é descendente direto do `teste.ps1`. A v1 (`f4e0786`) mantinha a arquitetura inteira do
protótipo, só trocando a linguagem: uma função `batchFile()` que escrevia `batch.nvdds` com **exatamente o mesmo
formato de linha**, e uma `converter()` que chamava o executável uma única vez com `--batch-file`. O
`nvdds.ps1` sobreviveu por um tempo como caminho alternativo, comentado dentro do próprio `converter.ts`.

## Por que o `converter.ts` de hoje agrupa por pasta de destino

O `texconv` **não tem `--batch-file`**. Ele aceita muitos arquivos de entrada por invocação, mas só um `-o`
(pasta de saída). Isso inverteu o desenho do pipeline: em vez de montar uma lista global de pares
origem→destino e disparar **um** processo, ele passou a **agrupar os arquivos por pasta de destino** e invocar o
`texconv` uma vez por grupo — é o que `agruparPorPastaDestino()` faz em `scripts/converter.ts`.

Essa é a única decisão da era `nvtt` que ainda molda o código atual, e a razão principal deste registro existir:
quem ler o agrupamento hoje vê a restrição do `texconv` (um `-o` por invocação), mas não teria como saber que a
forma anterior — uma lista global, um processo só — foi possível por três anos.
