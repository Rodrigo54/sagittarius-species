---
name: gerar-geracao-arte
description: "Gera o bloco `geracaoArt` de um `portrait.json` (assets/portraits/ssm_<especie>/) — a configuração completa que o pipeline `bun run generate-art` usa pra gerar retratos de espécie via IA no ComfyUI local: campos estruturados dos nodes OOP (etnia, cabelo, olhos, roupa, pose), escolha de checkpoint/LoRA/sampler, referência de img2img/ControlNet por gênero, e uma variante nomeada por indivíduo (uma por PNG final), sem repetir combinação. Use sempre que o usuário pedir pra criar/configurar/preencher o `geracaoArt` de uma espécie, gerar retratos via IA/ComfyUI pra uma espécie do mod, popular as variantes de uma espécie nova ou existente, ou disser algo como 'monta o geracaoArt de X', 'configura a geração de arte da espécie Y', 'prepara o portrait.json de Z pra gerar via IA', '/gerar-geracao-arte' — mesmo que não mencione 'geracaoArt' literalmente. Não confundir com criação de name_list/espécie-flavor (isso é `gerar-name-list`) nem com o pipeline de conversão de PNG→DDS já existente (`bun run portrait`), que não é tocado por esta skill."
---

# Gerar geracaoArt

Preenche `geracaoArt` num `portrait.json` já existente — `base` (campos comuns), `modelo` (checkpoint/sampler/
img2img/ControlNet/LoRA), e `male`/`female`/`flat` (referência de imagem + uma variante nomeada por indivíduo) —
através de uma entrevista que escolhe o visual da espécie e usa um gerador determinístico pra criar N indivíduos
distintos sem repetir combinação, em vez de escrever cada bloco à mão. Ao final, valida contra o schema real e
oferece rodar um teste de 5 imagens antes de qualquer geração em lote.

Toda a interação é em **português do Brasil** (CLAUDE.md deste repositório).

## Contexto do pipeline (leia antes de perguntar qualquer coisa)

Esta skill assume que a espécie **já existe** — pasta `assets/portraits/ssm_<especie>/` com `portrait.json`
(`name`/`gendered`/`counts`) e os PNGs de origem já presentes. Se a espécie ainda não existe, isso é trabalho de
arte/pipeline separado, fora do escopo (ver "Fora de escopo" no fim).

Antes de perguntar qualquer coisa, explore:

- **`scripts/generate-art/oop-types.ts`** — fonte de verdade dos valores válidos de cada campo (`OOP_GENEROS`,
  `OOP_ETNIAS`, `OOP_ESTILOS_CABELO`, `OOP_CORES_CABELO`, `OOP_FORMAS_OLHO`, `OOP_CORES_OLHO`, `OOP_FORMAS_BOCA`,
  `OOP_TIPOS_ROUPA_SUPERIOR`/`INFERIOR`, `OOP_POSES_BASE`/`MAO`/`PERNA`, `OOP_ESTILOS`, `OOP_ANGULOS_VISTA`,
  `OOP_TIPOS_VISTA`) e a forma exata do schema (`GeracaoArt`, `GeracaoArtGenero`, `GeracaoArtModelo`,
  `OOPCamposCompostos`). **Nunca invente um valor de enum** — todo valor usado tem que vir literalmente de um
  desses arrays (foram extraídos do `object_info` real do ComfyUI, não são texto livre).
- **`generate-art-historico-da-sessao.md`** (raiz do repo) — relato da sessão que construiu esse pipeline e
  reworkeou `ssm_default`: 11 bugs/decisões encontrados (máscara de fundo invertida, gênero não respeitado em CFG
  baixo, LoRA incompatível com checkpoint, `steps` baixo demais causando assimetria facial, etnia diluída pela
  referência, ênfase de peso vazando entre atributos, etc.) e a **configuração final que sobreviveu a todos os
  testes** — leia a seção "Configuração final" de lá antes de sugerir valores de `modelo`, é o ponto de partida
  testado, não um exemplo genérico.
- **`assets/portraits/ssm_default/portrait.json`** — exemplo completo e funcional de `geracaoArt` já promovido
  (50 variantes reais). Use como referência de forma, não copie o conteúdo temático (é específico da espécie
  humana).
- **ComfyUI local precisa estar rodando** (`http://127.0.0.1:8188`, ver `system_stats` pra confirmar). Consulte a
  API ao vivo em vez de assumir uma lista fixa — checkpoints (`GET /object_info/CheckpointLoaderSimple`) e LoRAs
  (`GET /object_info/LoraLoader`) instalados mudam com o tempo. **Ignore por padrão** checkpoints/LoRAs com nome
  claramente de conteúdo adulto (mature/virile/nsfw-like, de likeness de celebridade) — só considere-os se o
  usuário pedir explicitamente.

## Entrevista

Uma pergunta de cada vez, aguardando resposta. Se o usuário já deu tema/checkpoint/etc. ao invocar a skill, pule
direto pro que falta.

