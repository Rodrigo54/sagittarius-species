---
name: gerar-art-portrait
description: "Gera ou aprimora o bloco `geracaoArt` de um `portrait.json` (assets/portraits/ssm_<especie>/) — a configuração completa que o pipeline `bun run art` usa pra gerar retratos de espécie via IA no ComfyUI local (Flux.2 Klein): campos estruturados (arquétipo visual, etnia, cabelo, olhos, o que cobre o tronco), templates de prompt por seção, variante do modelo (base/distilled) e proporção, imagens de referência/conceito por gênero, e uma variante nomeada por indivíduo (uma por PNG final), sem repetir combinação. Use sempre que o usuário pedir pra criar/configurar/preencher o `geracaoArt` de uma espécie, gerar retratos (art portraits) via IA/ComfyUI pra uma espécie do mod, ajustar o prompt/template de uma espécie que já gera arte, popular as variantes de uma espécie nova ou existente, ou disser algo como 'monta o geracaoArt de X', 'configura a geração de arte da espécie Y', 'gera os retratos por IA da espécie Z', 'prepara o portrait.json de Z pra gerar via IA', '/gerar-art-portrait' — mesmo que não mencione 'geracaoArt' literalmente. Não confundir com criação de name_list/espécie-flavor (isso é `gerar-name-list`) nem com o pipeline de conversão de PNG→DDS já existente (`bun run portrait`), que não é tocado por esta skill."
---

# Gerar art portrait (`geracaoArt`)

Preenche ou ajusta `geracaoArt` num `portrait.json` já existente — `base` (campos comuns e os templates de
prompt de cada seção), `modelo` (variante do modelo Flux.2 Klein e proporção), e `male`/`female`/`genderless` (imagens
de referência/conceito + uma variante nomeada por indivíduo) — através de uma entrevista que escolhe o visual da
espécie e usa um gerador determinístico pra criar N indivíduos distintos sem repetir combinação, em vez de
escrever cada bloco à mão. Ao final, confere o prompt composto com `--export-prompt` e entrega ao usuário o
comando da amostra de imagens; **geração de verdade quem roda é ele** (ver "Passo final").

Toda a interação é em **português do Brasil** (AGENTS.md deste repositório).

## Contexto do pipeline (leia antes de perguntar qualquer coisa)

Esta skill assume que a espécie **já existe** — pasta `assets/portraits/ssm_<especie>/` com `portrait.json`
(`name`/`counts`) e os PNGs de origem já presentes. Se a espécie ainda não existe, isso é trabalho de
arte/pipeline separado, fora do escopo (ver "Fora de escopo" no fim).

**O pipeline gera via Flux.2 Klein Base, não via checkpoint SDXL** — não existe `checkpoint`/`lora` configurável
por espécie (só um arquivo de UNET/CLIP/VAE está instalado hoje, ver
`docs/pipeline-generate-art.md`), não existe ControlNet/img2img/`denoise` (o mecanismo de
consistência visual é `ReferenceLatent`, encadeando uma lista de imagens de referência), e a composição do prompt
(positivo e negativo) é feita inteiramente em TypeScript, não por nodes no grafo do ComfyUI. Isso substituiu um
pipeline anterior baseado em checkpoint SDXL clássico (`checkpoint`/`lora`/ControlNet OpenPose/img2img), apagado
do repositório — ver `docs/history/2026-07-28-generate-art-v1.md` e `docs/history/2026-08-08-generate-art-schema-proprio.md` pro
histórico completo (útil pras lições de composição de prompt que ainda valem, não pro vocabulário de campos, que
mudou).

Antes de perguntar qualquer coisa, explore:

- **`docs/pipeline-generate-art.md`** — leitura obrigatória, é o **"como funciona"** do pipeline; esta skill é o
  **"como decidir"**. Três seções interessam antes de escrever qualquer coisa: **"Interface de linha de
  comando"** (as flags de `bun run art`), **"Sintaxe de template"** (`<secao.campo>`, `[trecho]` opcional e
  aninhável, resolução em duas camadas, `template` default vs. próprio, `extra` concatenando entre níveis) e
  **"Onde cada validação mora"**. Consulte lá na hora de escrever um template — esta skill deliberadamente não
  repete essa mecânica, pra não divergir dela de novo.
