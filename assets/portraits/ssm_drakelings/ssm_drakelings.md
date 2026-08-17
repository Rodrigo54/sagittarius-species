# ssm_drakelings

**Nome exibido:** Drakelings
**Species class:** `INF` (Thermophile — a confirmar; a classe é gated por DLC, ver seção própria abaixo)
**Rig:** `ssm_shared`
**Gendered:** não (`flat`, 30 variantes)

## Descrição

Dragõezinhos humanoides do mod: gente-dragão de porte baixo e roliço, com cabeça de dragão de verdade —
focinho curto e cego, bochecha cheia, chifrinhos rombudos curvando pra trás, franjas arredondadas no lugar das
orelhas — e o corpo inteiro coberto de escama pequena e macia, sem roupa nenhuma. **Não têm asas.** A fofura da
espécie vem de **anatomia** (proporções roliças, focinho curto, olhos grandes de pupila fendida), nunca de
estilo de render: o `fixed.style` do `base.json` é global às 18 espécies e trava `not anime, not cartoon, not
chibi`, então pedir "cartoon" aqui brigaria com o pacote inteiro.

O que distingue um indivíduo do outro é **a cor da escama**, num gradiente entre duas cores: `primary_color`
cobrindo cabeça, chifres, ombros e parte externa dos braços, abrindo gradualmente pra `secondary_color` na
garganta, peito e barriga, sem aresta entre as duas. A paleta é **livre** (qualquer par do enum `CORES`) — o
nome *Thermophile* é a `species_class` do jogo, não uma promessa visual de calor, então não há obrigação de
paleta quente. Um drakeling `Emerald → Mint` é tão canônico quanto um `Red → Gold`.

`portrait.json` já tem `geracaoArt` configurado, no schema/pipeline atual (Flux.2 Klein —
`scripts/portrait-schema/`, `docs/pipeline-generate-art.md`):

- `species`: `{ archetype: "Draconic", template: "<species.archetype>, cute little dragon person, true dragon
  head with a short blunt rounded snout, ..." }`. **`Draconic` é um valor novo do enum `ARQUETIPOS`**
  (`scripts/portrait-schema/vocabulario.ts`), adicionado por esta espécie: `Alien` injetaria "alien" no ponto
  mais quente do prompt (4º fragmento da `order.positive`) e puxaria grey/alienígena genérico; `Furry` puxaria
  pelagem, o oposto de escama.
- A ausência de asas vive no **positivo**, com peso — `(no wings, wingless, nothing on the back:1.2)` — e não
  só no negativo: a variante `distilled` (padrão) descarta o negativo inteiro via `ConditioningZeroOut`, então
  toda exclusão que precisa valer de fato tem que estar no positivo. Mesmo precedente do
  `(no helmet, no hood, no head covering...:1.2)` de `ssm_astral`. Na variante `base`, `wings` já está no
  `fixed.negative` e reforça de graça.
- `torso`: `{ state: "Bare", template: "bare scaled body with no clothing at all, ... smooth gradient from
  <torso.primary_color> ... to <torso.secondary_color> ..." }`. `Bare` maximiza a área de escama visível — que
  é justamente o único eixo forte de variação entre os 30 indivíduos. Sem risco de nudez: é um bicho escamoso,
  e `nipples` já está no `fixed.negative`.
- `eyes.extra` (nível `base`): `"(vertical slit pupils:1.2), large round eyes with soft rounded lids, gentle
  friendly gaze"` — a pupila fendida é o traço que impede o rosto de ler como "bicho de pelúcia" genérico.
- **Seções deliberadamente ausentes:** `hair` (inteira), `person.ethnicity`, `person.age`, `person.gender` e
  `eyes.shape`. Seção ausente não emite fragmento nenhum (`scripts/generate-art/prompt-builder.ts`), então
  omitir `hair` é o jeito correto de uma espécie sem cabelo — declarar a seção vazia deixaria um `(hair)` solto
  no prompt, porque a palavra `hair` está **fora** dos colchetes no template default. `eyes.shape` é anatomia
  de pálpebra humana (`Monolid`, `Hooded`) e ainda entra no **negativo** pela `order`: ruído em cima de um
  focinho.
