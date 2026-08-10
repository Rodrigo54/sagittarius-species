---
name: gerar-geracao-arte
description: "Gera o bloco `geracaoArt` de um `portrait.json` (assets/portraits/ssm_<especie>/) — a configuração completa que o pipeline `bun run generate-art` usa pra gerar retratos de espécie via IA no ComfyUI local (Flux.2 Klein): campos estruturados (arquétipo visual, etnia, cabelo, olhos, o que cobre o tronco), variante do modelo (base/distilled) e proporção, imagens de referência/conceito por gênero, e uma variante nomeada por indivíduo (uma por PNG final), sem repetir combinação. Use sempre que o usuário pedir pra criar/configurar/preencher o `geracaoArt` de uma espécie, gerar retratos via IA/ComfyUI pra uma espécie do mod, popular as variantes de uma espécie nova ou existente, ou disser algo como 'monta o geracaoArt de X', 'configura a geração de arte da espécie Y', 'prepara o portrait.json de Z pra gerar via IA', '/gerar-geracao-arte' — mesmo que não mencione 'geracaoArt' literalmente. Não confundir com criação de name_list/espécie-flavor (isso é `gerar-name-list`) nem com o pipeline de conversão de PNG→DDS já existente (`bun run portrait`), que não é tocado por esta skill."
---

# Gerar geracaoArt

Preenche `geracaoArt` num `portrait.json` já existente — `base` (campos comuns), `modelo` (variante do modelo
Flux.2 Klein e proporção), e `male`/`female`/`flat` (imagens de referência/conceito + uma variante nomeada por
indivíduo) — através de uma entrevista que escolhe o visual da espécie e usa um gerador determinístico pra criar
N indivíduos distintos sem repetir combinação, em vez de escrever cada bloco à mão. Ao final, valida contra o
schema real e oferece rodar um teste de 5 imagens antes de qualquer geração em lote.

Toda a interação é em **português do Brasil** (CLAUDE.md deste repositório).

## Contexto do pipeline (leia antes de perguntar qualquer coisa)

Esta skill assume que a espécie **já existe** — pasta `assets/portraits/ssm_<especie>/` com `portrait.json`
(`name`/`gendered`/`counts`) e os PNGs de origem já presentes. Se a espécie ainda não existe, isso é trabalho de
arte/pipeline separado, fora do escopo (ver "Fora de escopo" no fim).

**O pipeline gera via Flux.2 Klein Base, não via checkpoint SDXL** — não existe `checkpoint`/`lora` configurável
por espécie (só um arquivo de UNET/CLIP/VAE está instalado hoje, ver
`handoff-comfyui-image-models-2026-08-08.md`), não existe ControlNet/img2img/`denoise` (o mecanismo de
consistência visual é `ReferenceLatent`, encadeando uma lista de imagens de referência), e a composição do prompt
(positivo e negativo) é feita inteiramente em TypeScript, não por nodes no grafo do ComfyUI. Isso substituiu um
pipeline anterior baseado em checkpoint SDXL clássico (`checkpoint`/`lora`/ControlNet OpenPose/img2img), apagado
do repositório — ver `generate-art-v1-historico-da-sessao.md` e `generate-art-migracao-schema-proprio.md` pro
histórico completo (útil pras lições de composição de prompt que ainda valem, não pro vocabulário de campos, que
mudou).

Antes de perguntar qualquer coisa, explore:

- **`scripts/portrait-schema/vocabulario.ts`** — fonte de verdade dos valores válidos de cada campo (`TIPOS`,
  `ETNIAS`, `FORMAS_CORPO`, `ESTILOS_CABELO`, `CORES_CABELO`, `FORMAS_OLHO`, `CORES_OLHO`, `ESTADOS_TORSO`) e
  `scripts/portrait-schema/schema.ts` pra forma exata do schema (`PortraitConfig`, `GeracaoArt`,
  `GeracaoArtGenero`, `GeracaoArtModelo`, `CamposCompostos`, `Tipo`, `Torso`, `ExtraPrompt`) — schema `zod`,
  `.strict()` em todo objeto (chave desconhecida é erro, não é ignorada em silêncio). **Nunca invente um valor de
  enum** — todo valor usado tem que vir literalmente de um desses arrays. Essas listas são cópia estática,
  mantida à mão — diferente de `checkpoint`/`lora` do pipeline anterior, nada aqui depende de consultar o ComfyUI
  ao vivo.