- **`scripts/portrait-schema/vocabulario.ts`** — fonte de verdade dos valores válidos de cada campo.
  **Nunca invente um valor de enum**: todo valor usado tem que aparecer literalmente num desses arrays — e
  vários deles têm valores **compostos**, que passam despercebidos a quem assume o óbvio (`ESTILOS_CABELO` tem
  `"Short Curly"`, `"Long Wavy"` e afins, não só os simples). Abra o arquivo em vez de confiar na memória; as
  listas são cópia estática mantida à mão, nada aqui depende de consultar o ComfyUI ao vivo. Não existe valor
  "sem cor": ausência de cor é a **ausência da chave**, e o trecho correspondente do template vai entre
  colchetes.
- **`scripts/portrait-schema/campos.ts`** — campos de dado de cada seção (é deles que sai o conjunto de caminhos
  `<secao.campo>` aceitos num template) e **`scripts/portrait-schema/schema.ts`** — forma exata do schema
  (`PortraitConfig`, `GeracaoArt`, `GeracaoArtGenero`, `GeracaoArtModelo`, `CamposCompostos`, `Variante`,
  `Species`, `Torso`), `zod` com `.strict()` em todo objeto (chave desconhecida é erro, não é ignorada em
  silêncio).
- **`scripts/generate-art/base.json`** — **todo o texto de prompt do pipeline**: `fixed` (estilo de arte,
  enquadramento de câmera, pose e expressão facial — **travados pra toda espécie**, não são escolha por espécie:
  pose/câmera precisam bater com o rig `ssm_shared`, e mudar isso reabriria o problema de corte de braço/mão que
  motivou travar — mais o negativo compartilhado de qualidade/anatomia), `templates` (o template default de cada
  seção, que a espécie só precisa sobrescrever quando quer texto próprio), `vocabulary` (o texto de cada valor de
  enum) e `order` (posição de cada fragmento no prompt). Leia os `templates` antes da entrevista: é o que a
  espécie ganha de graça sem escrever nada. Não pergunte sobre estilo/pose/enquadramento — não são decisão desta
  skill.
- **`docs/history/2026-07-28-generate-art-v1.md`** — relato da sessão que construiu o pipeline
  original (SDXL, ComfyUI-OOP) e reworkeou `ssm_default` pela primeira vez: bugs/decisões encontrados (máscara de
  fundo invertida, gênero não respeitado em CFG baixo, LoRA incompatível com checkpoint, `steps` baixo demais
  causando assimetria facial, etnia diluída pela referência, ênfase de peso vazando entre atributos, etc.) — as
  lições sobre **composição de prompt e vieses de geração** continuam válidas mesmo com o motor trocado; as
  lições sobre checkpoint/LoRA/ControlNet não se aplicam mais (esse pipeline foi apagado). Ver
  `docs/history/2026-08-08-generate-art-schema-proprio.md` pro que mudou entre o schema antigo e o que a v2 herdou, e a seção
  "Armadilhas conhecidas" abaixo pras lições específicas do Flux.2 Klein.
- **Três `geracaoArt` completos e funcionais no schema atual**, cada um ensinando um padrão diferente — abra o
  que se parece com a espécie da vez. Referência de **forma**; não copie o conteúdo temático, que é específico
  de cada espécie.
  - `assets/portraits/ssm_default/portrait.json` — **`extra` em vários níveis**: `hair.extra` anti-capacete na
    `base`, `torso.extra` de reforço masculino no bloco de gênero, `person.extra` numa variante só. Template de
    torso sem cor por indivíduo (a armadura é igual pra todos).
  - `assets/portraits/ssm_astral/portrait.json` — **traço fixo como identidade da espécie** (`eyes.color`
    declarado na `base`, não sorteado por variante), **duas** `referenceImage` por gênero, e valores compostos
    de cabelo (`"Short Curly"`).
  - `assets/portraits/ssm_mermaids/portrait.json` — o caso que motivou o formato de template: **cor posicionada
    na peça certa** (`<torso.primary_color>` no top e nas mangas, `<torso.secondary_color>` na cauda), `torso`
    variando por indivíduo, `state: "CroppedSleeved"`.
