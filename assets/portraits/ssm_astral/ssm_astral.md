# ssm_astral

**Nome exibido:** Astral
**Species class:** HUM (a confirmar)
**Rig:** `ssm_shared` (migrada — antes foi revertida pro `sl_shared` na preparação da release 1.8.0 por
variantes desalinhadas entre si, ver `docs/future-plans.md`; remigrada depois)
**Gendered:** sim (`male`/`female`, 25/25 variantes)

## Descrição

Retrato "astral"/místico do mod: humanoides encapuzados/armadurados com olhos brilhantes sem pupila (roxo/magenta)
e uma gema/cristal energético no peito, ligado por veias de energia que se espalham pela armadura — estética de
ordem mística ou entidade cósmica, tons dominantes roxo, violeta e preto com metal escuro/bronze.

`portrait.json` já tem `geracaoArt` configurado, no schema/pipeline atual (Flux.2 Klein —
`scripts/portrait-schema/`, `docs/history/2026-08-08-generate-art-schema-proprio.md`):

- `tipo`: `{ value: "Human", description: "mystical order warrior, cosmic sentinel aesthetic, glowing purple
  eyes, no visible pupils" }`.
- `eyes.color`: `"Violet"` (fixo — é o traço de identidade mais reconhecível da espécie, por isso vive como campo
  estruturado dedicado, não só texto).
- `torso`: `{ state: "FullyCovered", description: "dark purple-violet ornate armor with bronze and gold trim,
  purple star-shaped mineral gem embedded in chest, faceted raw crystal cut with sharp angular multi-pointed star
  facets, geometric star-cut gemstone with visible facet edges and depth, purple energy veins spreading across
  the armor from the crystal" }`.
- `extra_prompt` (nível `base`): positivo `"(no helmet, no hood, no head covering, full head of hair:1.2), face
  fully visible"`; negativo `"(circular orb, round gem:1.2), sphere gem, ball-shaped gem, glowing orb, magic orb,
  flat painted symbol, concentric rings, hood, cloak, cape"` (exclui explicitamente as leituras erradas de gema
  que apareceram em testes).
- `extra_prompt.positive` (nível `male`): `"strong masculine face, square jawline, defined brow ridge, broad
  shoulders"`.
- `modelo`: `{ variant: "distilled", steps: 4, cfg: 1, aspectRatio: "4:5" }` — canvas de geração efetivo 912×1152
  (ver `scripts/generate-art/resolution.ts`); variante "distilled" quer dizer que o negativo acima é **descartado**
  pelo grafo (CFG=1 zera a guidance negativa via `ConditioningZeroOut` — ver "Armadilhas conhecidas" na skill
  `gerar-geracao-arte`), então quem carrega peso de verdade é o positivo.

Os prompts abaixo documentam as imagens de referência/conceito (`reference_male_1.png`, `reference_male_2.png`,
`reference_female.png`) usadas por esse `geracaoArt` — cada uma entra numa cadeia de `ReferenceLatent` (não
ControlNet/img2img: sem exigência de pose esquelética visível, sem denoise, sem crop pro canvas de geração — a
referência é só escalada independentemente pra ~1 megapixel via `ImageScaleToTotalPixels`, ver
`scripts/generate-art/workflow.ts`). Cada mudança de prompt aqui deveria ser espelhada no `geracaoArt` acima (e
vice-versa) pra documentação e configuração não divergirem. Use `bun run generate-art ssm_astral male
--variante=001 --export-prompt` (ou `female`) pra conferir o texto composto de verdade sem gastar GPU.

## Prompt de referência (Midjourney) — Male

`male.referenceImage` hoje é uma **lista de duas imagens** (`reference_male_1.png`, `reference_male_2.png`),
encadeadas via `ReferenceLatent` pra dar mais amplitude visual ao resultado — decisão tomada na migração pro
pipeline atual (antes era uma referência única). Só `reference_male_1.png` (a imagem original, renomeada nessa
migração) tem o prompt de geração documentado abaixo; **`reference_male_2.png` não tem prompt registrado neste
arquivo** — se for regenerada/substituída, documente o prompt usado aqui.

Descreve `reference_male_1.png`: homem branco, barba ruiva rala, cabelo ruivo curto, olhos brilhantes roxos sem
pupila, expressão séria, armadura roxo-escura com detalhes dourados/bronze, sem capuz/capa (cabeça e cabelo
totalmente visíveis), ombreiras com emblema de runas, estrela mineral facetada (como um cristal bruto lapidado)
brilhando roxo, embutida no peito, cinto com fivela circular com símbolo de estrela. **Braços precisam caber
inteiros dentro do quadro**, sem cortar nas bordas — enquadramento mais aberto que um closeup.

