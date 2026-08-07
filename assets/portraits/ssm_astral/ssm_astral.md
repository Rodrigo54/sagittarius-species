# ssm_astral

**Nome exibido:** Astral
**Species class:** HUM (a confirmar)
**Rig:** `sl_shared`
**Gendered:** sim (`male`/`female`, 15/15 variantes)

## Descrição

Retrato "astral"/místico do mod: humanoides encapuzados/armadurados com olhos brilhantes sem pupila (roxo/magenta)
e uma gema/cristal energético no peito, ligado por veias de energia que se espalham pela armadura — estética de
ordem mística ou entidade cósmica, tons dominantes roxo, violeta e preto com metal escuro/bronze.

`portrait.json` já tem `geracaoArt` configurado (rig continua `sl_shared` — legado congelado — mas a espécie
ganhou um pipeline de geração via IA em paralelo, ver `bun run generate-art`). Os prompts abaixo documentam as
referências de img2img/ControlNet (`reference_male.png`/`reference_female.png`) usadas por esse `geracaoArt`, não
são mais só uma reconstrução visual solta — cada mudança de prompt aqui deveria ser espelhada em
`geracaoArt.base.extra` (e vice-versa) pra documentação e configuração não divergirem.

## Prompt de referência (Midjourney) — Male

Descreve `reference_male.png`: homem branco, barba ruiva rala, cabelo ruivo curto, olhos brilhantes roxos sem
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
  explicitamente em qualquer variante nova pra manter consistência entre as 26 variantes masculinas.
- **Braços dentro do quadro:** a primeira tentativa (`--ar 2:3` + `full arms visible within frame` só no texto)
  ainda cortou os braços nas bordas laterais — a pose (mãos perto do cinto/quadril, cotovelos afastados do
  tronco) é larga demais pro quadro vertical estreito de 2:3 no zoom de "medium shot"; é geometria, não só
  palavra-chave. Trocado pra **`--ar 4:5`** (menos alongado, mais largura relativa) pra dar espaço lateral à pose
  sem precisar fechar os braços — se ainda cortar, o próximo passo é `--ar 1:1` ou fechar a pose (`arms close to
  torso, elbows tucked in, no hands on hips`) em vez de abrir mais o quadro.
- O pipeline (`generate-art`/`ImageScale` do workflow) faz *center-crop* da referência pro canvas de img2img
  (832×1216, proporção ~0.68) — uma referência mais larga (`4:5` ≈ 0.8) perde um pouco de topo/base nesse recorte,
  não de lateral, então não reintroduz o corte de braço.
- **Cristal como mineral, não símbolo:** reforçado como gema facetada/lapidada (textura de cristal bruto), não um
  desenho plano de estrela — é essa leitura que a nova `reference_male.png` fixa como padrão da espécie.

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
  o trim de `female/019.png` que era usado antes — `geracaoArt.female.referenceImage` já aponta pra ela
  (antes apontava pra `reference_male.png`, decisão revertida quando essa referência feminina ficou disponível).
