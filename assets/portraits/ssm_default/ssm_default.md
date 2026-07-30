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

Estilo de arte declarado em `portrait.json` (`geracaoArt.base`): render 3D / CGI de personagem de videogame,
digital painting, não fotorrealista. Pose padrão em pé, braços ao lado do corpo, pernas cruzadas, plano médio
(medium shot), olhando para a câmera, expressão séria e postura confiante.

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
- **Atenção:** hoje `geracaoArt.female.referenceImage` no `portrait.json` aponta para `reference_male.png` (mesmo
  arquivo do bloco masculino) — ao gerar essa imagem, além de salvar como `reference_female.png`, é preciso
  atualizar esse campo no `portrait.json` para ele apontar para o arquivo certo.

## Denoise em duas passadas (corpo/roupa vs. rosto)

`geracaoArt.modelo` declara dois valores de denoise: `denoise: 0.7` (1ª passada do `KSampler` — corpo e roupa,
perto da referência) e `faceDenoise: 0.9` (2ª passada, restrita à região do rosto por uma máscara do MediaPipe,
mais livre pra seguir a etnia/cabelo/olhos de cada variante). Isso exigiu adicionar uma 2ª passada de `KSampler`
ao `scripts/comfyui/ssm_species_portrait_workflow.json` (nodes 28-36: detecção de rosto → máscara → segunda
amostragem restrita à máscara) — **esse workflow é compartilhado por todas as 18 espécies**, então a 2ª passada
roda pra todas, não só pra `ssm_default`; espécies sem `faceDenoise` configurado usam o valor padrão do template.

**Resolvido:** `LoadMediaPipeFaceLandmarker` (id `28`) é um node nativo do ComfyUI (`comfy_extras/nodes_mediapipe.py`,
não um custom node de terceiros); o modelo (`mediapipe_face_fp32.safetensors`, ~5.4 MB, publicado pela própria
Comfy-Org no Hugging Face) foi baixado para `models/detection/` da instalação local. Validado ponta a ponta com
`bun run generate-art ssm_default male --variante=001` — as duas passadas rodam sem erro e o resultado bate com o
esperado (roupa igual à referência, rosto seguindo etnia/cabelo/olhos da variante). Um detalhe de serialização
que vale registrar: o valor do combo `regions` do `MediaPipeFaceMask` (id `30`) é a **string simples** `"all"`,
não um objeto aninhado — a API do ComfyUI remonta a estrutura aninhada internamente a partir dos `dynamic_paths`
do schema do node.
