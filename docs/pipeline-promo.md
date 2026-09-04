# Pipeline de imagens promocionais

Como `bun run promo` gera, para cada espécie, uma imagem de divulgação 1920×1080 (`assets/promo/ssm_<slug>.png`)
combinando arte já existente — retratos (`assets/portraits/`) e fundos de cidade (`assets/city_sets/`) — via
ImageMagick. Não gera arte nova via IA: é um pipeline de composição, não de geração (a regra de quem roda `bun
run art` continua igual, veja a seção própria no `CLAUDE.md`).

## Fonte de dados: `species-promo.json`

`assets/promo/species-promo.json` é a fonte de verdade de nome, lore e escolhas de arte de cada espécie —
validado por um schema `zod` próprio em `scripts/promo-schema/` (mesmo desenho de `portrait-schema/`/
`name-list-schema/`: `promo.schema.json` é artefato **derivado**, nunca editado à mão, regenerado via
`bun scripts/promo-schema/gerar-json-schema.ts`, e serve o autocomplete do VS Code via `json.schemas`).

Cada entrada (chave = slug `ssm_<espécie>`) declara:

- **`nome`**/**`lore`**: texto exibido na imagem — cópias editáveis independentes do que já existe em
  `steam-workshop/description.md`, não vinculadas a ele.
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

## Layout: grade de 12 colunas

`scripts/generate-promo/layout.ts` divide o eixo X do canvas (1920px) numa grade de 12 colunas de 160px cada,
única fonte de verdade de toda a geometria horizontal:

| Colunas | Largura | Uso |
| --- | --- | --- |
| 1-4 | 640px | Painel de texto (título + lore), encostado na borda esquerda |
| 5 | 160px | Respiro entre o texto e a zona dos personagens |
| 6-11 | 960px | Zona dos personagens |
| 12 | 160px | Margem na borda direita |

A zona dos personagens é dividida em **3 encaixes iguais de 2 colunas cada** — um por colocação do pódio. O
centro do encaixe de índice `i` (0 = mais à esquerda) cai em `(2i+1)/6` da zona; a fração nunca é cravada à
mão, é calculada (`centroDoEncaixe` em `layout.ts`) a partir das constantes da grade.

A ordem visual esquerda→direita é **2º-1º-3º**, o pódio olímpico clássico (prata à esquerda, ouro ao centro,
bronze à direita) — o 1º lugar fica no encaixe central, maior (`escala: 1.0` contra `0.97`/`0.95` dos outros
dois) e desenhado por último (`ORDEM_DE_DESENHO`), por cima de quem estiver adjacente na composição.

No eixo vertical, todos os 3 personagens compartilham a mesma linha de base: **a borda inferior do canvas em
si, sem gap** — a mesma regra do pipeline principal de portraits (`scripts/generate-portraits/framing.ts`, que
documenta a mesma exigência como "nunca flutuando"). Um `MARGEM_INFERIOR_PERSONAGEM` deixando alguns pixels de
folga foi tentado e descartado: numa arte de corpo inteiro sem chão desenhado por baixo, qualquer gap lê como o
personagem flutuando acima do nada.

## Seleção e composição

`scripts/generate-promo/selecao.ts` resolve `variantes`/`fundo` do JSON para caminhos de arquivo reais,
validando que cada um existe (erro nomeando a espécie e a chave que falhou, nunca um `undefined` silencioso
mais adiante). `scripts/generate-promo/composicao.ts` monta a imagem inteira numa única invocação do
ImageMagick: fundo (cover + crop centralizado ao canvas) → degradê preto→transparente sobre o painel de texto
→ os 3 personagens do pódio, trás→frente → título → lore. Nenhuma etapa escreve arquivo intermediário além dos
`.txt` de legenda (`.promo-staging/`, fora do git — passar o texto por arquivo em vez de argv evita todo o
escaping de `%`/`@`/aspas que `caption:<texto>` direto na linha de comando exigiria).

Duas armadilhas do ImageMagick valem registrar, porque não dão erro fatal — só resultado errado ou fonte
padrão silenciosa:

- **`-gravity` é um "setting", não escopado por `( ... )`.** Definir `-gravity center` dentro de um grupo (ex.:
  pro crop centralizado do fundo) vaza pros `-geometry +x+y -composite` seguintes, que esperam offset a partir
  do canto superior esquerdo. `composicao.ts` reseta explicitamente pra `NorthWest` logo depois de qualquer
  bloco que precise de outro `-gravity`.
- **`-font`/`caption:@arquivo` passam pelo parser de texto do ImageMagick**, que trata `\x` como início de
  escape e engole a barra — corrompendo em silêncio um caminho Windows (`path.join` usa `\`), sem erro fatal:
  o aviso de fonte/arquivo não encontrado vai pro stderr e a composição segue com a fonte padrão do sistema.
  `paraArgumentoDeTexto()` normaliza `\` → `/` em todo caminho que vai pra um desses dois lugares.

O degradê é um `gradient:black-none` vertical girado -90°, que vira horizontal com a orientação certa (opaco à
esquerda, esmaecendo pra transparente) — a alternativa óbvia, um `gradient:` horizontal direto, sai com o
sentido invertido nesta versão do ImageMagick; a verificação foi empírica, comparando os dois resultados lado a
lado.

## Fontes

`Orbitron-Bold.ttf` (título) e `Exo2-Regular.ttf` (lore) ficam vendorizadas em `assets/promo/`, com a licença
OFL de cada uma ao lado (`Orbitron-OFL.txt`, `Exo2-OFL.txt`) — mesmo raciocínio de `assets/name_lists/*.json`:
`assets/` é a fonte de verdade de todo o conteúdo do pipeline, não só das texturas DDS.

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
