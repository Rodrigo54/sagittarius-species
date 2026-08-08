---
name: gerar-geracao-arte
description: "Gera o bloco `geracaoArt` de um `portrait.json` (assets/portraits/ssm_<especie>/) — a configuração completa que o pipeline `bun run generate-art` usa pra gerar retratos de espécie via IA no ComfyUI local: campos estruturados (arquétipo visual, etnia, cabelo, olhos, o que cobre o tronco), escolha de checkpoint/LoRA/sampler, referência de img2img/ControlNet por gênero, e uma variante nomeada por indivíduo (uma por PNG final), sem repetir combinação. Use sempre que o usuário pedir pra criar/configurar/preencher o `geracaoArt` de uma espécie, gerar retratos via IA/ComfyUI pra uma espécie do mod, popular as variantes de uma espécie nova ou existente, ou disser algo como 'monta o geracaoArt de X', 'configura a geração de arte da espécie Y', 'prepara o portrait.json de Z pra gerar via IA', '/gerar-geracao-arte' — mesmo que não mencione 'geracaoArt' literalmente. Não confundir com criação de name_list/espécie-flavor (isso é `gerar-name-list`) nem com o pipeline de conversão de PNG→DDS já existente (`bun run portrait`), que não é tocado por esta skill."
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

**O pipeline não usa mais nodes do pacote `ComfyUI-OOP`** — a composição do prompt (positivo e negativo) é feita
inteiramente em TypeScript, não mais por nodes no grafo do ComfyUI. Ver `generate-art-migracao-schema-proprio.md`
pro relato completo da migração (por que, o que mudou, decisões).

Antes de perguntar qualquer coisa, explore:

- **`scripts/portrait-schema/vocabulario.ts`** — fonte de verdade dos valores válidos de cada campo (`TIPOS`,
  `ETNIAS`, `FORMAS_CORPO`, `ESTILOS_CABELO`, `CORES_CABELO`, `FORMAS_OLHO`, `CORES_OLHO`, `ESTADOS_TORSO`) e
  `scripts/portrait-schema/schema.ts` pra forma exata do schema (`PortraitConfig`, `GeracaoArt`,
  `GeracaoArtGenero`, `GeracaoArtModelo`, `CamposCompostos`, `Tipo`, `Torso`, `ExtraPrompt`) — schema `zod`,
  `.strict()` em todo objeto (chave desconhecida é erro, não é ignorada em silêncio). **Nunca invente um valor de
  enum** — todo valor usado tem que vir literalmente de um desses arrays. Diferente do pipeline antigo, essas
  listas **não são mais extraídas ao vivo do `object_info` do ComfyUI** — são cópia estática, mantida à mão (só
  `checkpoint`/`lora` em `modelo` ainda dependem do que está instalado localmente, ver abaixo).
- **`scripts/generate-art/base.json`** — tudo que é fixo/global na geração: estilo de arte, enquadramento de
  câmera, pose e expressão facial (**travados pra toda espécie**, não são mais escolha por espécie — pose/câmera
  precisam bater com o rig `ssm_shared`, e mudar isso reabriria o problema de corte de braço/mão que motivou
  travar) e o negativo compartilhado de qualidade/anatomia. Não pergunte sobre estilo/pose/enquadramento na
  entrevista — não são mais decisão desta skill.
- **`generate-art-historico-da-sessao.md`** (raiz do repo) — relato da sessão que construiu o pipeline original
  (baseado em ComfyUI-OOP) e reworkeou `ssm_default` pela primeira vez: bugs/decisões encontrados (máscara de
  fundo invertida, gênero não respeitado em CFG baixo, LoRA incompatível com checkpoint, `steps` baixo demais
  causando assimetria facial, etnia diluída pela referência, ênfase de peso vazando entre atributos, etc.) — as
  lições continuam válidas mesmo após a migração de schema, é a seção "Configuração final" de lá que mudou de
  forma (ver `generate-art-migracao-schema-proprio.md` pro que mudou e por quê).