- **`scripts/generate-art/base.json`** — tudo que é fixo/global na geração: estilo de arte, enquadramento de
  câmera, pose e expressão facial (**travados pra toda espécie**, não são mais escolha por espécie — pose/câmera
  precisam bater com o rig `ssm_shared`, e mudar isso reabriria o problema de corte de braço/mão que motivou
  travar) e o negativo compartilhado de qualidade/anatomia. Não pergunte sobre estilo/pose/enquadramento na
  entrevista — não são mais decisão desta skill.
- **`generate-art-v1-historico-da-sessao.md`** (raiz do repo) — relato da sessão que construiu o pipeline
  original (SDXL, ComfyUI-OOP) e reworkeou `ssm_default` pela primeira vez: bugs/decisões encontrados (máscara de
  fundo invertida, gênero não respeitado em CFG baixo, LoRA incompatível com checkpoint, `steps` baixo demais
  causando assimetria facial, etnia diluída pela referência, ênfase de peso vazando entre atributos, etc.) — as
  lições sobre **composição de prompt e vieses de geração** continuam válidas mesmo com o motor trocado; as
  lições sobre checkpoint/LoRA/ControlNet não se aplicam mais (esse pipeline foi apagado). Ver
  `generate-art-migracao-schema-proprio.md` pro que mudou entre o schema antigo e o que a v2 herdou, e a seção
  "Armadilhas conhecidas" abaixo pras lições específicas do Flux.2 Klein.
- **`assets/portraits/ssm_default/portrait.json`** e **`assets/portraits/ssm_astral/portrait.json`** — exemplos
  completos e funcionais de `geracaoArt` já no schema atual (25+25 e 25+25 variantes reais). Use como referência
  de forma, não copie o conteúdo temático (cada um é específico da sua espécie).
- **ComfyUI local só precisa estar rodando** (`http://127.0.0.1:8188`) **na hora de gerar de verdade** (teste de
  5 imagens ou lote) — preencher `geracaoArt` em si não depende de consultar nada ao vivo, já que não existe
  checkpoint/LoRA por espécie pra escolher.

## Entrevista

Uma pergunta de cada vez, aguardando resposta. Se o usuário já deu tema/referência/etc. ao invocar a skill, pule
direto pro que falta.

1. **Qual espécie.** Confirme o slug, leia `gendered`/`counts` do `portrait.json` — isso já fixa quantas
   variantes cada gênero precisa (não pergunte, é fato do arquivo).
2. **Arquétipo visual (`tipo`).** Qual `value` de `TIPOS` (`Human`, `Elf`, `Mermaid`, `Necroid`, `Furry`,
   `Molluscoid`, `Eldritch`, `Robot`, `Avian`, `Alien`, `Cyborg`) melhor descreve a espécie — e, se o `value`
   sozinho não capturar o sabor específico dela (várias espécies bem diferentes compartilham o mesmo `value`,
   ex. `Human` cobre desde o humano padrão até um guerreiro místico), que `description` diferencia essa espécie
   das outras que usam o mesmo `value`. Não invente um `value` novo sem necessidade — `description` existe
   exatamente pra isso.