- **Varia por indivíduo:** `torso.primary_color`/`secondary_color` (os dois extremos do gradiente, 30 pares sem
  repetição), `person.body_shape` (`Slim`/`Average`/`Chubby`/`Athletic` — um drakeling `Chubby` lê como outro
  bicho que um `Slim`, e é aqui que mora boa parte da fofura) e `eyes.color`.
- `modelo`: `{ variant: "distilled", aspectRatio: "4:5" }` — mesmo padrão de `ssm_mermaids`.

Os dois prompts abaixo documentam as imagens de referência (`reference_flat_1.png`, `reference_flat_2.png`),
encadeadas via `ReferenceLatent`. **A ordem importa e a primeira domina** (confirmado em teste real com
`ssm_mermaids`), por isso as duas são o **mesmo bicho em paletas opostas**: anatomia idêntica ensina a forma da
espécie, paletas opostas impedem que a cor da referência vaze e achate o gradiente das 30 variantes. Cada
mudança de prompt aqui deveria ser espelhada no `geracaoArt` (e vice-versa). Use
`bun run art ssm_drakelings flat -n 001 -e` pra conferir o texto composto de verdade sem gastar GPU.

## Prompt de referência (Midjourney) — Flat 1 (quente: laranja → dourado)

Descreve `reference_flat_1.png`: dragãozinho humanoide roliço de escama laranja na cabeça, chifres, ombros e
braços, abrindo em gradiente pra dourado na garganta, peito e barriga; focinho curto e rombudo, bochecha cheia,
chifrinhos pequenos curvados pra trás, olhos grandes âmbar de pupila fendida, sem roupa nenhuma, **sem asas**.
Braços inteiros dentro do quadro.

```prompt
3D render CGI character art, stylized video game character art, digital painting style, not photorealistic, full-color character concept art of a small chubby humanoid dragon person, true dragon head with a short blunt rounded snout, full round cheeks, small blunt horns curving back from the brow, small rounded frills where ears would be, large amber eyes with vertical slit pupils, body entirely covered in small soft scales, no clothing at all, scale color forming a smooth gradient from bright orange on the head, horns, shoulders and outer arms to warm gold down the throat, chest and belly, the two colors blending gradually with no hard edge, paler smoother belly scales, wingless, no wings on the back, sturdy rounded build, gentle friendly creature, standing pose, medium shot, full arms visible within frame, arms not cropped by frame edges, looking directly at camera, plain solid white background, pure white backdrop, sharp focus, clean character turnaround lighting, flat direct front lighting, no cast shadows, shadowless lighting --ar 4:5 --v 8.2 --style raw --profile zj9otkx --no photorealistic, blur, extra limbs, cropped arms, cast shadows, drop shadow, wings, feathered wings, bat wings, fur, feathers, clothing, armor, weapon, human face, human nose, long crocodile snout, demon, horror, fangs bared, fire, lava, chibi, anime
```

- **`wingless, no wings on the back` no positivo E `wings, feathered wings, bat wings` no `--no`** — asa é o
  reflexo mais forte de qualquer modelo diante da palavra "dragon"; nomear a exclusão dos dois lados é o mínimo.
- **`true dragon head with a short blunt rounded snout`** — é o que separa esta espécie de um humano com
  chifres. `human face, human nose` e `long crocodile snout` entram no `--no` como os dois erros opostos: focinho
  de menos (vira humano escamoso) e focinho de mais (vira crocodilo/lagarto).
- **`chibi, anime` no `--no`, apesar de a espécie ser "fofinha"** — a fofura tem que vir de proporção e focinho,
  não de estilo, pra referência não brigar com o `fixed.style` do pipeline (que trava exatamente esses dois).
