# ssm_timbot

**Nome exibido:** Timbot
**Species class:** MACHINE (abas `machines`, `synthetics`, `cybernetics`)
**Rig:** `ssm_shared`
**Gêneros:** sem gênero (`counts: { genderless: 25 }`)

## Descrição

Robô-mascote do mod: humanoide pequeno e amigável, carcaça de **plástico moldado fosco**, cabeça grande sobre
corpo articulado esguio, olhos de LED acesos numa tela facial escura, juntas escuras expostas e fole sanfonado
no pescoço e na cintura. Estética de robô companheiro/utilitário, não militar — limpo, arredondado, com cara de
brinquedo injetado: emendas e linhas de partição de molde à mostra, brilho satinado leve, **nada de metal nu,
cromado ou aço escovado**.

A identidade é a **linha de produção**: as 25 unidades são o mesmo modelo, sempre no mesmo material. O que
distingue uma unidade da outra é o **formato da cabeça**, o **desenho do glifo dos olhos** e as **duas cores**,
uma por campo:

- **`torso.primary_color` é a cor da unidade** — plástico sólido e **saturado**, cobrindo o corpo todo: casco da
  cabeça, braços e tronco na mesma cor. Aparece em dois fragmentos do prompt, um para o corpo e um só para a
  cabeça (veja abaixo).
- **`eyes.primary_color` é a cor da luz** — o LED dos olhos e, junto com ele, as faixas luminosas e os
  indicadores do chassi, pra todo brilho da unidade ser de uma cor só.

Nenhuma das duas seções declara `secondary_color`: uma unidade é uma cor de corpo mais uma cor de luz, e nada
além disso.

A paleta é **espalhada pelo círculo cromático de propósito**, não sorteada: 20 cores de carcaça em 25 unidades,
com no máximo duas unidades por matiz e os arroxeados deliberadamente contidos (`Violet`, `Purple`, `Indigo`,
uma unidade cada), que é onde o conjunto tende a se acumular sozinho. As famílias: neutro (`White`,
`Charcoal`), vermelho (`Red` ×2, `Maroon`, `Coral`, `Rose`), laranja/amarelo (`Orange` ×2, `Yellow` ×2), verde
(`Green` ×2, `Emerald`, `Lime`), água (`Teal`, `Turquoise`, `Cyan`), azul (`Blue` ×2, `Navy`), roxo (`Indigo`,
`Violet`, `Purple`) e `Magenta`.

A cor da luz é escolhida por unidade pra brigar bem com a própria carcaça — `Orange` com `Amber`, `Purple` com
`Lime`, `Maroon` com `Gold`, `Emerald` com `Lime`.

**A ordem ao longo da numeração também é escolhida**, não é a ordem em que as cores foram pensadas: unidades
vizinhas ficam a pelo menos 120° de matiz uma da outra, e nenhum matiz se repete dentro de uma janela de duas
posições. É o que evita ver duas unidades quase iguais lado a lado — a numeração é a ordem em que o jogo
enfileira os retratos, então vizinho na lista é vizinho na tela.

**A `001` é a unidade branca** (`White` + luz `Cyan`) — o Timbot "de fábrica", o mesmo visual das artes legadas
e da imagem de referência. É a primeira do lote.

**Nenhuma unidade tem antena.** A silhueta da cabeça é fechada: nada de haste, antena, chifre ou apêndice
saindo do topo — o modelo desenha qualquer haste fina como chifre, e o resultado descaracteriza o mascote. Os
oito formatos de cabeça em uso variam por **volume e faceplate** (domo, esfera lisa, cubo chanfrado, cápsula
alongada, oval largo, capacete com visor, discos laterais de "orelha", crista central rente ao crânio), nunca
por algo espetado. Isso vale também nos prompts de referência, que barram `antenna` no `--no`.

**Os olhos são sempre digitais**: gráficos emissivos desenhados em luz sobre uma tela facial escura e brilhante,
nunca lentes ópticas de vidro com íris. O que varia entre unidades é o desenho aceso na tela (anéis, matriz de
pixels, barras, arcos, fenda), não a tecnologia por trás dele.

`portrait.json` tem `geracaoArt` configurado no pipeline atual (Flux.2 Klein, `variant: "distilled"`,
`aspectRatio: "2:3"`):