- **ComfyUI local só precisa estar rodando** (`http://127.0.0.1:8188`) **na hora de gerar de verdade** (teste de
  5 imagens ou lote) — preencher `geracaoArt` em si não depende de consultar nada ao vivo, já que não existe
  checkpoint/LoRA por espécie pra escolher.

## Dois modos: espécie nova ou `geracaoArt` que já existe

**Antes da primeira pergunta, abra o `portrait.json` da espécie** e veja se ela já tem `geracaoArt`. Os dois
casos são comuns, e tratar o segundo como se fosse o primeiro é o erro que custa caro: re-entrevistar do zero
uma espécie já configurada joga fora decisões que continuam válidas e reescreve variantes que já viraram imagem
em disco.

- **Campo verde** (sem `geracaoArt`) — a entrevista abaixo, do começo ao fim.
- **Já existe** — comece **resumindo o que está lá**, pro usuário confirmar o ponto de partida: arquétipo e
  template de `species`, template/`state` de `torso`, quais seções variam por indivíduo e com que paleta (leia
  as variantes, não chute), `referenceImage` por gênero, `modelo`, e **quantas variantes já têm `seed` gravada
  em cada gênero**. Depois pergunte **o que muda** — só isso. Pule toda pergunta que o arquivo já responde; um
  ajuste de template não reabre a discussão de arquétipo.

  Nesse modo, o que já está em disco tem precedência sobre o que seria bonito reescrever: preserve as `seed`
  (regra completa em "Geração de conteúdo"), e **só regenere as variantes que a mudança realmente afeta** — se
  a decisão foi trocar a cor da vestimenta, o sorteio de cabelo/olho/etnia de 25 indivíduos não tem por que
  mudar junto. Regeneração ampla é uma decisão do usuário, não um efeito colateral do ajuste que ele pediu.

## Entrevista

Uma pergunta de cada vez, aguardando resposta. Se o usuário já deu tema/referência/etc. ao invocar a skill, pule
direto pro que falta.

1. **Qual espécie.** Confirme o slug, leia `counts` do `portrait.json` (as chaves são os gêneros da espécie) — isso já fixa quantas
   variantes cada gênero precisa (não pergunte, é fato do arquivo).
2. **Arquétipo visual (`species`).** Qual `archetype` de `ARQUETIPOS` (leia a lista em `vocabulario.ts` e
   ofereça as opções que fizerem sentido pra espécie) melhor descreve a espécie — e, se o
   arquétipo sozinho não capturar o sabor específico dela (várias espécies bem diferentes compartilham o mesmo,
   ex. `Human` cobre desde o humano padrão até um guerreiro místico), que `template` diferencia essa espécie das
   outras. Não invente um arquétipo novo sem necessidade — o `template` existe exatamente pra isso. O template de
   `species` deve começar citando `<species.archetype>` (é o que o default faz; quem escreve template próprio
   assume a frase inteira). **`species` só pode ser declarada em `base`** — é a seção da espécie, não do
   indivíduo.
3. **O que cobre o tronco (`torso`).** `template` (texto livre: tema/material/forma — armadura, escama, pele
   nua, pelagem, o que fizer sentido) + `state` (`ESTADOS_TORSO` em `vocabulario.ts` — o enum é neutro, nenhum
   valor é "melhor", cada um só descreve o que a espécie precisa mostrar; escama à mostra é um estado tão
   correto quanto armadura completa). **Sempre pergunte os dois campos, mesmo que pareça
   óbvio** — foi exatamente a falta de `state` estruturado que causou o bug mais recorrente da sessão que motivou
   a migração de schema (barriga de fora mesmo com o texto pedindo cobertura total, repetidas vezes, até o campo
   estruturado existir).
   **Se a cor da vestimenta varia por indivíduo**, pergunte *qual peça recebe qual cor* e escreva isso no
   template com placeholders — `"top de escamas em <torso.primary_color>, cinto em <torso.secondary_color>"` —
   em vez de deixar as cores soltas. Uma cor declarada que nenhum template cita é **erro** de validação (não
   chegaria ao prompt), então essa decisão não pode ficar em aberto. `state` é diferente: entra no prompt
   sozinho, pela `order` do `base.json`, e **não** deve ser citado em template (ver a regra de cobertura em
   "Geração de conteúdo").