- **`gradient ... blending gradually with no hard edge`** — o gradiente é a identidade individual da espécie;
  descrito como transição contínua, não como "cabeça laranja e barriga dourada", que renderiza em duas manchas
  chapadas.
- **`no clothing at all` + `clothing, armor` no `--no`** — `torso.state` é `Bare`, e qualquer peça inventada na
  referência viraria uma peça fantasma perseguindo as 30 variantes.
- `--ar 4:5`, `--style raw`, fundo branco, luz frontal sem sombra: mesmos parâmetros que `ssm_astral`/
  `ssm_default` validaram (evita corte de braço no "medium shot", evita o MJ estilizar demais, evita sombra
  atrapalhando o reaproveitamento via `ReferenceLatent`). `--v 8.2 --profile zj9otkx`: versão e perfil da rodada
  atual, iguais aos de `ssm_mermaids`.

## Prompt de referência (Midjourney) — Flat 2 (fria: turquesa → violeta)

Descreve `reference_flat_2.png`: **exatamente o mesmo bicho** do Flat 1 — mesma cabeça, mesmo porte, mesma
ausência de asas e de roupa — em paleta oposta: turquesa na cabeça, chifres, ombros e braços, abrindo pra
violeta claro na garganta, peito e barriga, com olhos verdes. Muda só a cor e o tipo físico (mais esguio),
nada da anatomia.

```prompt
3D render CGI character art, stylized video game character art, digital painting style, not photorealistic, full-color character concept art of a small slender humanoid dragon person, true dragon head with a short blunt rounded snout, full round cheeks, small blunt horns curving back from the brow, small rounded frills where ears would be, large green eyes with vertical slit pupils, body entirely covered in small soft scales, no clothing at all, scale color forming a smooth gradient from deep turquoise on the head, horns, shoulders and outer arms to pale violet down the throat, chest and belly, the two colors blending gradually with no hard edge, paler smoother belly scales, wingless, no wings on the back, slender rounded build, gentle friendly creature, standing pose, medium shot, full arms visible within frame, arms not cropped by frame edges, looking directly at camera, plain solid white background, pure white backdrop, sharp focus, clean character turnaround lighting, flat direct front lighting, no cast shadows, shadowless lighting --ar 4:5 --v 8.2 --style raw --profile zj9otkx --no photorealistic, blur, extra limbs, cropped arms, cast shadows, drop shadow, wings, feathered wings, bat wings, fur, feathers, clothing, armor, weapon, human face, human nose, long crocodile snout, demon, horror, fangs bared, fire, lava, chibi, anime
```

- **Paleta fria deliberadamente oposta à do Flat 1** — é a razão de existir desta segunda referência. Duas
  referências quentes ensinariam ao modelo "drakeling é laranja", e as 25 variantes de cor fria sairiam brigando
  contra a própria cadeia de referência.
- **`slender` no lugar de `chubby`** — a única outra diferença proposital: cobre os dois extremos de
  `person.body_shape` (`Slim`..`Chubby`) que as variantes usam, em vez de fixar um só porte como "a espécie".
- Todo o resto do texto é **idêntico** ao Flat 1, palavra por palavra, de propósito: o que as duas imagens têm
  em comum é o que o modelo vai ler como "a espécie".

## `species_class = INF` é gated por DLC (`has_infernals`)

A `species_class` natural desta espécie é `INF` — o que o jogo exibe como **"Thermophile"**
(`localisation/english/infernals_l_english.yml`, `trait_infernal`). Ela vem do
**Infernals Species Pack**, e isso não é detalhe de lore: está escrito nas condições da própria classe, em
`common/species_classes/01_base_species_classes.txt`:

```text
INF = {
	archetype = BIOLOGICAL
	playable = { has_infernals = yes }
	randomized = { has_infernals = yes }
	gender = yes
	graphical_culture = infernal_01
	trait = "trait_infernal"
	added_planet_types = {pc_volcanic}
}
```

E `has_infernals` é um scripted trigger vanilla (`common/scripted_triggers/00_scripted_triggers.txt`):