- `species`: `{ archetype: "Robot", template: "<species.archetype>, cute humanoid mascot companion robot,
  injection-molded plastic construction, soft matte plastic shell with a light satin sheen, ..." }`, com
  `extra` reforçando o material (`molded plastic surfaces throughout, visible panel seams and parting lines,
  matte plastic finish, no bare metal, no chrome`). O negativo global do `base.json` já traz `glossy`, o que
  empurra na mesma direção do acabamento fosco.
- `person.extra` (nível `base`): `(the head shell is molded in solid <torso.primary_color> plastic, the exact
  same color as the body:1.2)` — a cor precisa ser dita **duas vezes**, uma para o corpo e outra para a cabeça.
  O template do torso sozinho colore o tronco e deixa a cabeça por conta da `referenceImage`, que é branca; este
  fragmento entra cedo (a `order` põe `person` antes de `eyes.extra`/`torso`) e com peso `1.2`, logo antes do
  formato de cabeça que cada variante declara no próprio `person.extra` — os dois concatenam, base primeiro.
- `torso`: `{ state: "FullyCovered", template: "sealed robotic chassis of (matte molded plastic in bold
  saturated <torso.primary_color>:1.4), ... glowing <eyes.primary_color> light strips ..., head shell, arms and
  body molded in that same solid plastic color" }` — o peso `1.4` na cor está aí porque a `referenceImage`
  em uso é um robô branco, e sem ênfase o `ReferenceLatent` puxa toda unidade de volta pro branco. É o único
  lugar onde `<torso.primary_color>` aparece; `<eyes.primary_color>` aparece aqui e no template dos olhos, que
  é o que faz o brilho do corpo e o dos olhos serem a mesma cor.
- `eyes.template` (nível `base`) carrega a âncora com peso: `(large glowing <eyes.primary_color> LED eyes lit
  on a dark glossy digital display face:1.3)`. **`eyes.primary_color`, não `eyes.color`**: o vocabulário de
  `color` é de íris humana (`Blue`, `Hazel`...) e não tem as cores de LED; `primary_color` usa a lista genérica
  de cores, a mesma de `hair`/`torso`.
- Por variante: `person.extra` (formato da cabeça), `eyes.extra` (desenho do glifo),
  `torso.primary_color` (corpo) e `eyes.primary_color` (luz). **`eyes.shape` não é declarado**: o vocabulário dele é anatômico
  humano ("almond-shaped eyes", "upturned outer eye corners") e entra cedo no prompt pela `order`, competindo com
  o glifo digital — no primeiro lote era ele que vencia, devolvendo olho redondo com íris.
- **Sem `hair`, sem `person.ethnicity`, sem `person.gender`** — é um robô; declarar a seção `hair` faria o
  template default emitir "hair" no prompt.

Confira o texto composto sem gastar GPU com `bun run art ssm_timbot genderless -n 001 -e`.

## Por que estas referências precisam existir

O primeiro lote de 25 saiu com **a cabeça obedecida 1 vez em 7** conferidas: quase toda unidade voltou ao mesmo
domo arredondado, várias com antenas que a receita daquela variante não pedia. A causa é a cadeia de
`ReferenceLatent`: as referências em uso eram recortes das artes legadas (`012.png` e `023.png`), e as duas são o
mesmo desenho — domo liso, antenas, olho redondo com íris. O texto que descreve uma cabeça cúbica não vence uma
imagem que mostra um domo. O olho de íris das legadas é também o motivo de os prompts abaixo insistirem em tela
digital e barrarem `glass camera lens`/`realistic iris` no `--no`.

**Hoje o `portrait.json` declara uma única `referenceImage`: `reference/genderless_c.png`** — a cápsula
alongada do prompt C, gerada do zero. Uma imagem só, em vez das quatro do plano abaixo, mantém a âncora de
proporção/acabamento sem que a cadeia inteira imponha um formato de cabeça. Ela é, porém, **um robô branco
brilhante**: é dela que vem a pressão pro branco que o peso `1.4` na cor do chassi existe pra contrabalançar.
Se as unidades continuarem saindo esbranquiçadas ou com cara de cerâmica polida, a referência é a primeira
suspeita — o caminho é regerar `genderless_a.png` pelo prompt A abaixo (plástico fosco, cor saturada) e promovê-la
a primeira da lista, ou remover a referência e gerar em txt2img puro.