4. **Etnia/paleta é relevante pra essa espécie?** Se for humanoide, pergunte se a diversidade de etnia
   (`ETNIAS` em `vocabulario.ts` — cada valor já tem um reforço de prompt pronto em `vocabulary` no
   `base.json`, não precisa escrever nada a mais pra isso) deve variar entre indivíduos (como fizemos pro
   humano) ou ficar fixa numa só. `ethnicity` é
   campo **opcional** — pra espécie claramente não-humanoide onde nenhuma etnia real faz sentido (`Robot`,
   `Molluscoid`, etc.), não pergunte isso e simplesmente **omita** `person.ethnicity` (não force nenhum valor do
   enum como placeholder).
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
   `"distilled"` (**padrão**, 4 passos, CFG=1, ~5x mais rápido — e o negativo é descartado nessa variante) ou
   `"base"` (20 passos, CFG=5, negativo real, pro lote final quando a qualidade extra compensar). Ofereça os
   valores já usados nas espécies-exemplo como padrão pronto (`aspectRatio` costuma bastar declarar;
   `steps`/`cfg` só se o usuário quiser desviar do padrão da variante escolhida).

**Portão de confirmação obrigatório.** Depois da entrevista, resuma tudo (`species`, `torso`, imagens de referência
por gênero, paletas por seção, `modelo`) e pergunte explicitamente, com `AskUserQuestion`, algo como "Chegamos a
um consenso de como a espécie vai ficar? Posso gerar o `geracaoArt`?". No modo de espécie já configurada, o
resumo é do **delta**: o que muda, o que fica como está, e **quais variantes serão reescritas** (com a garantia
de que as `seed` gravadas sobrevivem). Um ajuste pontual não é autorização — repita o resumo atualizado e
pergunte de novo. Só depois disso, escreva qualquer coisa.

## Geração de conteúdo (regras técnicas obrigatórias)