3. **O que cobre o tronco (`torso`).** `description` (texto livre: tema/material/cor — armadura, escama, pele
   nua, pelagem, o que fizer sentido) + `state` (`ESTADOS_TORSO`: `Bare`, `FullyCovered`,
   `ArmsCoveredTorsoBare`, `TorsoCoveredArmsBare`, `PartiallyCovered` — neutro, nenhum é "melhor", só descreve o
   que a espécie precisa mostrar). **Sempre pergunte os dois campos, mesmo que pareça óbvio** — foi exatamente a
   falta de `state` estruturado que causou o bug mais recorrente da sessão que motivou a migração de schema
   (barriga de fora mesmo com o texto pedindo cobertura total, repetidas vezes, até o campo estruturado existir).
4. **Etnia/paleta é relevante pra essa espécie?** Se for humanoide, pergunte se a diversidade de etnia
   (`ETNIAS`: `African`, `Asian`, `Caucasian`, `Latino`, `Pacific`, `Alien`) deve variar entre indivíduos (como
   fizemos pro humano) ou ficar fixa numa só (ex. `Alien` pra tudo, comum em espécie não-humanoide). Não pergunte
   isso pra espécie claramente não-humanoide onde nenhuma etnia real faz sentido — proponha `Alien` fixo e
   confirme.
5. **Imagens de referência/conceito, por gênero.** Pergunte se existe arte legada da espécie ou conceito visual
   (ex.: gerado no Midjourney) pra usar como referência — cada imagem entra numa cadeia de `ReferenceLatent` que
   dá amplitude visual ao resultado, então **cada entrada da lista deve ser um indivíduo/conceito diferente da
   espécie, não ângulos do mesmo personagem**. Pode ser uma lista vazia/ausente (txt2img puro, sem referência) se
   a espécie não tiver nada pra ancorar visualmente. Confirme que todo arquivo referenciado existe no disco antes
   de escrever o caminho (relativo à raiz do repo, ao lado do `portrait.json` da espécie).
6. **Paleta de variação individual.** Pra cada seção que a espécie usa (`hair`, `eyes`, `person.body_shape`
   quando fizer sentido pra anatomia da espécie), pergunte a paleta de opções que cada indivíduo pode sortear
   (não precisa ser todas as opções do enum — geralmente um subconjunto temático). Pergunte também a faixa etária
   (`person.age`).
7. **Variante do modelo e proporção** (`modelo.variant`/`steps`/`cfg`/`aspectRatio`). Explique a escolha:
   `"base"` (padrão, 20 passos, CFG=5, qualidade final) ou `"distilled"` (4 passos, CFG=1, ~5x mais rápido, útil
   pra iterar composição/prompt antes de rodar o lote final em `"base"` — mas não é uma opção de qualidade pro
   lote definitivo). Ofereça os valores já usados em `ssm_default`/`ssm_astral` como padrão pronto (`aspectRatio`
   costuma bastar declarar; `steps`/`cfg` só se o usuário quiser desviar do padrão da variante escolhida).

**Portão de confirmação obrigatório.** Depois da entrevista, resuma tudo (`tipo`, `torso`, imagens de referência
por gênero, paletas por seção, `modelo`) e pergunte explicitamente, com `AskUserQuestion`, algo como "Chegamos a
um consenso de como a espécie vai ficar? Posso gerar o `geracaoArt`?". Um ajuste pontual não é autorização —
repita o resumo atualizado e pergunte de novo. Só depois disso, escreva qualquer coisa.

## Geração de conteúdo (regras técnicas obrigatórias)