1. **Qual espécie.** Confirme o slug, leia `gendered`/`counts` do `portrait.json` — isso já fixa quantas
   variantes cada gênero precisa (não pergunte, é fato do arquivo).
2. **Conceito visual geral.** Tema/inspiração da espécie (o que ela é, como se veste, atmosfera). Vira a base do
   campo `extra` — é o lugar certo pra tudo que os campos estruturados não cobrem (expressão, direção do olhar,
   estilo de roupa que não existe nos combos de `clothing`, elementos de fantasia/sci-fi específicos). Lição da
   sessão anterior: descrever uma roupa muito específica (ex. "armadura espacial") quase sempre precisa do
   `extra`, porque os combos de `OOPClothingNode` são só roupa cotidiana (`Jacket`, `TShirt`, `Coat`...).
3. **Etnia/paleta é relevante pra essa espécie?** Se for humanoide, pergunte se a diversidade de etnia
   (`OOP_ETNIAS`: `African`, `Asian`, `Caucasian`, `Latino`, `Pacific`, `Alien`) deve variar entre indivíduos
   (como fizemos pro humano) ou ficar fixa numa só (ex. `Alien` pra tudo, comum em espécies não-humanas). Não
   pergunte isso pra espécie claramente não-humanoide onde nenhuma etnia real faz sentido — proponha `Alien` fixo
   e confirme.
4. **Estilo de arte.** `base_style` (`OOP_ESTILOS`) — pergunte com 2-3 opções concretas do array real (ex.
   `3DRendering`, `Fantasy`, `Realistic`, `Cyberpunk`) e uma recomendação. Lembre que "3D render de jogo" ≠
   fotorrealista mesmo pedindo `3DRendering` — a sessão anterior precisou reforçar isso no `extra` (`"not
   photorealistic"`) e ainda assim o checkpoint/LoRA escolhido pesa mais que o texto.
5. **Checkpoint.** Liste os instalados (via API, sem os ignorados por padrão) e pergunte. Se o usuário não tiver
   preferência, `pilgrimBASESDXL_v4GMG.safetensors` é o que sobreviveu a todos os testes da sessão anterior — mas
   é uma escolha de estilo do usuário, não presuma.
6. **LoRA.** Pergunte se quer usar algum (liste os instalados). Avise que compatibilidade com o checkpoint
   **não é garantida pelo nome** (ex.: um LoRA "XL" pode ainda assim conflitar) — recomende testar com 5 imagens
   antes de aceitar como definitivo, nunca aplicar direto num lote de 25+.
7. **Referência(s) de img2img/ControlNet, por gênero.** Pergunte se existe arte legada da espécie pra usar como
   referência (dá mais consistência visual com o que já foi publicado — foi o que funcionou melhor pra
   `ssm_default`) ou se é uma referência nova. Uma imagem por gênero (não uma pra espécie inteira) — a sessão
   anterior testou usar a mesma referência masculina pros dois gêneros e ficou bom, mas é uma decisão a
   confirmar, não presumir. Confirme que o arquivo referenciado existe no disco antes de escrever o caminho.
8. **Paleta de variação individual.** Pra cada seção que a espécie usa (`hair`, `eyes`, `clothing`, `body_shape`
   quando fizer sentido pra anatomia da espécie), pergunte a paleta de opções que cada indivíduo pode sortear
   (não precisa ser todas as opções do enum — geralmente um subconjunto temático, como a sessão anterior limitou
   cor de cabelo a "principalmente natural + poucas tingidas" em vez das 46 opções inteiras). Pergunte também a
   faixa etária (`person.age`).
9. **Parâmetros de sampler/img2img/ControlNet** (`modelo.steps`/`cfg`/`sampler_name`/`scheduler`/`denoise`/
   `controlNetStrength`). Ofereça os valores da "Configuração final" do histórico como padrão pronto, e só
   pergunte se o usuário quer desviar — não repasse cada parâmetro individualmente a menos que o checkpoint
   escolhido seja Turbo/destilado (esses precisam de `steps` baixo e `cfg` baixo, o oposto de um checkpoint
   normal — avise explicitamente dessa diferença se o usuário escolher um checkpoint Turbo).

**Portão de confirmação obrigatório.** Depois da entrevista, resuma tudo (conceito, checkpoint/LoRA, referência
por gênero, paletas por seção, parâmetros de `modelo`) e pergunte explicitamente, com `AskUserQuestion`, algo como
"Chegamos a um consenso de como a espécie vai ficar? Posso gerar o `geracaoArt`?". Um ajuste pontual não é
autorização — repita o resumo atualizado e pergunte de novo. Só depois disso, escreva qualquer coisa.

## Geração de conteúdo (regras técnicas obrigatórias)