- **Forma do bloco**, dentro do `portrait.json` já existente:
  ```jsonc
  "geracaoArt": {
    "base": {
      // `species` SÓ aqui — descreve a espécie inteira, não o indivíduo
      "species": { "archetype": "...", "template"?: "<species.archetype>, ...", "extra"?: "..." },
      "torso": { "template"?: "...", "state"?: "...", "extra"?: "..." },
      "eyes"?: { "color": "..." }, // só se a cor de olho for identidade fixa da espécie (ex.: sempre violeta)
      "hair"?: { "extra"?: "..." } // texto que acompanha o cabelo em toda variante
    },
    "modelo"?: { "variant"?: "distilled" | "base", "steps"?: N, "cfg"?: N, "aspectRatio"?: "2:3" },
    "male":   { "person": { "gender": "Male" },   "referenceImage"?: ["assets/portraits/ssm_<esp>/reference_male.png", ...],   "variantes": { "001": {...}, ... } },
    "female": { "person": { "gender": "Female" }, "referenceImage"?: ["assets/portraits/ssm_<esp>/reference_female.png", ...], "variantes": { "001": {...}, ... } }
    // ou "genderless": { "variantes": {...} } pra espécie sem gênero (counts: { genderless: N })
    // cada variante: { person?, hair?, eyes?, torso?, seed? } — `seed` NÃO é escrita por esta skill (ver abaixo)
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
- **Todo campo declarado tem que chegar ao prompt** — é a validação cruzada de
  `scripts/generate-art/validacao.ts`, que
  roda sobre **todas** as variantes de **todos** os gêneros antes de enfileirar qualquer coisa (descobrir na
  variante 017 que o lote está quebrado custa GPU; aqui não custa nada). Duas regras: um campo declarado que
  nada consome é erro, e um placeholder fora de colchetes sem valor é erro. Mas "chegar ao prompt" tem **dois
  caminhos**, e confundi-los leva a escrever template errado:
  - **Campo posicionado pela `order` do `base.json`** — hoje `torso.state`, `person.ethnicity` e `eyes.shape` no
    positivo (mais `torso.state`, `person.gender` e `eyes.shape` no negativo). Entram no prompt sozinhos, pelo
    texto de `vocabulary`, já com peso e na posição certa. **Não cite `<torso.state>` num template pra "cobrir"
    o campo**: ele já está coberto, e citá-lo só duplica o texto competindo com ele mesmo.
  - **Campo consumido por um `<placeholder>`** — todo o resto (cores, `age`, `hair.style`, `body_shape`).
    Sortear `torso.secondary_color` nas variantes sem que nenhum template diga onde essa cor vai é o erro
    clássico, e é justamente o que a regra de cobertura pega.

  **`person.gender` é o caso traiçoeiro**: ele só aparece na `order` do **negativo**. No positivo, quem o emite
  é o `<person.gender>` do template default de `person` — então um template próprio de `person` que esqueça o
  placeholder tira a palavra "man"/"woman" do positivo **sem a validação reclamar**, porque o campo continua
  coberto pelo lado negativo. Ao escrever `person.template`, cite `<person.gender>`.

  Quem posiciona o quê está em `scripts/generate-art/base.json` (`order` e `templates`); a tabela de qual
  validação mora onde está em `docs/pipeline-generate-art.md`.
- **Gere as variantes com um script determinístico, não uma por uma na conversa.** Ver
  `references/exemplo-gerador-de-variantes.ts` desta skill — RNG de seed fixa (mesmo resultado toda vez que
  rodar; nada a ver com a `seed` de geração de imagem do bullet seguinte) e checagem de combinação repetida.
  Adapte os pools (etnia, cabelo, olho, corpo, o que fizer sentido pra espécie) e a faixa de idade decididos na
  entrevista; rode com `bun` e deixe o próprio script mesclar o resultado em `geracaoArt.<gênero>.variantes` (ler
  o `portrait.json`, mesclar **por índice**, escrever de volta) — não copie/cole 25+ blocos manualmente, é lento
  e propenso a erro de digitação contra os enums.
- **`seed` pertence ao `bun run art`, não a esta skill.** Ela é a seed de geração da imagem que está em disco
  (`noise_seed` do ComfyUI), gravada automaticamente em `geracaoArt.<gênero>.variantes.<NNN>.seed` por qualquer
  forma de `--seed`; a precedência é `--seed` da CLI → esse campo → hash determinístico. Três regras, nessa
  ordem de importância:
  1. **O gerador de variantes nunca emite `seed`** — ele produz a *receita* (o que a variante é), e a seed
     descreve a *imagem já gerada*. Emitir seed ali seria inventar procedência pra imagem que não existe.
  2. **Reescrever `variantes` preserva a `seed` que já existe**, variante a variante. Apagá-la não quebra
     validação nenhuma — só faz a próxima execução gerar outra imagem no lugar de uma que você já aprovou, em
     silêncio. Espécie com seeds parciais é o caso normal, não a exceção (`ssm_mermaids` tem 13 de 25 em `male`
     e nenhuma em `female`; `ssm_astral`, 3 e 2), então o merge tem que lidar com variante com e sem seed no
     mesmo lote.
  3. **Reroll é comando do usuário, não da skill.** Quando uma variante sai feia mas a receita está certa, o que
     ela precisa é de outra seed: `-s`/`--seed` sem valor sorteia uma nova, `-s N` fixa `N`, e `-s default`
     apaga a chave e devolve a variante ao hash determinístico — sempre gravando o resultado no `portrait.json`.
     A flag exige exatamente uma variante em `-n` (uma seed descreve uma imagem só) e conflita com
     `-e/--export-prompt`. Entregue o comando pronto; quem roda é o usuário (ver "Passo final").
- **Escreva o texto como template, não como frase fechada** (sintaxe completa em `docs/pipeline-generate-art.md`,
  seção "Sintaxe de template" — leia antes de escrever o primeiro). O julgamento que cabe aqui é **onde cada
  valor entra na frase**: um campo que varia por indivíduo vira `<secao.campo>` posicionado na peça a que
  pertence (`"top de escamas em <torso.primary_color>, cinto em <torso.secondary_color>"`), nunca uma cor solta
  largada no meio do prompt pra IA decidir o que ela pinta — foi exatamente esse buraco que motivou o formato de
  template. O que nem toda variante declara vai entre `[colchetes]`; o que toda variante tem que declarar fica
  fora deles, de propósito, pra a validação reprovar nomeando a variante em vez de gerar um lote inteiro com o
  texto capenga.
- **Use `-e/--export-prompt` pra depurar o texto composto antes de gastar GPU.** `bun run art <slug>
  <gênero> -n 001 -e` monta e imprime o prompt final (positivo + negativo) sem enfileirar nada no ComfyUI —
  ciclo de debug instantâneo, e a **única** invocação de `bun run art` que esta skill executa por conta própria
  (ver "Passo final"). Rode sempre antes de propor a amostra de imagens, pra confirmar lendo o texto que os
  campos-âncora estão presentes e na ordem certa.
- **Armadilhas conhecidas:**
  - Área pequena do rosto (cor de olho, etnia) perde mais fácil do que atributo de área grande (cor de cabelo).
    Cor de olho e etnia são as duas âncoras com peso e posição prioritária no início do positivo, mas por
    mecanismos **diferentes**: `person.ethnicity` é vocabulário posicionado direto na `order` — **não precisa de
    reforço manual em `extra`**, o texto completo (palavra da etnia + traços de pele/rosto, ex. `"(African, dark
    skin, deep brown skin tone, African facial features:1.3)"`) sai automaticamente só de declarar o campo. Já
    a cor de olho vem de `eyes.template`, que é o que a `order` posiciona: a posição prioritária é da **seção**,
    e o peso (`(<eyes.color> eyes:1.2)`) mora no template default. Escrever um `eyes.template` próprio herda a
    posição mas **descarta o peso** — reponha-o no texto novo se a cor de olho importa pra espécie.
    Cobertura de tronco segue outro mecanismo: `torso.state` vira texto curto sem peso no positivo, e o
    **oposto** do estado pedido é excluído com peso no negativo (lado `negative` da mesma entrada de
    vocabulário) — é lá que o reforço de verdade mora
    (detalhado em `docs/history/2026-07-28-generate-art-v1.md` — lição do motor anterior que continua valendo, é
    sobre como o texto compete por atenção, não sobre SDXL em si).
  - **Na variante `"distilled"` (`cfg: 1`), o negativo inteiro é descartado** (o node correspondente vira
    `ConditioningZeroOut`, ver `scripts/generate-art/base.ts`) — a única alavanca contra algo que o modelo insiste
    em gerar errado é o **positivo**. Duas armadilhas reais nessa variante: negação simples ("no helmet") é fraca
    sem CFG negativo pra contrastar (prefira excluir o objeto e afirmar o estado desejado ao mesmo tempo, ex.
    "no hood, no head covering, full head of hair"); e "bare head"/"uncovered head" é ambíguo com calvície nas
    legendas de treino do modelo (evite "bare"/"uncovered" perto de "head" — já saiu careca por causa disso).
  - Ênfase de peso (`(termo:1.3)`) num atributo pode vazar pra atributos vizinhos (inclusive gênero) — qualquer
    ajuste desse tipo pede confirmação visual (`--export-prompt` primeiro, depois teste de imagem) antes de
    aceitar como definitivo, nunca aplicar direto num lote.
  - O `extra` sai depois do `template` da própria seção, mas ainda no meio do prompt — o que precisa de
    prioridade máxima não vai em `extra`, vai no `template` de `species`/`torso` (ou vira campo estruturado).
  - Uma instrução de cabeça/cabelo repetida em dois níveis (ex. `base` e `male`) soma peso/repetição sem querer,
    já que `extra` concatena entre níveis em vez do último vencer — declare uma vez só, no nível mais amplo que
    já baste.
  - Não existe negativo por espécie: o padrão é a variante `distilled`, que descarta o negativo inteiro. O
    negativo que existe é o compartilhado (`fixed.negative` e o lado `negative` do vocabulário, em `base.json`),
    e só tem efeito em `variant: "base"`.