```prompt
3D render CGI character art, stylized video game character art, digital painting style, not photorealistic, full-color character concept art of a caucasian man, short ginger hair, light ginger stubble beard, glowing purple eyes, no visible pupils, serious stern expression, mystical order warrior, no hood, no cloak, no cape, bare head with hair fully visible, dark purple ornate armor with bronze and gold trim, shoulder pauldrons engraved with runic sigils, glowing purple star-shaped mineral gem embedded in chest armor, faceted raw crystal cut like a multi-pointed star, gemstone texture not a flat painted symbol, belt with circular star-emblem buckle, standing pose, medium shot, full arms visible within frame, arms not cropped by frame edges, looking directly at camera, plain solid white background, pure white backdrop, sharp focus, clean character turnaround lighting, flat direct front lighting, no cast shadows, shadowless lighting --ar 4:5 --v 6.1 --style raw --no photorealistic, blur, extra limbs, cropped arms, cast shadows, drop shadow, hood, cloak, cape
```

- Mesmos parâmetros de estilo/fundo/luz do padrão do pacote (`--style raw`, fundo branco liso, luz frontal sem
  sombra) — ver rationale em `assets/portraits/ssm_default/ssm_default.md`.
- Olhos "sem pupila" e o cristal do peito são os elementos de identidade visual da espécie; vale reforçá-los
  explicitamente em qualquer variante nova pra manter consistência entre as 25 variantes masculinas.
- **Braços dentro do quadro:** a primeira tentativa (`--ar 2:3` + `full arms visible within frame` só no texto)
  ainda cortou os braços nas bordas laterais — a pose (mãos perto do cinto/quadril, cotovelos afastados do
  tronco) é larga demais pro quadro vertical estreito de 2:3 no zoom de "medium shot"; é geometria, não só
  palavra-chave. Trocado pra **`--ar 4:5`** (menos alongado, mais largura relativa) pra dar espaço lateral à pose
  sem precisar fechar os braços — se ainda cortar, o próximo passo é `--ar 1:1` ou fechar a pose (`arms close to
  torso, elbows tucked in, no hands on hips`) em vez de abrir mais o quadro.
- O pipeline atual (`ImageScaleToTotalPixels` do workflow, ver `scripts/generate-art/workflow.ts`) **não recorta**
  a referência pro canvas de geração — só escala pra ~1 megapixel preservando a proporção original, então o corte
  de braço só depende do enquadramento da própria referência, não de um center-crop pra um canvas fixo (diferente
  do pipeline SDXL anterior, que usava a referência como base de img2img num canvas fixo).
- **Cristal como mineral, não símbolo:** reforçado como gema facetada/lapidada (textura de cristal bruto), não um
  desenho plano de estrela — é essa leitura que `reference_male_1.png` fixa como padrão da espécie.

## Prompt de referência (Midjourney) — Female

Descreve `reference_female.png` (gerada do zero via Midjourney, não é mais um trim de arte legada — ver "Atenção"
no fim): mulher de cabelo longo, escuro roxo-arroxeado, olhos brilhantes roxos sem pupila, rosto anguloso,
armadura justa preto-arroxeada com gola alta, ombreiras pontudas estilo lâmina em tom roxo-escuro, cristal em
formato de losango/diamante facetado com um brilho em estrela no centro (4 pontas), embutido no peito, com veias
de energia elétrica descendo pelo torso. **Braços precisam caber inteiros dentro do quadro**, sem cortar nas
bordas — mesmo ajuste feito no prompt masculino.

```prompt
3D render CGI character art, stylized video game character art, digital painting style, not photorealistic, full-color character concept art of a woman, long dark purple hair, glowing purple eyes, no visible pupils, sharp angular face, serious expression, mystical order warrior, wearing a fitted dark purple-black armored bodysuit with high collar, blade-like dark purple shoulder pauldrons, glowing purple diamond-shaped faceted mineral gem embedded in chest with a four-pointed starburst glow at its center, purple energy veins/lightning spreading down the torso from the crystal, standing pose, medium shot, full arms visible within frame, arms not cropped by frame edges, looking directly at camera, plain solid white background, pure white backdrop, sharp focus, clean character turnaround lighting, flat direct front lighting, no cast shadows, shadowless lighting --ar 4:5 --v 6.1 --style raw --no photorealistic, blur, extra limbs, cropped arms, cast shadows, drop shadow
```

- Mesmos parâmetros de estilo/fundo/luz do prompt masculino, pelos mesmos motivos.
- **Cristal em diamante, não estrela de 6 pontas como o masculino** — na prática o Midjourney rendeu
  "star-shaped mineral gem" como um losango facetado com um brilho de estrela de 4 pontas no centro, em vez de um
  emblema hexagonal como o do macho. Mantido assim porque ficou visualmente consistente com o traje mais justo
  (menos "placas de armadura", mais "gema cravejada no couro") — os dois gêneros continuam com a mesma família de
  identidade (roxo brilhante, facetado, sem ser um símbolo plano), só não são a mesma silhueta.
- **`--ar 4:5`** pelo mesmo motivo do prompt masculino (2:3 cortava os braços num "medium shot" com pose larga) —
  ver nota detalhada lá em cima.
- **Atenção:** `reference_female.png` agora é uma geração própria e dedicada (960×1200, `--ar 4:5`), **não** mais
  o trim de `female/019.png` que era usado antes — `geracaoArt.female.referenceImage` já aponta pra ela (antes
  apontava pra `reference_male.png`/`reference_male_1.png`, decisão revertida quando essa referência feminina
  ficou disponível).