- **Forma do bloco**, dentro do `portrait.json` já existente:
  ```jsonc
  "geracaoArt": {
    "base": { /* seções OOP comuns + extra */ },
    "modelo": { "checkpoint": "...", "steps": N, "cfg": N, "sampler_name": "...", "scheduler": "...",
                "width": N, "height": N, "denoise": N, "controlNetStrength": N,
                "lora"?: "...", "loraStrength"?: N },
    "male":   { "person": { "gender": "Male" },   "referenceImage": "assets/portraits/ssm_<esp>/reference_male.png",   "variantes": { "001": {...}, ... } },
    "female": { "person": { "gender": "Female" }, "referenceImage": "assets/portraits/ssm_<esp>/reference_female.png", "variantes": { "001": {...}, ... } }
    // ou "flat": { "variantes": {...} } pra espécie sem gênero (gendered: false)
  }
  ```
  `referenceImage` fica **ao lado do `portrait.json`** (`assets/portraits/ssm_<especie>/`), não em
  `scripts/comfyui/` — é conteúdo da espécie, não infraestrutura compartilhada do pipeline.
- **Número de variantes por gênero tem que bater exato com `counts.<gênero>`**, chaves `"001"`..`"NNN"`
  zero-padded a 3 dígitos, sequenciais, sem buraco — é o mesmo índice que vira o nome do PNG final depois do
  `--promote`. `validarGeracaoArt` (`scripts/generate-art/validation.ts`) confere isso e todo valor de enum
  antes de qualquer geração — rode-a (`bun -e` importando o módulo, como feito na sessão anterior) antes de
  considerar o arquivo pronto, não só confie na leitura visual.
- **Gere as variantes com um script determinístico, não uma por uma na conversa.** Ver
  `references/exemplo-gerador-de-variantes.ts` desta skill — é o gerador real usado pra `ssm_default`, com RNG
  com seed fixa (mesmo resultado toda vez que rodar) e checagem de combinação repetida. Adapte os pools (etnia,
  cabelo, olho, corpo, o que fizer sentido pra espécie) e a faixa de idade decididos na entrevista; rode com
  `bun`, capture o JSON de saída, e injete em `geracaoArt.<gênero>.variantes` via script (igual ao padrão usado
  na sessão anterior: ler o `portrait.json`, mesclar, escrever de volta) — não copie/cole 25+ blocos manualmente,
  é lento e propenso a erro de digitação contra os enums.
- **`extra` concatena entre `base`→gênero→variante** (não é "o último vence") — dá pra reforçar um detalhe
  específico numa variante sem duplicar o texto inteiro da `base`.
- **Armadilhas conhecidas** (detalhadas em `generate-art-historico-da-sessao.md`, não repita os erros):
  - Área pequena do rosto (cor de olho, etnia) perde mais fácil pra referência de img2img do que área grande
    (cor de cabelo) — se o teste de 5 imagens mostrar isso, reforçar via `extra` (concatenado) é o mecanismo já
    disponível.
  - `steps` e `cfg` dependem do tipo de checkpoint — Turbo quer poucos passos/CFG baixo, checkpoint normal quer
    ~25-30 passos/CFG ~5, senão sai assimetria facial.
  - Ênfase de peso (`(termo:1.3)`) num atributo pode vazar pra atributos vizinhos (inclusive gênero) — qualquer
    ajuste desse tipo pede confirmação visual antes de aceitar como definitivo, nunca aplicar direto num lote.

## Passo final

Só começa a escrever depois do "sim" explícito no portão de confirmação.

1. Rode o gerador de variantes adaptado (ver acima), capture a saída.
2. Escreva/edite `assets/portraits/ssm_<especie>/portrait.json` com o `geracaoArt` completo.
3. Rode `validarGeracaoArt` pra `male`/`female` (ou `flat`) — corrija até passar sem erro.
4. Pergunte se o usuário quer testar agora: `bun run generate-art <slug> <gênero> --variante=001,002,003,004,005`
   — **nunca** rode o lote completo (25+ imagens) automaticamente, é caro em GPU e o fluxo estabelecido é sempre
   revisar uma amostra pequena primeiro. Mostre as imagens geradas pra revisão.
5. Deixe claro que `--promote` (substituir os PNGs em `assets/portraits/ssm_<especie>/`) é uma decisão separada,
   só depois de revisão completa do lote inteiro — esta skill não promove nada sozinha.

## Fora de escopo

- **Criar a espécie do zero** (pasta `assets/portraits/ssm_<especie>/`, `portrait.json` base, PNGs de origem,
  registro em `species_classes`/`portrait_categories`/`portrait_sets`) — isso é modelagem de dados/arte separada,
  não geração de `geracaoArt`. Se a espécie não existir ainda, avise e pare.
- **Editar `scripts/comfyui/ssm_species_portrait_workflow.json`** (o workflow compartilhado) — esta skill só
  preenche dados de `portrait.json` que o workflow já sabe consumir. Se o usuário pedir uma capacidade que o
  workflow atual não tem (ex. um node novo), isso é trabalho de infraestrutura, fora do escopo aqui.
- **Baixar checkpoints/LoRAs novos** — só usa o que já está instalado no ComfyUI local.
- **Rodar o lote completo ou promover automaticamente** — sempre para no teste de 5 imagens e devolve a decisão
  pro usuário (ver "Passo final").
- **`bun run portrait` / conversão PNG→DDS** — pipeline totalmente separado, não é tocado por esta skill.