- **`assets/portraits/ssm_default/portrait.json`** e **`assets/portraits/ssm_astral/portrait.json`** — exemplos
  completos e funcionais de `geracaoArt` já migrados pro schema atual (25+25 e 25+25 variantes reais). Use como
  referência de forma, não copie o conteúdo temático (cada um é específico da sua espécie).
- **ComfyUI local precisa estar rodando** (`http://127.0.0.1:8188`, ver `system_stats` pra confirmar) — só pra
  `checkpoint`/`lora` de `modelo`, que continuam dependendo do que está instalado. Consulte a API ao vivo em vez
  de assumir uma lista fixa — checkpoints (`GET /object_info/CheckpointLoaderSimple`) e LoRAs (`GET
  /object_info/LoraLoader`) instalados mudam com o tempo. **Ignore por padrão** checkpoints/LoRAs com nome
  claramente de conteúdo adulto (mature/virile/nsfw-like, de likeness de celebridade) — só considere-os se o
  usuário pedir explicitamente.

## Entrevista

Uma pergunta de cada vez, aguardando resposta. Se o usuário já deu tema/checkpoint/etc. ao invocar a skill, pule
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
   falta de `state` estruturado que causou o bug mais recorrente da sessão que motivou esta migração (barriga
   de fora mesmo com o texto pedindo cobertura total, repetidas vezes, até o campo estruturado existir).
4. **Etnia/paleta é relevante pra essa espécie?** Se for humanoide, pergunte se a diversidade de etnia
   (`ETNIAS`: `African`, `Asian`, `Caucasian`, `Latino`, `Pacific`, `Alien`) deve variar entre indivíduos (como
   fizemos pro humano) ou ficar fixa numa só (ex. `Alien` pra tudo, comum em espécie não-humanoide). Não pergunte
   isso pra espécie claramente não-humanoide onde nenhuma etnia real faz sentido — proponha `Alien` fixo e
   confirme.
5. **Checkpoint.** Liste os instalados (via API, sem os ignorados por padrão) e pergunte. Se o usuário não tiver
   preferência, `pilgrimBASESDXL_v4GMG.safetensors` é o que sobreviveu a mais testes historicamente — mas é uma
   escolha de estilo do usuário, não presuma.
6. **LoRA.** Pergunte se quer usar algum (liste os instalados). Avise que compatibilidade com o checkpoint **não
   é garantida pelo nome** (ex.: um LoRA "XL" pode ainda assim conflitar), e que LoRAs de reforço de olho/rosto
   (`PerfectEyesXL`, `DetailedEyes_V3`) podem **brigar diretamente** com um `torso`/`tipo` que peça "sem pupila
   visível" ou "olhos brilhantes" — recomende testar com 5 imagens antes de aceitar como definitivo, nunca aplicar
   direto num lote de 25+.
7. **Referência(s) de img2img/ControlNet, por gênero.** Pergunte se existe arte legada da espécie pra usar como
   referência (dá mais consistência visual com o que já foi publicado) ou se é uma referência nova (nesse caso,
   confirme que ela cabe **inteira** no quadro — braços/mãos cortados na referência produzem geração cortada,
   porque o ControlNet OpenPose só enxerga o esqueleto do que está visível nela; `--ar 4:5` funcionou melhor que
   `2:3` pra poses com braços afastados do corpo). Uma imagem por gênero (não uma pra espécie inteira, mas nada
   impede usar a mesma referência pros dois se funcionar bem — é decisão a confirmar, não presumir). Confirme que
   o arquivo referenciado existe no disco antes de escrever o caminho.
8. **Paleta de variação individual.** Pra cada seção que a espécie usa (`hair`, `eyes`, `person.body_shape`
   quando fizer sentido pra anatomia da espécie), pergunte a paleta de opções que cada indivíduo pode sortear
   (não precisa ser todas as opções do enum — geralmente um subconjunto temático). Pergunte também a faixa etária
   (`person.age`).
9. **Parâmetros de sampler/img2img/ControlNet** (`modelo.steps`/`cfg`/`sampler_name`/`scheduler`/`denoise`/
   `controlNetStrength`). Ofereça os valores já usados em `ssm_default`/`ssm_astral` como padrão pronto, e só
   pergunte se o usuário quer desviar — não repasse cada parâmetro individualmente a menos que o checkpoint
   escolhido seja Turbo/destilado (esses precisam de `steps` baixo e `cfg` baixo, o oposto de um checkpoint
   normal — avise explicitamente dessa diferença se o usuário escolher um checkpoint Turbo).