- **Forma do bloco**, dentro do `portrait.json` já existente:
  ```jsonc
  "geracaoArt": {
    "base": {
      "tipo": { "value": "...", "description"?: "..." },
      "torso": { "description"?: "...", "state"?: "..." },
      "eyes"?: { "color": "..." }, // só se a cor de olho for identidade fixa da espécie (ex.: sempre violeta)
      "extra_prompt"?: { "positive"?: "...", "negative"?: "..." }
    },
    "modelo"?: { "variant"?: "base" | "distilled", "steps"?: N, "cfg"?: N, "aspectRatio"?: "2:3" },
    "male":   { "person": { "gender": "Male" },   "referenceImage"?: ["assets/portraits/ssm_<esp>/reference_male.png", ...],   "variantes": { "001": {...}, ... } },
    "female": { "person": { "gender": "Female" }, "referenceImage"?: ["assets/portraits/ssm_<esp>/reference_female.png", ...], "variantes": { "001": {...}, ... } }
    // ou "flat": { "variantes": {...} } pra espécie sem gênero (gendered: false)
  }
  ```
  Não tem mais `style`/`view`/`pose`/`mouth`/`clothing` (travados globalmente em `scripts/generate-art/base.json`,
  iguais pra toda espécie) nem `checkpoint`/`lora`/`sampler_name`/`scheduler`/`denoise`/`controlNetStrength`
  (não existem mais campos configuráveis pra isso — ver "Contexto do pipeline" acima). `referenceImage` é uma
  **lista** (não uma string única), e cada caminho fica **ao lado do `portrait.json`**
  (`assets/portraits/ssm_<especie>/`), não em `scripts/comfyui/` — é conteúdo da espécie, não infraestrutura
  compartilhada do pipeline.
- **Número de variantes por gênero tem que bater exato com `counts.<gênero>`**, chaves `"001"`..`"NNN"`
  zero-padded a 3 dígitos, sequenciais, sem buraco — é o mesmo índice que vira o nome do PNG final depois do
  `--promote`. O schema `zod` (`scripts/portrait-schema/`) confere isso (via `.superRefine`) e todo valor de enum
  antes de qualquer geração — `lerConfig` (chamado por `generate-art`/`generate-portraits`) já valida
  automaticamente ao ler o arquivo e lança erro descritivo se algo estiver errado; não precisa chamar validação
  manualmente.
- **Gere as variantes com um script determinístico, não uma por uma na conversa.** Ver
  `references/exemplo-gerador-de-variantes.ts` desta skill — RNG com seed fixa (mesmo resultado toda vez que
  rodar) e checagem de combinação repetida. Adapte os pools (etnia, cabelo, olho, corpo, o que fizer sentido pra
  espécie) e a faixa de idade decididos na entrevista; rode com `bun`, capture o JSON de saída, e injete em
  `geracaoArt.<gênero>.variantes` via script (ler o `portrait.json`, mesclar, escrever de volta) — não copie/cole
  25+ blocos manualmente, é lento e propenso a erro de digitação contra os enums.
- **`extra_prompt.positive`/`.negative` concatenam entre `base`→gênero→variante** (não é "o último vence") — dá
  pra reforçar um detalhe específico numa variante sem duplicar o texto inteiro da `base`. `tipo`/`torso`/`hair`/
  `eyes`/`person`, ao contrário, seguem merge raso normal por seção (último nível a declarar um campo vence,
  exceto `tipo`, que troca por inteiro — `value` e `description` são acoplados demais pra combinar de níveis
  diferentes).
- **Use `--export-prompt` pra depurar o texto composto antes de gastar GPU.** `bun run generate-art <slug>
  <gênero> --variante=001 --export-prompt` monta e imprime o prompt final (positivo + negativo) sem enfileirar
  nada no ComfyUI — ciclo de debug instantâneo. Sempre vale rodar isso antes do teste de 5 imagens de verdade,
  pra confirmar visualmente (lendo o texto) que os campos-âncora estão presentes e na ordem certa.
