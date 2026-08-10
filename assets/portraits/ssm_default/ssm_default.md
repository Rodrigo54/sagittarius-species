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

`geracaoArt` no `portrait.json` (pipeline atual, Flux.2 Klein — ver `scripts/portrait-schema/`):

- `tipo`: `{ value: "Human", description: "futuristic sci-fi space marine" }`.
- `torso`: `{ state: "FullyCovered", description: "navy blue metallic plating, science fiction astronaut
  uniform, space marine armor, smooth flat white chest armor plate, gold metallic trim details, gold accents" }`.
- `extra_prompt.positive` (nível `base`): `"(no helmet, no hood, no head covering, full head of hair:1.2), face
  fully visible"`.
- `modelo`: `{ variant: "distilled", steps: 4, cfg: 1, aspectRatio: "2:3" }` — canvas de geração efetivo
  832×1248 (ver `scripts/generate-art/resolution.ts`); variante "distilled" descarta o negativo inteiro (CFG=1
  zera a guidance negativa via `ConditioningZeroOut`), então praticamente todo o controle fino mora no positivo.
- Estilo de arte, pose e enquadramento **não são campos por espécie** — estão travados globalmente em
  `scripts/generate-art/base.json` (render 3D/CGI de personagem de videogame, digital painting, não fotorrealista,
  pose em pé com braços ao lado do corpo, plano médio, olhando pra câmera, expressão séria).

## Prompt de referência (Midjourney)

Prompt usado para gerar `reference_male.png`, com base na variante `male.001` do `portrait.json` (jovem
caucasiano, 18 anos, atlético, cabelo ondulado loiro, olhos redondos azuis):

```prompt
3D render CGI character art, stylized video game character art, digital painting style, not photorealistic, full-color character concept art of a young caucasian man, 18 years old, athletic build, flat masculine chest, muscular male torso, wavy blonde hair, round blue eyes, serious expression, confident posture, standing pose, arms at side, legs crossed, looking directly at camera, bare head, no helmet, face fully visible, wearing a futuristic sci-fi space suit with metallic plating, science fiction astronaut uniform, space marine armor, smooth flat chest armor plate, no protrusions on chest armor, medium shot, plain solid white background, pure white backdrop, sharp focus, clean character turnaround lighting, flat direct front lighting, no cast shadows, shadowless lighting --ar 2:3 --v 6.1 --style raw --no photorealistic, blur, extra limbs, helmet, cast shadows, drop shadow
```

- `--ar 2:3` aproxima a proporção do canvas de geração (`geracaoArt.modelo.aspectRatio: "2:3"` → 832×1248, ver
  `scripts/generate-art/resolution.ts`).
- `--style raw` mantém fidelidade aos detalhes do prompt em vez de MJ estilizar demais — importante porque essa
  imagem vira o `referenceImage` de todo o bloco `male`, encadeada via `ReferenceLatent` (não ControlNet/img2img)
  pra dar amplitude/consistência visual às 25 variantes, não só da variante 001.
- Fundo branco liso é proposital, pelo mesmo motivo: evita que elementos de cena "vazem" pras outras variantes.
- Luz direta e frontal sem sombras projetadas evita sombra "assada" na imagem de referência, que atrapalharia a
  leitura visual da referência ao ser reaproveitada em variantes com poses/roupas diferentes.

## Prompt de referência (Midjourney) — Female

Prompt para gerar `reference_female.png`, com base na variante `female.001` do `portrait.json` (mulher latina,
22 anos, corpo curvy, cabelo undercut azul, olhos amendoados cor de avelã):

```prompt
3D render CGI character art, stylized video game character art, digital painting style, not photorealistic, full-color character concept art of a young latina woman, 22 years old, curvy build, blue undercut hairstyle, almond-shaped hazel eyes, serious expression, confident posture, standing pose, arms at side, legs crossed, looking directly at camera, bare head, no helmet, face fully visible, wearing a futuristic sci-fi space suit with metallic plating, science fiction astronaut uniform, space marine armor, smooth flat chest armor plate, no protrusions on chest armor, medium shot, plain solid white background, pure white backdrop, sharp focus, clean character turnaround lighting, flat direct front lighting, no cast shadows, shadowless lighting --ar 2:3 --v 6.1 --style raw --no photorealistic, blur, extra limbs, helmet, cast shadows, drop shadow
```

- Mesmos parâmetros de estilo/luz/fundo do prompt masculino, pelos mesmos motivos (fidelidade ao `--style raw`,
  imagem vira o `referenceImage` de todo o bloco `female`).

## `--export-prompt`: conferir o texto composto sem gastar GPU

`bun run generate-art ssm_default male --variante=001 --export-prompt` (ou `female`) monta e imprime o prompt
final (positivo + negativo) exatamente como vai pro ComfyUI, sem enfileirar nada — útil pra conferir que
`tipo`/`torso`/`extra_prompt` estão compondo do jeito esperado antes de rodar um teste de verdade.

## Reforços conhecidos por variante

Algumas variantes têm `extra_prompt.positive` específico, além do que `base`/`male`/`female` já declaram:

- **`male/001` e `male/002`**: ambas `"(young boy), flat masculine chest, male chest armor, muscular male
  torso"` — ajuste pontual de gerações específicas (o histórico do reforço de `male/002` era outro, ligado à cor
  de cabelo rosa fazendo o gênero "balançar" pra mais feminino nos testes originais — ver bug #10 em
  `docs/history/2026-07-28-generate-art-v1.md` — mas o texto atual do campo já não reflete mais esse reforço
  específico).
- **Reforço de etnia não é mais manual.** Até pouco tempo atrás, variantes `ethnicity: "African"` precisavam de
  `extra_prompt.positive` manual (`"(dark skin, deep brown skin tone, African facial features:1.3)"`) — etnia é
  atributo de área pequena do rosto, perde fácil sem reforço com peso, e ninguém tinha adicionado isso pras
  outras etnias (`Asian`/`Pacific` saíam com traço fraco/nenhum). Agora o reforço é **automático**, gerado a
  partir só de `person.ethnicity` (`TEXTO_ETNIA` em `scripts/generate-art/prompt-builder.ts`, cobre as 7 etnias
  do vocabulário) — os `extra_prompt` manuais que só existiam pra isso foram removidos do `portrait.json`
  (`female/008` manteve só `"(blonde hair:1.3)"`, não relacionado a etnia). `male/017`, que antes era uma
  exceção documentada (`African` sem o reforço manual), deixou de ser exceção — toda variante `African` recebe o
  mesmo reforço agora, sem precisar de nada extra no JSON.