**Portão de confirmação obrigatório.** Depois da entrevista, resuma tudo (`tipo`, `torso`, checkpoint/LoRA,
referência por gênero, paletas por seção, parâmetros de `modelo`) e pergunte explicitamente, com
`AskUserQuestion`, algo como "Chegamos a um consenso de como a espécie vai ficar? Posso gerar o `geracaoArt`?".
Um ajuste pontual não é autorização — repita o resumo atualizado e pergunte de novo. Só depois disso, escreva
qualquer coisa.

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
    "modelo": { "checkpoint": "...", "steps": N, "cfg": N, "sampler_name": "...", "scheduler": "...",
                "width": N, "height": N, "denoise": N, "controlNetStrength": N,
                "lora"?: "...", "loraStrength"?: N },
    "male":   { "person": { "gender": "Male" },   "referenceImage": "assets/portraits/ssm_<esp>/reference_male.png",   "variantes": { "001": {...}, ... } },
    "female": { "person": { "gender": "Female" }, "referenceImage": "assets/portraits/ssm_<esp>/reference_female.png", "variantes": { "001": {...}, ... } }
    // ou "flat": { "variantes": {...} } pra espécie sem gênero (gendered: false)
  }
  ```
  Não tem mais `style`/`view`/`pose`/`mouth`/`clothing` — esses ficaram travados globalmente em
  `scripts/generate-art/base.json`, iguais pra toda espécie. `referenceImage` fica **ao lado do `portrait.json`**
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
- **Armadilhas conhecidas** (detalhadas em `generate-art-historico-da-sessao.md` e
  `generate-art-migracao-schema-proprio.md`, não repita os erros):
  - Área pequena do rosto (cor de olho, etnia) e cobertura de tronco perdem mais fácil pra referência de
    img2img/viés do checkpoint do que atributo de área grande (cor de cabelo). É exatamente pra isso que
    `torso.state` e `eyes.color` recebem peso automático (`(...:1.3)`) e posição prioritária no composer — se
    ainda assim não for respeitado, o próximo suspeito é o **checkpoint**, não o texto (checkpoints de estilo
    "2D"/anime têm viés forte pra tropos como "guerreiro musculoso = tronco nu", que texto sozinho briga mal
    contra).
  - `steps` e `cfg` dependem do tipo de checkpoint — Turbo quer poucos passos/CFG baixo, checkpoint normal quer
    ~25-30 passos/CFG ~5, senão sai assimetria facial.
  - Ênfase de peso (`(termo:1.3)`) num atributo pode vazar pra atributos vizinhos (inclusive gênero) — qualquer
    ajuste desse tipo pede confirmação visual (`--export-prompt` primeiro, depois teste de imagem) antes de
    aceitar como definitivo, nunca aplicar direto num lote.
  - `extra_prompt.positive`/`.negative` sempre vêm concatenados no fim do prompt inteiro (depois de todas as
    âncoras e campos estruturados) — não é o lugar certo pra algo que precisa de prioridade alta; isso é o que
    `tipo`/`torso` (com `description`) existem pra resolver.

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
- **Editar `scripts/comfyui/ssm_species_portrait_workflow.json`** (o workflow compartilhado) ou
  `scripts/generate-art/base.json` (valores fixos/globais) — esta skill só preenche o `geracaoArt` de uma espécie
  específica. Se o usuário pedir uma capacidade que o pipeline atual não tem (ex. um campo estruturado novo),
  isso é trabalho de infraestrutura, fora do escopo aqui.
- **Baixar checkpoints/LoRAs novos** — só usa o que já está instalado no ComfyUI local.
- **Rodar o lote completo ou promover automaticamente** — sempre para no teste de 5 imagens e devolve a decisão
  pro usuário (ver "Passo final").
- **`bun run portrait` / conversão PNG→DDS** — pipeline totalmente separado, não é tocado por esta skill.
