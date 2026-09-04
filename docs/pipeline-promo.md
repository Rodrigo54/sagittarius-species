# Pipeline de imagens promocionais

Como `bun run promo` gera, para cada espécie, uma imagem de divulgação 1920×1080 (`assets/promo/ssm_<slug>.png`)
combinando arte já existente — retratos (`assets/portraits/`) e fundos de cidade (`assets/city_sets/`) — via
HTML/CSS renderizado num Chromium/Edge headless (Playwright). Não gera arte nova via IA: é um pipeline de
composição, não de geração (a regra de quem roda `bun run art` continua igual, veja a seção própria no
`CLAUDE.md`).

## Fonte de dados: `species-promo.json`

`assets/promo/species-promo.json` é a fonte de verdade de nome, lore e escolhas de arte de cada espécie —
validado por um schema `zod` próprio em `scripts/promo-schema/` (mesmo desenho de `portrait-schema/`/
`name-list-schema/`: `promo.schema.json` é artefato **derivado**, nunca editado à mão, regenerado via
`bun scripts/promo-schema/gerar-json-schema.ts`, e serve o autocomplete do VS Code via `json.schemas`).

Cada entrada (chave = slug `ssm_<espécie>`) declara:

- **`titulo`**/**`lore`**: texto exibido na imagem — cópias editáveis independentes do que já existe em
  `steam-workshop/description.md`, não vinculadas a ele.
- **`subtitulo`**: linha curta de apoio ao título (ex.: um epíteto ou a natureza do governo/facção), exibida
  entre o título e o lore.
- **`variantes`** (obrigatório): array com **exatamente 3** strings no formato `"<gênero>/<NNN>"` (ex.:
  `"female/012"`), na ordem 1º-2º-3º lugar do pódio. Cada entrada precisa existir de fato em
  `assets/portraits/<slug>/<gênero>/`. **Não há seleção automática** — a escolha de quais PNGs aparecem no
  pódio é sempre explícita no JSON; faltando o campo, ou com menos/mais de 3 entradas, o schema rejeita o
  arquivo inteiro.
- **`fundo`** (opcional): o `NNN` de `NNN_room.png` em `assets/city_sets/`, pra fixar manualmente o fundo. Ausente
  = escolha automática e determinística por hash FNV-1a do slug sobre a lista de fundos disponíveis — o mesmo
  slug sempre cai no mesmo fundo entre execuções, sem guardar estado em lugar nenhum.
- **`escalas`** (opcional): override manual de escala por colocação (`"1"` a `"3"`), pra quando a proporção do
  recorte de uma variante não cabe bem na escala padrão da colocação (definida em
  `scripts/generate-promo/layout.ts`). Chave ausente cai na escala padrão daquela colocação; objeto todo ausente
  usa a escala padrão em todas.

## Layout: grade de 12×12

`scripts/generate-promo/layout.ts` divide o canvas (1920×1080) numa grade CSS de **12 colunas × 12 linhas**,
única fonte de verdade de toda a geometria — os mesmos números viram literalmente `grid-template-columns`/
`grid-template-rows` no template HTML (`GRID.titulo.colunaCss`/`linhaCss` etc., formato `"<início> / <fim>"`
1-based, `fim` exclusivo — a convenção nativa de `grid-column`/`grid-row`).

Eixo X (12 colunas de 160px cada):

| Colunas | Largura | Uso |
| --- | --- | --- |
| 1 | 160px | Margem esquerda, compartilhada por todo bloco de texto |
| 2-11 | — | Título: banner cheio, estica por cima da zona dos personagens |
| 2-7 | — | Subtítulo |
| 2-5 | — | Lore |
| 5-11 | 960px | Zona dos personagens (col. 6-11 de conteúdo + a 5 como respiro) |
| 12 | 160px | Margem na borda direita |

Eixo Y (12 linhas de 90px cada), de cima para baixo:

| Linhas | Uso |
| --- | --- |
| 1 | Margem superior |
| 2-3 | Título (2 linhas — o pior caso do JSON quebra em 2) |
| 4 | Subtítulo |
| 5 | Espaçamento entre subtítulo e lore |
| 6-11 | Lore (6 linhas) |
| 12 | Margem inferior |

A zona dos personagens (colunas 6-11) é dividida em **3 encaixes iguais de 2 colunas cada** — um por colocação
do pódio. O centro do encaixe de índice `i` (0 = mais à esquerda) cai em `(2i+1)/6` da zona; a fração nunca é
cravada à mão, é calculada (`centroDoEncaixe` em `layout.ts`) a partir das constantes da grade.

A ordem visual esquerda→direita é **2º-1º-3º**, o pódio olímpico clássico (prata à esquerda, ouro ao centro,
bronze à direita) — o 1º lugar fica no encaixe central, maior (`escala: 1.0` contra `0.97`/`0.95` dos outros
dois) e desenhado por último (`ORDEM_DE_DESENHO`), por cima de quem estiver adjacente na composição.

No eixo vertical, todos os 3 personagens compartilham a mesma linha de base: **a borda inferior do canvas em
si, sem gap** — a mesma regra do pipeline principal de portraits (`scripts/generate-portraits/framing.ts`, que
documenta a mesma exigência como "nunca flutuando"). `ALTURA_BASE_PERSONAGEM` (altura do 1º lugar, os demais
escalam a partir dela) é 8 das 12 linhas da grade — as 4 linhas do topo ficam livres pro banner de título não
colidir com as cabeças.

## Seleção, recorte e composição

`scripts/generate-promo/selecao.ts` resolve `variantes`/`fundo` do JSON para caminhos de arquivo reais,
validando que cada um existe (erro nomeando a espécie e a chave que falhou, nunca um `undefined` silencioso
mais adiante).

`scripts/generate-promo/trim.ts` mede, via uma única chamada a `magick identify` (dimensão total + bounding box
de conteúdo `%@` por arquivo), o recorte de cada personagem — mas **nunca reescreve o PNG**: o "trim + resize!"
que o pipeline de portraits faz fisicamente aqui vira puramente CSS (`composicao.ts` escala a bounding box do
trim pra caber em `largura`×`altura` e aplica a mesma escala ao offset/dimensão total, e o template posiciona
a `<img>` com `left`/`top` negativos dentro de um container `overflow: hidden` do tamanho final — ver
`PersonagemRenderizado` em `template.ts`). Reescrever o arquivo só pra o Playwright compor de novo seria um
passo intermediário sem propósito, já que a composição final é o próprio browser.

`scripts/generate-promo/template.ts` monta o HTML/CSS inteiro: fundo (`object-fit: cover`) → degradê preto→
transparente sobre o painel de texto (`linear-gradient`) → os 3 personagens do pódio, trás→frente, cada um
`position: absolute` recortado como acima → um container `display: grid` (a grade 12×12 de verdade) com os 3
blocos de texto (`titulo`/`subtitulo`/`lore`), cada um posicionado via `grid-column`/`grid-row`.
`scripts/generate-promo/composicao.ts` (`montarImagem`) monta os dados, escreve o HTML e tira o screenshot;
`scripts/generate-promo/renderizacao.ts` (`renderizarHtml`) é o helper compartilhado que carrega esse HTML no
Playwright.

Uma `Page` do Playwright é aberta **uma única vez** em `index.ts` (`chromium.launch({ channel: 'msedge' })` —
usa o Edge já instalado no Windows, sem baixar um Chromium próprio do Playwright pra dentro de `bin/`) e
reaproveitada entre as 19 espécies.

### Um recurso `file://` só carrega se o documento também for `file://`

`page.setContent()` carrega o documento na origem `about:blank` — o Chromium/Edge bloqueia, por segurança,
que um documento nessa origem carregue recursos `file://` (imagens locais, `@font-face` locais). A falha é
**silenciosa**: nenhum erro de JS, o `<img>`/a fonte simplesmente não aparece no screenshot. `renderizacao.ts`
evita isso escrevendo o HTML num arquivo temporário sob `.promo-staging/` (fora do git) e navegando até ele
via `page.goto('file://...')` — o documento passa a ter a mesma origem `file://` dos recursos que referencia,
e o carregamento funciona normalmente. `waitUntil: 'load'` já espera as `<img>` carregarem, mas não bloqueia
em `@font-face`: `composicao.ts`/`index.ts` esperam `document.fonts.ready` explicitamente antes do screenshot.

O degradê é um `linear-gradient(to right, ...)` direto — trivial em CSS; a versão ImageMagick anterior
precisava de um `gradient:black-none` vertical girado -90° pra sair com a orientação certa, uma armadilha que
deixou de existir com a migração.

## Fontes e calibração de tamanho

`Orbitron-Bold.ttf` (título) e `Exo2-Regular.ttf` (subtítulo/lore) ficam vendorizadas em `assets/promo/`, com a
licença OFL de cada uma ao lado (`Orbitron-OFL.txt`, `Exo2-OFL.txt`) — mesmo raciocínio de
`assets/name_lists/*.json`: `assets/` é a fonte de verdade de todo o conteúdo do pipeline, não só das texturas
DDS. O template as carrega via `@font-face` com URL `file://`.

`scripts/generate-promo/calibracao.ts` calcula, por busca binária dentro do próprio browser (`page.evaluate`),
o **maior font-size que ainda cabe sem estourar** em cada um dos 3 blocos (título/subtítulo/lore) — testado
contra o **pior caso real**: o texto mais longo entre as **19 espécies do config inteiro**, nunca uma
aproximação por contagem de caracteres, e medido contra o mesmo motor de renderização (Chromium/Edge) que
depois tira o screenshot, pra calibração e resultado final nunca divergirem.

Essa calibração roda **uma única vez por execução, sempre contra o config inteiro** — inclusive quando `bun
run promo <slug>` filtra uma espécie só. O tamanho de fonte é uma decisão global, não por espécie: calibrar
isoladamente deixaria cada imagem com um tamanho de texto diferente das outras, quebrando a identidade visual
entre as 19 (uma espécie de lore curto ganharia letras maiores que as outras, por exemplo). Rodar filtrado por
um slug produz exatamente os mesmos tamanhos de fonte que uma execução completa.

O CSS final usa `rem`, não `px`, na propriedade `font-size` (`paraRem()` em `template.ts`) — a base é o
`font-size: 16px` padrão do elemento `html`, não sobrescrito em nenhum lugar do template, então `1rem` vale
exatamente `16px`. A calibração em si (busca binária, medição de `scrollHeight`) continua inteiramente em
`px` — a conversão pra `rem` acontece só na hora de gerar a string final de CSS, depois que o tamanho já foi
decidido.

## Rodando

```bash
bun run promo             # todas as espécies em species-promo.json
bun run promo ssm_elves   # só uma espécie, pra iterar rápido — as outras não são tocadas, nem para limpeza de órfãos
```

Todas as espécies são resolvidas (variantes + fundo) antes de compor qualquer imagem — erro em uma trava a
geração inteira, em vez de deixar `assets/promo/` com imagens novas e antigas misturadas. Rodando sem filtro,
`assets/promo/ssm_*.png` cuja espécie saiu de `species-promo.json` é apagado (mesma lógica de limpeza de
órfãos que `generate-portraits`/`generate-rooms` aplicam do lado do `mod/`, aqui aplicada à própria saída em
`assets/`).

A saída fica em `assets/promo/ssm_<slug>.png` — fonte/ativo do repositório como qualquer outro, não em
`steam-workshop/pictures/`; o upload pra galeria de screenshots do Workshop continua manual (veja a limitação
equivalente documentada na seção de publish-workshop do `CLAUDE.md`).