- **Armadilhas conhecidas:**
  - Área pequena do rosto (cor de olho, etnia) e cobertura de tronco perdem mais fácil do que atributo de área
    grande (cor de cabelo). É exatamente pra isso que `torso.state` e `eyes.color` recebem peso automático
    (`(...:1.3)`) e posição prioritária no composer (detalhado em `generate-art-v1-historico-da-sessao.md` —
    lição do motor anterior que continua valendo, é sobre como o texto compete por atenção, não sobre SDXL em
    si).
  - **Na variante `"distilled"` (`cfg: 1`), o negativo inteiro é descartado** (o node correspondente vira
    `ConditioningZeroOut`, ver `scripts/generate-art/base.ts`) — a única alavanca contra algo que o modelo insiste
    em gerar errado é o **positivo**. Duas armadilhas reais nessa variante: negação simples ("no helmet") é fraca
    sem CFG negativo pra contrastar (prefira excluir o objeto e afirmar o estado desejado ao mesmo tempo, ex.
    "no hood, no head covering, full head of hair"); e "bare head"/"uncovered head" é ambíguo com calvície nas
    legendas de treino do modelo (evite "bare"/"uncovered" perto de "head" — já saiu careca por causa disso).
  - Ênfase de peso (`(termo:1.3)`) num atributo pode vazar pra atributos vizinhos (inclusive gênero) — qualquer
    ajuste desse tipo pede confirmação visual (`--export-prompt` primeiro, depois teste de imagem) antes de
    aceitar como definitivo, nunca aplicar direto num lote.
  - `extra_prompt.positive`/`.negative` sempre vêm concatenados no fim do prompt inteiro (depois de todas as
    âncoras e campos estruturados) — não é o lugar certo pra algo que precisa de prioridade alta; isso é o que
    `tipo`/`torso` (com `description`) existem pra resolver.
  - Uma instrução de cabeça/cabelo repetida em dois níveis (ex. `base` e `male`) soma peso/repetição sem querer,
    já que `extra_prompt` concatena entre níveis em vez do último vencer — declare uma vez só, no nível mais
    amplo que já baste.

## Passo final

Só começa a escrever depois do "sim" explícito no portão de confirmação.

1. Rode o gerador de variantes adaptado (ver acima), capture a saída.
2. Escreva/edite `assets/portraits/ssm_<especie>/portrait.json` com o `geracaoArt` completo.
3. Rode `bun run generate-art <slug> male --export-prompt` (e `female`/`flat` conforme aplicável) — confira o
   texto composto visualmente antes de gastar GPU; corrija até o prompt fazer sentido.
4. Pergunte se o usuário quer testar de verdade agora: `bun run generate-art <slug> <gênero>
   --variante=001,002,003,004,005` — **nunca** rode o lote completo (25+ imagens) automaticamente, é caro em GPU
   e o fluxo estabelecido é sempre revisar uma amostra pequena primeiro. Mostre as imagens geradas pra revisão.
5. Deixe claro que `--promote` (substituir os PNGs em `assets/portraits/ssm_<especie>/`) é uma decisão separada,
   só depois de revisão completa do lote inteiro — esta skill não promove nada sozinha.

## Fora de escopo

- **Criar a espécie do zero** (pasta `assets/portraits/ssm_<especie>/`, `portrait.json` base, PNGs de origem,
  registro em `species_classes`/`portrait_categories`/`portrait_sets`) — isso é modelagem de dados/arte separada,
  não geração de `geracaoArt`. Se a espécie não existir ainda, avise e pare.
- **Editar `scripts/comfyui/ssm_species_portrait_workflow.json`/`..._workflow_distilled.json`** (os workflows
  compartilhados) ou `scripts/generate-art/base.json` (valores fixos/globais) — esta skill só preenche o
  `geracaoArt` de uma espécie específica. Se o usuário pedir uma capacidade que o pipeline atual não tem (ex. um
  campo estruturado novo), isso é trabalho de infraestrutura, fora do escopo aqui.
- **Instalar/trocar modelo (UNET/CLIP/VAE) no ComfyUI local** — só usa o que já está instalado (ver
  `handoff-comfyui-image-models-2026-08-08.md`).
- **Rodar o lote completo ou promover automaticamente** — sempre para no teste de 5 imagens e devolve a decisão
  pro usuário (ver "Passo final").
- **`bun run portrait` / conversão PNG→DDS** — pipeline totalmente separado, não é tocado por esta skill.