## Passo final

Só começa a escrever depois do "sim" explícito no portão de confirmação.

**Quem enfileira geração no ComfyUI é sempre o usuário, nunca esta skill** (regra do `AGENTS.md`): gerar
consome a GPU local por vários segundos a minutos *por variante*, e disparar isso sem aviso trava a máquina no
meio de outra coisa. A skill escreve arquivo e roda **só `-e/--export-prompt`**, que não toca a GPU; todo o
resto ela **entrega como comando pronto pra colar**, com o número de variantes explícito, e espera.

1. Rode o gerador de variantes adaptado (ver acima) — ele já escreve as variantes no `portrait.json`,
   preservando as `seed` existentes.
2. Confira/complete `assets/portraits/ssm_<especie>/portrait.json` com o resto do `geracaoArt` (`base`,
   `modelo`, `referenceImage`).
3. Rode `bun run art <slug> male -e` (e `female`/`genderless` conforme aplicável) — **esta é a única execução que a
   skill faz sozinha**. Confira o texto composto antes de qualquer GPU: os campos-âncora presentes, cada cor na
   peça certa, nada de `[trecho]` sumindo por campo não declarado. Corrija e repita até o prompt fazer sentido —
   o ciclo é instantâneo e de graça.
4. Entregue o comando da amostra pra o usuário rodar: `bun run art <slug> <gênero> -n 001,002,003,004,005`.
   Amostra pequena **antes** do lote é o fluxo estabelecido — nunca proponha o lote completo (25+ imagens) como
   primeiro teste. Quando ele avisar que rodou, leia as imagens geradas e revise.