A mecânica que orienta os prompts abaixo: **`referenceImage` é declarada por gênero, não por variante**
(`geracaoArt.genderless.referenceImage`), e cada imagem entra numa cadeia que se aplica igualmente às 25
unidades — não há como dar uma referência por cabeça. Logo:

> A referência deve fixar o que é **comum a todas as unidades** (material, acabamento, proporção, chassi,
> iluminação) e ser deliberadamente **neutra no que precisa variar** (formato da cabeça, desenho do olho e cor).

Daí os quatro prompts: um que ancora corpo/material com a cabeça mais discreta possível, e três que mostram
cabeças **claramente diferentes entre si**, pra a cadeia não convergir num formato só. **A ordem importa** — a
primeira da lista domina mais o resultado (`docs/pipeline-generate-art.md`, seção "Peças do pipeline").

## Requisitos comuns (valem para todos os prompts)

Estes não são preferência estética; é o que o pipeline precisa:

- **Fundo branco puro e liso**, sem cenário, sem chão, sem sombra projetada — o workflow remove o fundo por canal
  alfa, e qualquer gradiente/sombra vira franja no recorte.
- **Luz frontal chapada, sem sombra dura e sem rim light** — o rig de retrato mostra a arte plana; sombra
  direcional briga com o `fixed.view` do pipeline.
- **Enquadramento busto**, personagem de frente, olhando pra câmera, cortado na cintura. Pedir isso no texto não
  basta: a primeira rodada saiu de corpo inteiro mesmo com `waist-up portrait framing` escrito. O que resolve é
  o **`--no full body, legs, wide shot`**, que o `ssm_drakelings` já usava e faltava aqui.
- **Prompt curto, ~50 palavras.** O Midjourney reparte a atenção entre os termos, então um prompt de 90 palavras
  dilui justamente o que precisa mandar (cabeça, olho, enquadramento) no meio de adjetivos de acabamento. Ao
  ajustar qualquer prompt daqui, prefira trocar uma palavra a acrescentar uma frase.
- **Um robô só na imagem**, sem texto, sem logo, sem UI, sem moldura.
- **Não fotorrealista** — render CGI estilizado de jogo, que é o alvo do `fixed.style`.
- **`--v 8.2 --style raw --profile zj9otkx`** — versão e perfil da rodada atual, os mesmos de
  `ssm_drakelings`. Manter o perfil entre os quatro prompts é o que faz as referências parecerem saídas da mesma
  mão; trocar o perfil no meio do conjunto reintroduz variação de estilo justamente onde ela não deveria existir.
- **`--ar 2:3`** aqui (e não o `4:5` do `ssm_astral`/`ssm_drakelings`) porque é o `aspectRatio` que o
  `geracaoArt` do Timbot usa. A referência não é recortada pelo pipeline — é escalada pra ~1 megapixel
  preservando a proporção —, mas casar as duas evita que o enquadramento da referência sugira um quadro
  diferente do que vai ser gerado.

Depois de escolher as imagens: salve como PNG em `assets/portraits/ssm_timbot/reference/` e declare os caminhos
em `geracaoArt.genderless.referenceImage`, na ordem de peso desejada. Não deixe PNG solto na raiz da pasta da
espécie — lá só vivem os `NNN.png`, e eles agora ficam em `genderless/`.

## Prompt A — âncora de chassi e material (deve ser a primeira da lista)

O papel desta imagem é fixar **material, acabamento, proporção e chassi**, não a cara. Por isso a cabeça é
descrita como lisa e simples, sem antena, sem orelheira, sem visor marcante: quanto menos personalidade tiver a
cabeça aqui, menos ela contamina as 25 unidades.

**A cor da referência não é neutra — é uma escolha.** Uma referência branca puxa as 25 unidades pro branco
(é o que acontece hoje com `genderless_c.png`); por isso os quatro prompts pedem **plástico colorido e
saturado**, cada um numa cor diferente, pra a cadeia ensinar "corpo colorido" sem fixar *qual* cor.

```prompt
stylized 3D CGI game character art, small friendly humanoid mascot robot, matte molded plastic body in bold saturated emerald green, injection-molded plastic shell with visible seam lines, dark gray joints, accordion bellows neck, glowing emerald accents, plain smooth rounded head, dark digital display face, two simple glowing LED dot eyes, waist-up bust portrait cropped at the waist, facing camera, plain white background, flat shadowless lighting --ar 2:3 --v 8.2 --style raw --profile zj9otkx --no full body, legs, wide shot, photorealistic, cast shadows, text, glass camera lens, human face, antenna, chrome, brushed metal, polished ceramic, white body
```

