# Pipeline de conversão de texturas: PNG → DDS

Como PNGs viram as texturas `.dds` que o Stellaris carrega — formato aceito, o utilitário compartilhado que faz
a conversão, e os binários de terceiros que o pipeline depende.

## Formatos de DDS aceitos pelo Stellaris

Só as variantes **lineares/UNORM** são usadas — nunca as sRGB, porque o Stellaris não as suporta:

| compressed                      |     |
| -------------------------------- | --- |
| BC1 (Linear, DXT1)              | ✅  |
| BC1 (sRGB, DX 10+)               | ❌  |
| BC2 (Linear, DXT3)              | ✅  |
| BC2 (sRGB, DX10+)                | ❌  |
| BC3 (Linear, DXT5)              | ✅  |
| BC3 (sRGB, DX 10+)               | ❌  |
| BC4 (Linear, Unsigned)          | ❌  |
| BC5 (Linear, Unsigned)          | ❌  |
| BC5 (Linear, Signed)            | ❌  |
| BC6H (Linear, Unsigned, DX 11+) | ❌  |
| BC7 (Linear, DX 11+)            | ❌  |
| BC7 (sRGB, DX 11+)               | ❌  |

| uncompressed                |     |
| ---------------------------- | --- |
| B8G8R8A8 (Linear, A8R8G8B8) | ✅  |
| B8G8R8A8 (sRGB, DX 10+)      | ✅  |
| B8G8R8X8 (Linear, X8R8G8B8) | ✅  |
| B8G8R8X8 (sRGB, DX 10+)      | ✅  |

Na prática, este mod só usa as duas variantes comprimidas UNORM: `bun run rooms` usa `bc1` → `BC1_UNORM`;
`bun run portrait` usa `bc3` → `BC3_UNORM` (retratos precisam de canal alfa pra transparência, rooms não).

## Binários auxiliares (`bin/`)

`bin/` guarda ferramentas de linha de comando de terceiros usadas pelo projeto. A pasta **não é versionada**
(está no `.gitignore`) — rode `bun run setup` (`scripts/download-bin.ts`) pra baixá-las:

- **`bin/texconv/texconv.exe`** — [texconv](https://github.com/microsoft/DirectXTex) (Microsoft DirectXTex, MIT,
  código aberto). É o motor de conversão de texturas do pipeline (veja abaixo).
- **`bin/imagemagick/magick.exe`** (+ DLLs e arquivos de suporte) — [ImageMagick](https://imagemagick.org)
  portátil, pra manipulação de imagem via linha de comando (resize, crop, conversão de formato, composição) sem
  depender do Photoshop. É o motor de imagem do enquadramento em `scripts/generate-portraits/framing.ts`
  (trim/resize/composição da arte-fonte no canvas do rig — veja `docs/pipeline-portraits.md`); também serve pra
  uso manual/ad-hoc.

Detalhes de `scripts/download-bin.ts`:

- As versões de cada ferramenta ficam **fixadas manualmente** no array `FERRAMENTAS` do próprio script (não
  busca "latest" automaticamente) — pra manter o pipeline reprodutível. Pra atualizar uma ferramenta, mude a
  `versao` e a `url` dessa entrada.
- O layout é **uma subpasta por ferramenta** dentro de `bin/`.
- É **idempotente**: cada subpasta tem um arquivo `.version` gravado após a instalação; rodar `bun run setup` de
  novo só baixa o que estiver faltando ou com a versão pinada diferente da instalada.
- O ImageMagick só é distribuído como `.7z` (sem `.zip` portátil oficial) — a extração usa `7zip-bin` + `node-7z`
  (devDependencies), que empacotam um `7za` portátil, sem exigir 7-Zip instalado no sistema.

## O conversor (`scripts/converter.ts`)

Requer Windows, já que o `texconv` é baseado em DirectX.

`scripts/converter.ts` usa o `texconv` (`bin/texconv/texconv.exe`, baixado por `bun run setup` — veja acima)
para converter PNG em DDS no destino informado pelo chamador. Portraits usa `.portrait-staging/mod/` e
rooms escreve diretamente em `mod/`. É um utilitário de baixo nível compartilhado: agrupa os arquivos recebidos pela pasta de destino (trocando a raiz `pastaOrigem` por
`pastaDestino`, preservando a subestrutura de pastas), cria cada pasta de destino que ainda não existir, e roda
o `texconv` uma vez por pasta (só aceita um único diretório de saída `-o` por invocação). `noMips: true` vira
`-m 1`; a saída é sempre forçada para `-ft dds -y` (overwrite). Se uma pasta falhar na conversão, o processo
para imediatamente (fail-fast).

Portraits prepara e promove um lote completo antes de limpar órfãos (ver `docs/pipeline-portraits.md`).
Rooms valida, converte, escreve o registro e só então limpa órfãos.

### Pipeline de rooms: `assets/city_sets/` → `mod/` sempre em sincronia

`scripts/generate-rooms/` (comando `bun run rooms`) mantém tanto as texturas quanto o `ssm_room_textures.txt`
sempre espelhando exatamente o que existe em `assets/city_sets/`, toda vez que roda:

1. Os PNGs de `assets/city_sets/` precisam ser `001_room.png`..`NNN_room.png`, sequenciais e zero-padded a 3
   dígitos, sem buracos — qualquer divergência é erro e trava a geração sem escrever nem apagar nada (mesmo
   padrão de `docs/pipeline-portraits.md`).
2. Depois de validar, converte os PNGs via `converter.ts` e regenera
   `gfx/portraits/asset_selectors/ssm_room_textures.txt`. Somente após sucesso remove DDS órfãos na pasta de city_sets.
3. O `.txt` gerado contém **só as entradas do mod** (`room_selector.game_setup` com `"NNN_room" = { always = yes
   }` pra cada PNG) — nenhum `ruler` e nenhuma entrada vanilla duplicada. O `room_selector` é mesclado por chave
   entre arquivos diferentes dentro de `gfx/portraits/asset_selectors/` (é assim que mods de rooms coexistem com
   o `room_textures.txt` vanilla sem precisar redefini-lo), então duplicar conteúdo vanilla aqui seria só um
   risco de manutenção (uma cópia congelada que pode ficar desatualizada e sobrescrever silenciosamente lógica
   que a Paradox atualizar depois) sem nenhum benefício — os quartos vanilla (`personality_*_room`, `ruler`,
   etc.) continuam funcionando normalmente via o próprio arquivo do jogo.
