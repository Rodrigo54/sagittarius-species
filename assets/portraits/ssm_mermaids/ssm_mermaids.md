# ssm_mermaids

**Nome exibido:** Mermaids
**Species class:** `AQUATIC`
**Rig:** `ssm_shared`, com `modo: "altura"`
**Gendered:** sim (`male`/`female`, 25/25 variantes)

## Descrição

Retrato "sereia/tritão" do mod: gente comum vivendo debaixo d'água — não guerreiros —, vestindo uma "roupa" de
escama de peixe cropped, com mangas compridas cobrindo braços e ombros, barriga sempre à mostra (nos dois
gêneros), e uma peça de **cintura alta** que marca a transição pra cauda. O cós alto existe pra ficar visível
dentro do enquadramento apertado do portrait, que corta na altura da cintura/quadril.

**A espécie usa `modo: "altura"` porque só nesse modo a cintura com a base da cauda fica visível.** Escalada
pela largura do guia, essa faixa da composição cai além da borda inferior do canvas e nunca chega à tela — sem
erro de validação nenhum, já que `largura` aceita esse caso em silêncio (ver "Escolher o `modo`" em
`docs/pipeline-portraits.md`). O preço é conhecido e aceito: a sereia sai menor que as espécies que escalam por
largura, e o tamanho varia um pouco entre variantes, porque cada PNG enquadra uma quantidade diferente de corpo.

A cor da escama varia livremente
por indivíduo (`torso.primary_color` no top e nas mangas, `torso.secondary_color` na cauda), sem paleta fixa de
espécie.

As 25 variantes de cada gênero em `assets/` hoje são **masters nativos gerados pelo pipeline de IA**
(`bun run art`, Flux.2 Klein), e o `portrait.json` tem `geracaoArt` completo:

- `species`: `{ archetype: "Mermaid", template: "<species.archetype>, aquatic humanoid, ordinary everyday
  person adapted to life underwater, otherwise just like humans, ... not a warrior or soldier" }` — o
  `not a warrior` é contrapeso deliberado ao viés de "guerreiro aquático" que as primeiras referências puxaram
  sozinhas (ver os prompts `Male 1`/`Male 2` mais abaixo).
- `torso`: `CroppedSleeved` na base/masculino e `PartiallyCovered` no feminino, cada um com template próprio —
  é a diferença de recorte entre os dois gêneros (gola em V com manga presa ao ombro vs. top strapless com
  manga separada começando abaixo do ombro nu).
- `male.torso.extra` carrega um bloco inteiro sobre **como o peito masculino deve ser lido** (uma superfície
  contínua, sem linha de sombra sob o peitoral): é a correção do defeito em que a malha de escama sobre o
  tronco masculino renderizava com aparência de busto feminino.
- `referenceImage` em uso hoje é **uma imagem por gênero**: `reference_male_3.png` e `reference_female_3.png`.

**Sobre os prompts abaixo:** eles são o registro de como as referências foram sendo buscadas, em ordem
cronológica de tentativa — `Male 1`/`Male 2`/`Female 1`/`Female 2` reproduziam variantes legadas específicas
(`male/001.png`, `male/008.png`, `female/001.png`, `female/011.png`, da arte de 2024 feita antes deste
pipeline), e `Male 3`/`Male 4` são as iterações que corrigiram o rumo depois que a direção da espécie mudou
para "gente comum, não guerreiro". **As duas imagens que o `portrait.json` de fato usa (`reference_male_3.png`,
`reference_female_3.png`) não têm prompt registrado aqui** — se forem regeradas ou substituídas, documente o
prompt usado.

Todos seguem o preâmbulo de estilo/luz/fundo que `ssm_astral`/`ssm_default` já validaram (evita MJ estilizar
demais a referência e evita sombra "assada" que atrapalharia o reaproveitamento via `ReferenceLatent`), mas com
dois parâmetros pontuais desta rodada, diferentes dos outros dois arquivos: **`--v 8.2`** (em vez de `--v 6.1`)
e **`--profile zj9otkx`** (perfil customizado do Midjourney).

## Prompt de referência (Midjourney) — Male 1

Descreve `male/001.png`: homem branco, cabelo loiro-platinado curto e ondulado, corpo atlético/definido, top de
escama azul-metálica cropped com mangas compridas cobrindo peito/ombros/braços, gema clara e redonda centralizada
no esterno, acabamento de escama branca perolada nas mangas, barriga à mostra com abdômen definido, cós de
escama azul de cintura alta (visível dentro do quadro).

