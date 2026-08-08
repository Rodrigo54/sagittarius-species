# ssm_default

**Nome exibido:** Humans (augmented realism)
**Species class:** HUM
**Rig:** `ssm_shared`
**Gendered:** sim (`male`/`female`, 25 variantes cada)

## Descrição

Retrato humano "realista aumentado" do mod: humanos convencionais vestidos com equipamento militar/espacial de
ficção científica — traje espacial futurista com placas metálicas, uniforme de astronauta, armadura estilo space
marine, sem capacete (rosto sempre visível). É a linha de base humana do pacote de espécies, servindo de
contraponto visual às espécies mais estilizadas/fantásticas (elfos, moluscos, avianos etc.).

`geracaoArt` no `portrait.json` (schema atual, ver `scripts/portrait-schema/`):

- `tipo`: `{ value: "Human", description: "futuristic sci-fi space marine" }`.
- `torso`: `{ state: "FullyCovered", description: "navy blue metallic plating, science fiction astronaut
  uniform, space marine armor, smooth flat white chest armor plate, gold metallic trim details, gold accents" }`.
- `extra_prompt.positive` (nível `base`): `"no helmet, bare head, face fully visible"`.
- Estilo de arte, pose e enquadramento **não são mais campos por espécie** — estão travados globalmente em
  `scripts/generate-art/base.json` (render 3D/CGI de personagem de videogame, digital painting, não fotorrealista,
  pose em pé com braços ao lado do corpo, plano médio, olhando pra câmera, expressão séria).

## Prompt de referência (Midjourney)

Prompt usado para gerar `reference_male.png`, com base na variante `male.001` do `portrait.json` (jovem
caucasiano, 18 anos, atlético, cabelo ondulado loiro, olhos redondos azuis):

```prompt
3D render CGI character art, stylized video game character art, digital painting style, not photorealistic, full-color character concept art of a young caucasian man, 18 years old, athletic build, flat masculine chest, muscular male torso, wavy blonde hair, round blue eyes, serious expression, confident posture, standing pose, arms at side, legs crossed, looking directly at camera, bare head, no helmet, face fully visible, wearing a futuristic sci-fi space suit with metallic plating, science fiction astronaut uniform, space marine armor, smooth flat chest armor plate, no protrusions on chest armor, medium shot, plain solid white background, pure white backdrop, sharp focus, clean character turnaround lighting, flat direct front lighting, no cast shadows, shadowless lighting --ar 2:3 --v 6.1 --style raw --no photorealistic, blur, extra limbs, helmet, cast shadows, drop shadow
```

- `--ar 2:3` aproxima a proporção do canvas do modelo (`geracaoArt.modelo.width`/`height` = 832×1216).
- `--style raw` mantém fidelidade aos detalhes do prompt em vez de MJ estilizar demais — importante porque essa
  imagem vira `referenceImage` de todo o bloco `male` (base de pose/composição pras 25 variantes via
  ControlNet/img2img no ComfyUI), não só da variante 001.
- Fundo branco liso é proposital, pelo mesmo motivo: evita que elementos de cena "vazem" pras outras variantes.
- Luz direta e frontal sem sombras projetadas evita sombra "assada" na imagem de referência, que atrapalharia o
  ControlNet/img2img ao reaplicar a pose em variantes com poses/roupas diferentes.

## Prompt de referência (Midjourney) — Female

Prompt para gerar `reference_female.png`, com base na variante `female.001` do `portrait.json` (mulher latina,
22 anos, corpo curvy, cabelo undercut azul, olhos amendoados cor de avelã):

```prompt
3D render CGI character art, stylized video game character art, digital painting style, not photorealistic, full-color character concept art of a young latina woman, 22 years old, curvy build, blue undercut hairstyle, almond-shaped hazel eyes, serious expression, confident posture, standing pose, arms at side, legs crossed, looking directly at camera, bare head, no helmet, face fully visible, wearing a futuristic sci-fi space suit with metallic plating, science fiction astronaut uniform, space marine armor, smooth flat chest armor plate, no protrusions on chest armor, medium shot, plain solid white background, pure white backdrop, sharp focus, clean character turnaround lighting, flat direct front lighting, no cast shadows, shadowless lighting --ar 2:3 --v 6.1 --style raw --no photorealistic, blur, extra limbs, helmet, cast shadows, drop shadow
```

- Mesmos parâmetros de estilo/luz/fundo do prompt masculino, pelos mesmos motivos (fidelidade ao `--style raw`,
  imagem vira base de pose/composição de todo o bloco `female`).

## `--export-prompt`: conferir o texto composto sem gastar GPU

`bun run generate-art ssm_default male --variante=001 --export-prompt` (ou `female`) monta e imprime o prompt
final (positivo + negativo) exatamente como vai pro ComfyUI, sem enfileirar nada — útil pra conferir que
`tipo`/`torso`/`extra_prompt` estão compondo do jeito esperado antes de rodar um teste de verdade.

## Reforços conhecidos por variante

Algumas variantes têm `extra_prompt.positive` específico, além do que `base`/`male`/`female` já declaram:

- **`male/001`**: `"(young boy), flat masculine chest, male chest armor, muscular male torso"` — ajuste pontual
  de uma geração específica.
- **`male/002`**: `"(pink hair:0.8), flat masculine chest, male chest armor, muscular male torso"` — a ênfase de
  peso na cor de cabelo (rosa) fez o gênero "balançar" pra mais feminino nos testes originais; esse reforço
  fecha os três atributos (cabelo, peito masculino, torso musculoso) ao mesmo tempo (ver bug #10 em
  `generate-art-historico-da-sessao.md`).
- **Variantes com `ethnicity: "African"`** (`male`: `008`, `013`, `016`, `017`, `019`, `024`, `025`; `female`:
  `008`, `015`, `020`, `024`): `"(dark skin, deep brown skin tone, African facial features:1.3)"` — etnia é
  atributo de área pequena do rosto, perde fácil pra referência via img2img/ControlNet sem esse reforço com peso
  (`female/008` também tem `(blonde hair:1.3)` antes, porque essa variante tem cabelo loiro que também precisou
  de reforço nos testes originais).
