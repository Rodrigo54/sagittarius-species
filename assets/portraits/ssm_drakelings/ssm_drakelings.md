# ssm_drakelings

**Nome exibido:** Drakelings
**Species class:** `INF` (Thermophile — a confirmar; a classe é gated por DLC, ver seção própria abaixo)
**Rig:** `ssm_shared`
**Gendered:** sim (`male`/`female`, 15/15 variantes)

## Descrição

Dragõezinhos humanoides do mod: gente-dragão de porte baixo e roliço, com cabeça de dragão de verdade —
focinho curto e cego, bochecha cheia, chifrinhos rombudos curvando pra trás, franjas arredondadas no lugar das
orelhas — cobertos de escama pequena e macia. **Não têm asas.** A fofura da espécie vem de **anatomia**
(proporções roliças, focinho curto, olhos grandes de pupila fendida), nunca de estilo de render: o
`fixed.style` do `base.json` é global às 18 espécies e trava `not anime, not cartoon, not chibi`, então pedir
"cartoon" aqui brigaria com o pacote inteiro.

São um povo de **forjadores**, e é a roupa que diz isso: peitoral martelado sobre avental de couro, rebites,
fivelas e tiras cruzando o peito, superfície batida à mão com fuligem — **sempre sem manga**, ombros e braços
inteiramente à mostra. O `torso.state` é `TorsoCoveredArmsBare` (vocabulário: "chest and stomach covered by
armor, arms bare"), o valor do enum que descreve exatamente isso, e o template de cada gênero ainda reforça
`(completely sleeveless, bare shoulders and bare arms, no sleeves, no gloves, no gauntlets:1.2)` — manga é o
reflexo natural de qualquer modelo diante de "armadura", e a variante `distilled` descarta o negativo, então a
exclusão precisa pesar no positivo.

**O metal é fixo por gênero, e é o que separa os dois à primeira vista:** o macho usa **bronze** e a fêmea usa
**prata polida**. Cada gênero tem `torso.template` próprio (mesmo padrão da `ssm_mermaids`), não um `extra`
tentando contradizer um texto comum — corrigir uma peça por cima do texto da base não funciona, o modelo
atende os dois. Em ambos, a cor do metal vem com exclusão explícita e peso no positivo
(`(all the metal in warm bronze, no iron, no steel, no silver:1.2)` e o espelho em prata), porque bronze e
prata escorregam um para o outro entre seeds e o negativo não está lá para segurar.

**Dimorfismo.** O macho é mais pesado — peito largo, pescoço grosso, focinho mais largo, chifres grossos — e o
`body_shape` das variantes fica em `Muscular`/`Athletic`/`Average`/`Chubby`/`Slim`. A fêmea é cinturada: peito
mais cheio e cintura visivelmente mais fina, pescoço fino, focinho mais curto, chifres menores e franjas
maiores, com `body_shape` dominado por `Hourglass`/`Curvy`. A cintura fina precisou ser construída na **peça**,
não só na anatomia — um avental reto esconde qualquer cintura —, daí o cinto largo e o peitoral que abre sobre
o peito e fecha logo abaixo, com o contraste entre as duas partes dito explicitamente e com o peso mais alto do
arquivo (`:1.4`).

O que distingue um indivíduo do outro dentro do mesmo gênero é **a cor da escama**, num gradiente entre duas
cores: `primary_color` na cabeça, chifres e ombros, abrindo gradualmente pra `secondary_color` na garganta e
nos braços, sem aresta entre as duas. Com o tronco coberto pela roupa, é nas partes descobertas que o gradiente
aparece — mais um motivo pra roupa ser sem manga. A paleta é **livre** (qualquer par do enum `CORES`) — o nome
*Thermophile* é a `species_class` do jogo, não uma promessa visual de calor, então não há obrigação de paleta
quente. Um drakeling `Emerald → Mint` é tão canônico quanto um `Red → Gold`. Os **30 pares são únicos entre os
dois gêneros somados**: nenhuma combinação de cor se repete na espécie inteira.

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
- `torso`: `{ state: "TorsoCoveredArmsBare", template: "sleeveless blacksmith gear, hammered dark iron chest
  plate worn over a thick leather apron, ... (completely sleeveless, bare shoulders and bare arms, no sleeves,
  no gloves, no gauntlets:1.2), ... gradient from <torso.primary_color> ... to <torso.secondary_color> ..." }`.
  O `state` traz de brinde `(bare stomach, covered arms:1.2)` no negativo, que é o erro exato a evitar aqui.
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

**Estado das referências:** os dois gêneros apontam hoje para a **mesma** imagem, `reference_flat_1.png` —
herança do período em que a espécie era flat, e uma solução provisória: ela é um drakeling de bronze, sem
cintura, então serve de referência de *forma* pro macho e trabalha contra a silhueta da fêmea. Os dois prompts
abaixo existem pra resolver isso: gerar `reference_male_1.png` e `reference_female_1.png` e apontar cada bloco
pro seu (ver "Próximos passos"). Na cadeia de `ReferenceLatent` **a ordem importa e a primeira domina**
(confirmado em teste real com `ssm_mermaids`), e com uma imagem só por gênero ela domina sozinha — por isso a
referência errada custa caro aqui.

Cada mudança de prompt aqui deveria ser espelhada no `geracaoArt` (e vice-versa). Use
`bun run art ssm_drakelings male -n 001 -e` (ou `female`) pra conferir o texto composto de verdade sem gastar
GPU.

## Prompt de referência (Midjourney) — Male (bronze)

Descreve `reference_male_1.png`: drakeling macho, encorpado — peito largo, pescoço grosso, focinho mais largo,
chifres mais pesados —, escama laranja na cabeça e chifres abrindo em gradiente pra dourado na garganta e nos
braços; peitoral de **bronze** martelado sobre avental de couro, sem manga, braços nus, **sem asas**.

```prompt
3D render CGI character art, stylized video game character art, digital painting style, not photorealistic, full-color character concept art of a sturdy humanoid dragon creature blacksmith, true dragon head with a short blunt snout, full round cheeks, heavy blunt horns swept back, broad chest and thick neck, large amber eyes with vertical slit pupils, smooth soft scales in a gradient from bright orange on the head and horns to warm gold on the throat and arms, wingless, wearing sleeveless blacksmith gear, hammered bronze chest plate over a thick leather apron, all the metal in warm bronze, darker bronze buckles and leather straps across the chest, sleeveless with bare shoulders and bare arms, waist-up portrait framing, head and upper torso only, cropped at the waist, subject close to the camera and filling most of the frame vertically, arms relaxed at the sides, full arms visible within frame, looking directly at camera, plain solid white background, sharp focus, flat direct front lighting, no cast shadows, shadowless lighting --ar 4:5 --v 8.2 --style raw --profile zj9otkx --no photorealistic, blur, extra limbs, cropped arms, cast shadows, wings, fur, feathers, sleeves, gloves, gauntlets, helmet, silver, steel, human face, long snout, chibi, anime, full body, legs visible, wide shot, small subject
```

- **`wingless` no positivo E `wings` no `--no`** — asa é o reflexo mais forte de qualquer modelo diante da
  palavra "dragon"; nomear a exclusão dos dois lados é o mínimo. Uma palavra de cada lado basta: `feathered
  wings`/`bat wings` só diluiriam o peso de `wings`.
- **`true dragon head with a short blunt snout`** — é o que separa esta espécie de um humano com chifres.
  `human face` e `long snout` entram no `--no` como os dois erros opostos: focinho de menos (vira humano
  escamoso) e focinho de mais (vira crocodilo/lagarto).
- **`chibi, anime` no `--no`, apesar de a espécie ser "fofinha"** — a fofura tem que vir de proporção e focinho,
  não de estilo, pra referência não brigar com o `fixed.style` do pipeline (que trava exatamente esses dois).
- **`gradient ... blending with no hard edge`** — o gradiente é a identidade individual da espécie; descrito
  como transição contínua, não como "cabeça laranja e barriga dourada", que renderiza em duas manchas chapadas.
- **Sem manga é dito três vezes, de propósito** — `sleeveless blacksmith gear`, `completely sleeveless with
  bare shoulders and bare arms`, e `sleeves, gloves, gauntlets` no `--no`. Manga é o reflexo natural diante de
  "armadura de ferreiro", e braço coberto custa caro aqui: é onde o gradiente de escama aparece, agora que o
  tronco está vestido.
- **`helmet` no `--no`** — o `fixed.negative` do pipeline local já exclui elmo/viseira, mas o prompt do MJ é
  independente dele e "blacksmith" puxa capacete de forja com facilidade.
- **Nota de moderação:** a primeira versão deste prompt descrevia o bicho **sem roupa** (`no clothing`) e foi
  **reprovada pelo AI Moderator do Midjourney** ("the AI Moderator is unsure about this prompt"), que lê
  "pessoa sem roupa" e barra antes de gerar. Com a roupa de forjador o risco desaparece, mas a lição fica pra
  qualquer espécie futura de tronco nu: descreva a superfície do corpo por afirmação (escama/couro como
  superfície natural), nunca negando roupa, e evite `clothing` até dentro do `--no`.
- **`creature` enquadra de corpo inteiro; `person` enquadra busto.** Trocar a palavra pra escapar da moderação
  (bullet acima) mudou o enquadramento junto: a primeira rodada real no Midjourney saiu **de corpo todo**, com o
  bicho pequeno no meio do quadro. Por isso `medium shot`/`standing pose` deram lugar a uma descrição explícita
  de recorte — `waist-up portrait framing, head and upper torso only, cropped at the waist, subject close to the
  camera and filling most of the frame vertically` — e o `--no` ganhou `full body, legs visible, wide shot,
  small subject`. Não é invenção: é a mesma formulação que o `fixed.view`/`fixed.negative` do
  `scripts/generate-art/base.json` já usa pra resolver esse exato problema no pipeline local. `small` também
  saiu da descrição do bicho (pedir "pequeno" convida o modelo a mostrá-lo inteiro e distante); o porte agora
  vem só de `chubby`/`slender`.
- `--ar 4:5`, `--style raw`, fundo branco, luz frontal sem sombra: mesmos parâmetros que `ssm_astral`/
  `ssm_default` validaram (evita o MJ estilizar demais, evita sombra atrapalhando o reaproveitamento via
  `ReferenceLatent`). `--v 8.2 --profile zj9otkx`: versão e perfil da rodada atual, iguais aos de
  `ssm_mermaids`. As redundâncias da cauda padrão do pacote (`pure white backdrop` ao lado de `plain solid white
  background`, `clean character turnaround lighting` ao lado de `flat direct front lighting`, `arms not cropped
  by frame edges` ao lado de `full arms visible within frame`) foram cortadas aqui pra abrir espaço às cláusulas
  de enquadramento sem estourar o comprimento.

## Prompt de referência (Midjourney) — Female (prata)

Descreve `reference_female_1.png`: **o mesmo bicho** do Male — mesma cabeça, mesma ausência de asas, mesmo
ofício — com a silhueta feminina da espécie (peito cheio, cintura marcada, pescoço fino, chifres menores,
franjas maiores), escama ametista abrindo pra rosa, e peitoral de **prata polida** cinturado por um cinto largo.

```prompt
3D render CGI character art, stylized video game character art, digital painting style, not photorealistic, full-color character concept art of a humanoid dragon creature blacksmith with an hourglass figure, true dragon head with a short blunt snout, full round cheeks, small slender horns swept back, slim neck, large violet eyes with vertical slit pupils, smooth soft scales in a gradient from deep amethyst on the head and horns to soft rose on the throat and arms, wingless, wearing sleeveless blacksmith gear, hammered polished silver breastplate curving over a full rounded chest and drawing in sharply to a very narrow cinched waist, a wide leather belt pulling the waist in tight, a fitted leather apron below the belt, all the metal in bright polished silver, sleeveless with bare shoulders and bare arms, waist-up portrait framing, head and upper torso only, cropped at the waist, subject close to the camera and filling most of the frame vertically, arms relaxed at the sides, full arms visible within frame, looking directly at camera, plain solid white background, sharp focus, flat direct front lighting, no cast shadows, shadowless lighting --ar 4:5 --v 8.2 --style raw --profile zj9otkx --no photorealistic, blur, extra limbs, cropped arms, cast shadows, wings, fur, feathers, sleeves, gloves, gauntlets, helmet, bronze, brass, gold, human face, long snout, chibi, anime, full body, legs visible, wide shot, small subject
```

- **A cabeça, os olhos, o ofício e o enquadramento são idênticos ao prompt masculino, palavra por palavra** — o
  que as duas imagens têm em comum é o que o modelo vai ler como "a espécie". Só três coisas mudam: a silhueta
  (`hourglass figure`, peitoral cinturado, chifres e pescoço mais finos), o metal (prata) e a paleta da escama.
- **A cintura vem da peça, não do adjetivo.** `drawing in sharply to a very narrow cinched waist` + `a wide
  leather belt pulling the waist in tight` + `a fitted leather apron below the belt`: um avental reto e grosso
  esconde qualquer cintura, então o que cria a silhueta é o cinto e o recorte do peitoral. Foi essa a lição da
  primeira rodada, em que "cintura fina" escrito como qualidade do corpo não apareceu na imagem.
- **`bronze, brass, gold` no `--no` da fêmea, `silver, steel` no do macho** — os metais escorregam um pro outro
  entre seeds, e é o contraste entre eles que separa os dois gêneros à primeira vista.
- **Comprimento:** os dois ficam perto de 200 palavras — acima do maior prompt já validado do pacote (185),
  porque esta espécie paga três cláusulas que as outras não pagam: enquadramento explícito, roupa e metal
  travado. O preâmbulo de estilo é compartilhado palavra por palavra com `ssm_astral`/`ssm_default`/
  `ssm_mermaids`; a cauda de enquadramento diverge de propósito, pelo motivo do bullet acima. Prompt inflado no
  Midjourney não acrescenta detalhe: dilui o peso de cada termo, e o primeiro a se perder costuma ser justamente
  a exclusão que importa — por isso cada cláusula nova aqui foi paga cortando uma redundância, em vez de só
  empilhada no fim.

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
   `assets/portraits/ssm_drakelings/reference_male_1.png` e `reference_female_1.png`; então trocar o
   `referenceImage` de cada bloco, que hoje aponta os dois pra `reference_flat_1.png` (provisório — ver "Estado
   das referências" acima). A fêmea é a que mais ganha com isso: a referência atual é um macho de bronze sem
   cintura.
2. `bun run art ssm_drakelings male` e `bun run art ssm_drakelings female` pra gerar os lotes em staging,
   revisar, e `-p` pra promover pra `assets/portraits/ssm_drakelings/male/001.png`..`015.png` e
   `female/001.png`..`015.png`. **Enquanto os 30 PNGs não existirem, `bun run portrait` sem filtro aborta o
   repositório inteiro** (a contagem declarada não bate com os PNGs encontrados, sem escrever nem apagar nada);
   no intervalo, use `bun run portrait <slug>` por espécie.
3. Registrar a espécie em `mod/`: `common/species_classes/ssm_species_classes.txt`,
   `common/portrait_sets/ssm_portrait_sets.txt` e `common/portrait_categories/ssm_portrait_categories.txt`.
   **Decisão em aberto:** qual `species_class` usar, já que a natural (`INF`) é gated por DLC — ver a seção
   "`species_class = INF` é gated por DLC (`has_infernals`)" acima, com as quatro saídas possíveis.
4. Opcionalmente, espécies-flavor em `assets/name_lists/*.json` (`species_names`) apontando pro portrait
   `ssm_drakelings` — ver `docs/pipeline-nomes.md`.