**Critério de aceitação:** o chassi tem que estar bonito e legível (placas, emendas, juntas, fole, luzes), o
material tem que ler como **plástico fosco injetado** (não cerâmica polida nem metal) e a cabeça tem que ser
*chata* — se a cabeça dessa imagem chamar atenção, ela vira a cabeça das 25.

## Prompt B — cabeça cúbica/facetada

```prompt
stylized 3D CGI game character art, small friendly humanoid mascot robot, matte molded plastic body in bold saturated orange, injection-molded plastic shell with visible seam lines, dark gray joints, accordion bellows neck, glowing amber accents, boxy cubic head with chamfered corners, flat digital display face, blocky pixel-art LED matrix eyes, waist-up bust portrait cropped at the waist, facing camera, plain white background, flat shadowless lighting --ar 2:3 --v 8.2 --style raw --profile zj9otkx --no full body, legs, wide shot, photorealistic, cast shadows, text, glass camera lens, human face, round dome head, antenna, chrome, brushed metal, polished ceramic, white body
```

## Prompt C — cabeça cápsula alongada com fresta de visor

```prompt
stylized 3D CGI game character art, small friendly humanoid mascot robot, matte molded plastic body in bold saturated blue, injection-molded plastic shell with visible seam lines, dark gray joints, accordion bellows neck, glowing azure accents, tall elongated capsule head, narrow digital display face, two thin horizontal glowing LED bars for eyes, waist-up bust portrait cropped at the waist, facing camera, plain white background, flat shadowless lighting --ar 2:3 --v 8.2 --style raw --profile zj9otkx --no full body, legs, wide shot, photorealistic, cast shadows, text, glass camera lens, human face, round dome head, antenna, chrome, brushed metal, polished ceramic, white body
```

## Prompt D — cabeça esférica lisa com olho único em anéis de LED

```prompt
stylized 3D CGI game character art, small friendly humanoid mascot robot, matte molded plastic body in bold saturated magenta, injection-molded plastic shell with visible seam lines, dark gray joints, accordion bellows neck, glowing violet accents, perfectly spherical smooth head, wide digital display face, one big central eye of concentric glowing LED rings, waist-up bust portrait cropped at the waist, facing camera, plain white background, flat shadowless lighting --ar 2:3 --v 8.2 --style raw --profile zj9otkx --no full body, legs, wide shot, photorealistic, cast shadows, text, glass camera lens, human face, two eyes, antenna, chrome, brushed metal, polished ceramic, white body
```

## Como escolher e instalar

1. Gere os quatro e escolha **uma imagem por prompt** — o valor está no contraste entre elas, então evite
   escolher quatro variações parecidas do mesmo upscale.
2. Salve em `assets/portraits/ssm_timbot/reference/` como `genderless_a.png` (A), `genderless_b.png` (B),
   `genderless_c.png` (C), `genderless_d.png` (D).
3. Declare em `portrait.json`, com A primeiro (é a âncora que deve dominar):

   ```jsonc
   "genderless": {
     "referenceImage": [
       "assets/portraits/ssm_timbot/reference/genderless_a.png",
       "assets/portraits/ssm_timbot/reference/genderless_b.png",
       "assets/portraits/ssm_timbot/reference/genderless_c.png",
       "assets/portraits/ssm_timbot/reference/genderless_d.png"
     ],
     "variantes": { /* ... */ }
   }
   ```

4. Teste com uma amostra pequena antes do lote, escolhendo variantes de cabeças diferentes:
   `bun run art ssm_timbot genderless -n 004,005,013,015,019`.

Se mesmo assim a cabeça continuar convergindo, as duas alavancas seguintes, nesta ordem: mover a descrição de
cabeça e glifo de `person.extra`/`eyes.extra` para o **`eyes.template` da própria variante** (posição de âncora,
2º fragmento do prompt, com peso), e remover `eyes.shape`, que emite "round-shaped eyes" cedo e reforça
justamente o olho redondo que se quer variar.

## Atenção

As referências antigas (`genderless_a.png`/`genderless_b.png` desta sessão) eram **recortes das artes legadas**
`012.png` e `023.png`, não imagens geradas do zero. Ao substituí-las pelos resultados dos prompts acima, os
arquivos de mesmo nome são sobrescritos — o histórico do git guarda os antigos.