```prompt
3D render CGI character art, stylized video game character art, digital painting style, not photorealistic, full-color character concept art of a fair-skinned young merman, short wavy platinum blonde hair, athletic toned build, cropped metallic blue fish-scale top with long fish-scale sleeves covering the chest, shoulders and arms, small pale round gem centered at the sternum, pearlescent white fish-scale trim along the sleeves, bare toned midriff with visible abs, high-waisted matching blue fish-scale waistband sitting high on the torso, waistband visible within frame, standing pose, medium shot, full arms visible within frame, arms not cropped by frame edges, looking directly at camera, plain solid white background, pure white backdrop, sharp focus, clean character turnaround lighting, flat direct front lighting, no cast shadows, shadowless lighting --ar 3:4 --v 8.2 --style raw --profile zj9otkx --no photorealistic, blur, extra limbs, cropped arms, cast shadows, drop shadow
```

- **Manga comprida + barriga de fora + cintura alta** são um ajuste deliberado em relação à arte legada real
  (`male/001.png` tem "pauldrons" soltos nos ombros, não uma manga fechada até o punho) — decisão tomada pra esta
  rodada de referência, não reprodução literal pixel a pixel.
- `--ar 4:5`, `--style raw`, fundo branco, luz frontal sem sombra: mesmos parâmetros que `ssm_astral`/
  `ssm_default` já validaram pra referência (evita corte de braço num "medium shot", evita MJ estilizar demais,
  evita sombra atrapalhando o reaproveitamento via `ReferenceLatent`).
- `--v 8.2 --profile zj9otkx`: versão e perfil customizados desta rodada — diferente do `--v 6.1` sem perfil que
  os outros dois arquivos documentam.

## Prompt de referência (Midjourney) — Male 2

Descreve `male/008.png`: homem branco, cabelo loiro penteado pra trás (sem cair na testa), corpo atlético/
definido, top de escama dourada com gradiente verde cropped com mangas compridas cobrindo peito/ombros/braços,
emblema dourado em formato de estrela centralizado no esterno, acabamento pontudo tipo nadadeira nos punhos das
mangas, barriga à mostra com abdômen definido, cós de escama dourada/verde de cintura alta (visível dentro do
quadro).

```prompt
3D render CGI character art, stylized video game character art, digital painting style, not photorealistic, full-color character concept art of a fair-skinned young merman, wavy blonde hair swept back off the forehead, athletic toned build, cropped gold and green fish-scale top with long fish-scale sleeves covering the chest, shoulders and arms, gold star-shaped emblem centered at the sternum, pointed fin-like gold trim along the sleeve cuffs, bare toned midriff with visible abs, high-waisted matching gold and green fish-scale waistband sitting high on the torso, waistband visible within frame, standing pose, medium shot, full arms visible within frame, arms not cropped by frame edges, looking directly at camera, plain solid white background, pure white backdrop, sharp focus, clean character turnaround lighting, flat direct front lighting, no cast shadows, shadowless lighting --ar 4:5 --v 8.2 --style raw --profile zj9otkx --no photorealistic, blur, extra limbs, cropped arms, cast shadows, drop shadow
```

- Mesmos ajustes de manga comprida/barriga de fora/cintura alta do Male 1, pelos mesmos motivos.
- **Acabamento pontudo tipo nadadeira** é o traço que mais distingue essa referência da anterior — no artwork
  original, aparece como guardas de ombro/punho em pontas douradas, mantido aqui como detalhe do punho da manga
  em vez de peça solta.
- Mesmos parâmetros de estilo/fundo/luz/versão/perfil do Male 1, pelos mesmos motivos.

## Prompt de referência (Midjourney) — Female 1

Descreve `female/001.png`: mulher branca, cabelo rosa-candy ondulado na altura dos ombros, brincos de gema
turquesa, corpo atlético/definido, top de escama rosa cropped com mangas compridas cobrindo peito/ombros/braços,
gema turquesa pequena centralizada no decote, barriga à mostra, cós de escama turquesa de cintura alta (visível
dentro do quadro).