5. Ajuste o que a revisão apontar. Se a receita está certa e só a imagem saiu ruim, o que falta é seed, não
   prompt: entregue `bun run art <slug> <gênero> -n <NNN> -s` (reroll daquela variante, ver regra de `seed`
   acima).
6. O lote completo e o `-p/--promote` (substituir os PNGs em `assets/portraits/ssm_<especie>/`) são decisões
   separadas do usuário, só depois de revisão completa — entregue os comandos e pare; esta skill não gera lote
   nem promove nada.

## Fora de escopo

- **Criar a espécie do zero** (pasta `assets/portraits/ssm_<especie>/`, `portrait.json` base com `species_classes`/
  `categories`, PNGs de origem) — isso é modelagem de dados/arte separada, não geração de `geracaoArt`. Se a
  espécie não existir ainda, avise e pare. O registro em `common/` é derivado desses dois campos por
  `bun run taxonomy` (veja `docs/pipeline-taxonomy.md`), nunca escrito à mão.
- **Editar `scripts/comfyui/ssm_species_portrait_workflow.json`/`..._workflow_distilled.json`** (os workflows
  compartilhados) ou `scripts/generate-art/base.json` (valores fixos/globais) — esta skill só preenche o
  `geracaoArt` de uma espécie específica. Se o usuário pedir uma capacidade que o pipeline atual não tem (ex. um
  campo estruturado novo), isso é trabalho de infraestrutura, fora do escopo aqui.
- **Instalar/trocar modelo (UNET/CLIP/VAE) no ComfyUI local** — só usa o que já está instalado (ver
  `docs/pipeline-generate-art.md`).
- **Enfileirar geração no ComfyUI, em qualquer volume** — amostra, lote ou variante avulsa, com ou sem `-s`.
  Regra do `AGENTS.md`: quem roda `bun run art` é sempre o usuário. A skill só executa `-e/--export-prompt` (não
  toca a GPU) e entrega os demais comandos prontos (ver "Passo final").
- **Promover automaticamente** (`-p/--promote`) — decisão do usuário depois de revisar o lote inteiro.
- **`bun run portrait` / conversão PNG→DDS** — pipeline totalmente separado, não é tocado por esta skill.