```text
has_infernals = {
	optimize_memory
	host_has_dlc = "Infernals Species Pack"
}
```

Repare em **`host_has_dlc`**, não `has_dlc`: em multiplayer quem decide é o **host** da partida, não cada
jogador. Um cliente sem o DLC entra numa partida cujo host o tem e a classe continua valendo.

**Consequência prática:** um `portrait_set` do mod apontando pra `species_class = INF` entrega 30 retratos que
**não aparecem** (nem jogáveis, nem sorteados) pra quem não tem o DLC — sem erro, sem aviso, só ausência.
Como o mod é distribuído no Workshop pra todo mundo, isso é decisão de conteúdo, não detalhe técnico.

O vanilla resolve o mesmo problema de forma declarativa, e o `portrait_set` `infernals` é o modelo pronto
(`common/portrait_sets/`): o set existe sempre, e a condição de DLC fica **dentro** dele.

```text
infernals = {
	species_class = INF
	conditional_portraits = {
		randomizable = { has_infernals = yes }
		playable = { has_infernals = yes }
		portraits = { "inf1" "inf2" ... }
	}
	non_pre_ftl_portraits = { ... }
}
```

**Nenhum set deste mod usa `conditional_portraits` hoje** — todos os dez em
`mod/sagittarius-species/common/portrait_sets/ssm_portrait_sets.txt` usam `portraits = { }` direto. Adotar a
forma condicional aqui seria a primeira vez.

Saídas possíveis, nenhuma escolhida ainda:

1. **Só `INF`, com `conditional_portraits`** espelhando o set `infernals` vanilla — o mais correto
   semanticamente (drakelings *são* termófilos) e explícito quanto à condição; o preço é que a espécie
   simplesmente não existe pra quem não tem o Species Pack.
2. **Só `INF`, com `portraits = { }` direto** — a condição fica implícita na classe (que já é
   `playable`/`randomized` condicional), sem repetir a checagem no set. Mesmo efeito visível, menos declarado;
   fica refém de a Paradox não mexer nessas condições.
3. **Numa classe sem DLC** (`ssm_sagittarius`, ou um `portrait_set` `HUM`/`REP`), tratando "Thermophile" como
   sabor e não como classe — todo mundo vê a espécie, e ela perde o vínculo com `pc_volcanic`/`trait_infernal`.
4. **Nas duas** — um set condicional em `INF` mais um set sempre disponível numa classe base. Cobertura total;
   preço é a espécie aparecer duas vezes pra quem tem o DLC, o que precisa ser conferido in-game.

## Próximos passos (fora do escopo deste arquivo)

1. Rodar os dois prompts no Midjourney, escolher a melhor de cada e salvar como
   `assets/portraits/ssm_drakelings/reference_flat_1.png` e `reference_flat_2.png` (os caminhos já declarados em
   `geracaoArt.flat.referenceImage`).
2. `bun run art ssm_drakelings flat` pra gerar o lote em staging, revisar, e `-p` pra promover pra
   `assets/portraits/ssm_drakelings/001.png`..`030.png`. **Enquanto os 30 PNGs não existirem, `bun run portrait`
   sem filtro aborta o repositório inteiro** ("contagem declarada (30) não bate com os PNGs encontrados (0)",
   sem escrever nem apagar nada); no intervalo, use `bun run portrait <slug>` por espécie.
3. Registrar a espécie em `mod/`: `common/species_classes/ssm_species_classes.txt`,
   `common/portrait_sets/ssm_portrait_sets.txt` e `common/portrait_categories/ssm_portrait_categories.txt`.
   **Decisão em aberto:** qual `species_class` usar, já que a natural (`INF`) é gated por DLC — ver a seção
   "`species_class = INF` é gated por DLC (`has_infernals`)" acima, com as quatro saídas possíveis.
4. Opcionalmente, espécies-flavor em `assets/name_lists/*.json` (`species_names`) apontando pro portrait
   `ssm_drakelings` — ver `docs/pipeline-nomes.md`.
