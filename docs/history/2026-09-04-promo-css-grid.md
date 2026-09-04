# Migração do `generate-promo` de ImageMagick pra Playwright/CSS Grid

## Contexto

O pipeline de imagens promocionais (`bun run promo`) nasceu compondo tudo via ImageMagick: fundo, degradê,
personagens e texto (título + lore) numa única invocação encadeada, com posicionamento calculado à mão em
pixels (`layout.ts` tinha um `PAINEL` fixo de 4 colunas pro texto, sem grade no eixo Y). O Rodrigo reportou que
título e lore estavam pequenos demais na imagem final; investigar esse ajuste isolado escalou, via entrevista
`/questione-me`, pra uma decisão maior: reprojetar o eixo Y como uma grade de 12 linhas — espelhando a grade de
12 colunas que o eixo X já usava — e acrescentar um terceiro nível de texto (`subtitulo`, entre título e lore).

## Decisão: trocar o motor de composição inteiro

Fazer uma grade de verdade (linhas E colunas, com blocos de texto ocupando faixas nomeadas) em ImageMagick
puro exigiria computar em TypeScript cada `x`/`y`/`width`/`height` de cada bloco e informar isso via
`-geometry`/`-annotate` — essencialmente reimplementar `display: grid` à mão, em pixels, sem quebra de linha
automática nem medição de texto real (o ImageMagick não expõe "esse texto, nesse font-size, quantas linhas
ocupa?" de volta pro script — teria que ser aproximado por contagem de caracteres).

A decisão, tomada na entrevista, foi migrar a composição inteira pra **HTML renderizado por um browser real via
Playwright**, usando CSS Grid (`display: grid`) de verdade para os blocos de texto — não posições calculadas em
JS que imitam uma grade, mas a própria grade nativa do navegador, com quebra de linha, medição de altura
(`scrollHeight`) e fontes reais resolvidos pelo motor de layout do Chromium/Edge. Os personagens continuam
posicionados livremente (fração contínua da zona, não encaixados em células inteiras), porque a lógica de
pódio/escala por colocação não é uma grade — é posicionamento absoluto em cima do canvas, como já era.

`channel: 'msedge'` foi escolhido em vez do Chromium que o Playwright baixaria por padrão: o Edge já vem
instalado em qualquer Windows, evitando adicionar mais um binário vendorizado a `bin/` só pra esse pipeline.

## O que a migração trouxe de graça

- **Quebra de linha automática** de texto dentro de um container de largura fixa — o ImageMagick precisava de
  `caption:` com heurísticas próprias de quebra; o CSS faz isso nativamente.
- **Calibração de font-size por medição real** (`calibracao.ts`): busca binária dentro do próprio browser,
  testando se um `<div>` de teste com o texto mais longo das 19 espécies estoura a altura da célula
  (`scrollHeight > alturaPx`). Antes, o tamanho de fonte era um número fixo escolhido a olho por tentativa; agora
  é derivado automaticamente do pior caso real, contra o mesmo motor que depois tira o screenshot.
- **Recorte de personagem sem reescrever arquivo**: o "trim + resize!" físico do ImageMagick virou um crop CSS
  puro (`trim.ts` mede a bounding box via `magick identify`, `composicao.ts` escala essa medida, `template.ts`
  posiciona a `<img>` com offset negativo dentro de um container `overflow: hidden`) — uma etapa de I/O a menos
  por personagem por execução.
- **Duas armadilhas do ImageMagick desapareceram por completo**: `-gravity` vazando de dentro de `( ... )` pros
  comandos seguintes, e o parser de `caption:@arquivo`/`-font` engolindo `\` de caminho Windows. Nenhuma das
  duas tem equivalente em CSS.

## Decisões de arquitetura confirmadas na entrevista

- **Eixo Y vira grade de 12 linhas**, espelhando as 12 colunas do eixo X: 1 linha de margem superior, 2 de
  título, 1 de subtítulo, 1 de espaçamento, 6 de lore, 1 de margem inferior — ver a tabela completa em
  `docs/pipeline-promo.md`.
- **Novo campo `subtitulo`** no schema (`nome` foi renomeado pra `titulo` no mesmo commit, pra manter a
  nomenclatura dos 3 níveis consistente: título/subtítulo/lore) — preenchido pro conteúdo das 19 espécies.
- **Calibração de font-size é sempre global**, mesmo quando `bun run promo <slug>` filtra uma espécie só —
  decisão explícita pra que o tamanho do texto nunca varie entre uma execução filtrada e uma completa, e nunca
  entre espécies (uma espécie de lore curto não pode sair com letra maior que as outras 18).
- **`font-size` em `rem`, base 16px**, não `px` — pedido explícito do Rodrigo depois de ver o resultado inicial
  em px; a conversão (`paraRem()`) acontece só na hora de montar a string final de CSS, a calibração em si
  continua em px puro.
- **Título colado ao subtítulo via `justify-content: flex-end`**: a célula do título reserva 2 linhas pro pior
  caso, mas a maioria dos títulos reais tem 1 linha só — sem esse ajuste, um título curto ficava alinhado ao
  topo da célula (padrão de bloco), sobrando espaço vazio entre ele e o subtítulo na célula seguinte.

## Um bug real: `page.setContent()` não carrega `file://`

Depois de rodar a migração inteira nas 19 espécies pela primeira vez, o resultado saiu sem fundo nem
personagens — só o texto apareceu. Não houve erro de JS nem de Playwright; a composição "funcionou", só que com
metade das camadas ausentes.

Causa: `page.setContent()` carrega o HTML como se o documento estivesse na origem `about:blank`. O
Chromium/Edge bloqueia, por política de segurança, que um documento em `about:blank` carregue recursos
`file://` (imagens locais, `@font-face` locais) — e faz isso **silenciosamente**, sem lançar erro nenhum no
console: o `<img>` simplesmente não renderiza. Como as fontes já vinham de `file://` desde antes (não é algo
novo desta migração), esse comportamento só apareceu quando as imagens (fundo/personagens) também passaram a
ser `file://` via `<img src="...">` em vez de argumentos de linha de comando do ImageMagick.

Fix: `scripts/generate-promo/renderizacao.ts` escreve o HTML num arquivo temporário sob `.promo-staging/`
(reaproveitando a pasta de staging que já existia, fora do git, da era ImageMagick) e usa
`page.goto(pathToFileURL(caminho).href, { waitUntil: 'load' })` em vez de `page.setContent()`. O documento passa
a ter a mesma origem `file://` dos recursos que referencia, e tudo carrega normalmente. Vale registrar como
pegadinha porque não é intuitivo à primeira vista — `setContent` parece a API óbvia pra "renderizar este HTML",
e o comportamento errado não produz nenhum sinal de erro pra apontar a causa.