```prompt
3D render CGI character art, stylized video game character art, digital painting style, not photorealistic, full-color character concept art of a fair-skinned young mermaid woman, shoulder-length wavy candy-pink hair, teal gem drop earrings, athletic toned build, cropped pink fish-scale top with long fish-scale sleeves covering the chest, shoulders and arms, small teal gem centered at the neckline, bare toned midriff, high-waisted matching turquoise fish-scale waistband sitting high on the torso, waistband visible within frame, standing pose, medium shot, full arms visible within frame, arms not cropped by frame edges, looking directly at camera, plain solid white background, pure white backdrop, sharp focus, clean character turnaround lighting, flat direct front lighting, no cast shadows, shadowless lighting --ar 4:5 --v 8.2 --style raw --profile zj9otkx --no photorealistic, blur, extra limbs, cropped arms, cast shadows, drop shadow
```

- Mesmo ajuste de manga comprida + barriga de fora + cintura alta pedido pros dois gêneros — no artwork original,
  `female/001.png` é um top biquíni sem manga; aqui a manga cobre o braço inteiro, igual ao masculino.
- Mesmos parâmetros de estilo/fundo/luz/versão/perfil dos prompts masculinos, pelos mesmos motivos.

## Prompt de referência (Midjourney) — Female 2

Descreve `female/011.png`: mulher branca, cabelo castanho-avermelhado ondulado na altura dos ombros, brincos
pequenos dourados, corpo atlético mais curvilíneo, top de escama verde-água com dourado cropped com mangas
compridas cobrindo peito/ombros/braços, decote recortado em formato de concha com acabamento dourado, barriga à
mostra, cós de escama turquesa/dourada de cintura alta (visível dentro do quadro).

```prompt
3D render CGI character art, stylized video game character art, digital painting style, not photorealistic, full-color character concept art of a fair-skinned young mermaid woman, shoulder-length wavy light auburn hair, small gold stud earrings, curvy toned build, cropped seafoam green and gold fish-scale top with long fish-scale sleeves covering the chest, shoulders and arms, scalloped shell-shaped neckline trimmed in gold, bare toned midriff, high-waisted matching turquoise and gold fish-scale waistband sitting high on the torso, waistband visible within frame, standing pose, medium shot, full arms visible within frame, arms not cropped by frame edges, looking directly at camera, plain solid white background, pure white backdrop, sharp focus, clean character turnaround lighting, flat direct front lighting, no cast shadows, shadowless lighting --ar 4:5 --v 8.2 --style raw --profile zj9otkx --no photorealistic, blur, extra limbs, cropped arms, cast shadows, drop shadow
```

- Mesmo ajuste de manga comprida + barriga de fora + cintura alta dos outros 3 prompts.
- **Decote em formato de concha** é o traço que mais distingue essa referência da Female 1 — no artwork
  original, os "copos" do top já tinham esse recorte; mantido como detalhe da gola da manga.
- Mesmos parâmetros de estilo/fundo/luz/versão/perfil dos demais prompts.

## Prompt de referência (Midjourney) — Male 3 (ajustado: roupa leve, não armadura, estrela-do-mar)

Depois dos dois primeiros testes (`Male 1`/`Male 2` acima), o direcionamento da espécie mudou: mermaids não são
guerreiros — são gente comum vivendo debaixo d'água, igual aos humanos padrão do mod (`ssm_default`), só que
aquáticos. `reference_male_3.png` (gerada fora deste prompt, sem texto registrado) já acertou o corte (top em V
cropped, cintura alta, barriga de fora), mas ainda tem dois traços de "guerreiro" que destoam da direção nova:
as braçadeiras/luvas com pontas rígidas douradas (tipo espinho) e o emblema no peito, uma estrela geométrica lisa
de 5 pontas em vez de uma estrela-do-mar de verdade (braços orgânicos, arredondados, textura de casca). O prompt
abaixo é a próxima iteração, corrigindo os dois.

```prompt
3D render CGI character art, stylized video game character art, digital painting style, not photorealistic, full-color character concept art of a fair-skinned young merman, wavy golden blonde hair swept back off the forehead, athletic toned build, ordinary everyday person, not a warrior, cropped lightweight fish-scale fabric top with a V-neck, soft and form-fitting like swimwear, not hard armor, long matching fish-scale sleeves covering the shoulders and arms, small starfish-shaped ornament centered on the chest, organic five-armed starfish with a textured bumpy surface, not a geometric star, bare toned midriff with visible abs, high-waisted matching fish-scale waistband sitting high on the torso, waistband visible within frame, standing pose, medium shot, full arms visible within frame, arms not cropped by frame edges, looking directly at camera, plain solid white background, pure white backdrop, sharp focus, clean character turnaround lighting, flat direct front lighting, no cast shadows, shadowless lighting --ar 4:5 --v 8.2 --style raw --profile zj9otkx --no photorealistic, blur, extra limbs, cropped arms, cast shadows, drop shadow, hard armor, metal armor plating, pointed spikes, spiked gauntlets, shoulder pauldrons, warrior, soldier, weapon
```

- **`not a warrior`/`ordinary everyday person`** logo cedo no prompt, e `warrior, soldier, weapon` no `--no` —
  contrapeso direto ao viés "guerreiro aquático" que as referências anteriores (`Male 1`/`Male 2`, e a própria
  `reference_male_3.png`) puxaram, mesmo sem essas palavras terem sido pedidas de propósito.
- **`soft and form-fitting like swimwear, not hard armor`** + `hard armor, metal armor plating` no `--no` —
  mesma lógica: nomeia o material errado explicitamente pra excluir, não só descreve o certo.
- **`organic five-armed starfish with a textured bumpy surface, not a geometric star`** — reforça a forma
  orgânica da estrela-do-mar contra a leitura mais fácil/comum de "estrela geométrica lisa" que apareceu em
  `reference_male_3.png` e no emblema de `Male 2`.
- **`pointed spikes, spiked gauntlets, shoulder pauldrons`** no `--no` — exclui especificamente o elemento que
  mais destoou em `reference_male_3.png` (as braçadeiras com pontas douradas).
- Resto dos parâmetros (`--ar 4:5 --v 8.2 --style raw --profile zj9otkx`, fundo branco, luz frontal sem sombra)
  igual aos prompts anteriores, mesmo motivo.

## Prompt de referência (Midjourney) — Male 4 (cota de malha de escama, não tecido leve)

O teste de `Male 3` (roupa leve tipo "swimwear") não ficou bom visualmente. Voltamos pra armadura, mas leve/
flexível — cota de malha (escamas sobrepostas e articuladas, como anéis de metal numa cota de malha tradicional)
em vez da placa rígida que apareceu em `reference_male_3.png`/`Male 2`. O ajuste da estrela-do-mar (contra
estrela geométrica lisa) e a exclusão das braçadeiras pontudas continuam valendo.

```prompt
3D render CGI character art, stylized video game character art, digital painting style, not photorealistic, full-color character concept art of a fair-skinned young merman, wavy golden blonde hair swept back off the forehead, athletic toned build, ordinary everyday person, not a warrior, cropped lightweight fish-scale armor top with a V-neck, flexible scale-mail construction, overlapping fish scales linked like chainmail rather than rigid plates, long matching fish-scale sleeves covering the shoulders and arms, small starfish-shaped ornament centered on the chest, organic five-armed starfish with a textured bumpy surface, not a geometric star, bare toned midriff with visible abs, high-waisted matching fish-scale waistband sitting high on the torso, waistband visible within frame, standing pose, medium shot, full arms visible within frame, arms not cropped by frame edges, looking directly at camera, plain solid white background, pure white backdrop, sharp focus, clean character turnaround lighting, flat direct front lighting, no cast shadows, shadowless lighting --ar 4:5 --v 8.2 --style raw --profile zj9otkx --no photorealistic, blur, extra limbs, cropped arms, cast shadows, drop shadow, rigid plate armor, hard shell armor, pointed spikes, spiked gauntlets, shoulder pauldrons, warrior, soldier, weapon
```

- **`flexible scale-mail construction, overlapping fish scales linked like chainmail rather than rigid plates`**
  — é o núcleo do ajuste: ainda é armadura (`armor` continua no texto, não foi removido como em `Male 3`), só
  que o material pedido é malha articulada, não placa sólida. `rigid plate armor, hard shell armor` entram no
  `--no` como o oposto explícito.
- **`organic five-armed starfish...`/`pointed spikes, spiked gauntlets, shoulder pauldrons`** — mantidos de
  `Male 3`, não eram o problema dessa rodada.
- Resto igual aos prompts anteriores (`--ar 4:5 --v 8.2 --style raw --profile zj9otkx`, fundo branco, luz frontal
  sem sombra).

## Estado atual

A migração pro `ssm_shared` e a regeração completa da arte via IA foram concluídas em 2026-08-14 — relato do
que travava antes e do que destravou: `docs/history/2026-08-14-mermaids-remigracao.md`. As imagens de
referência em uso são `reference_male_3.png`/`reference_female_3.png`; os prompts acima documentam as
tentativas que levaram até elas, não as imagens finais.
