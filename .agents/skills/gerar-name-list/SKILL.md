---
name: gerar-name-list
description: "Gera um name_list temático completo (nomes de nave, frota, exército, planeta, personagem) e as espécies-flavor associadas para o mod Sagittarius Species, ou aprimora/reescreve um name_list já existente com temáticas mais ricas por aspecto — através de uma entrevista que sugere convenções concretas de nomenclatura para cada categoria, e integra tudo ao pipeline `bun run names`. Use quando o usuário pedir para criar uma nova cultura/name_list, adicionar uma espécie-flavor temática nova, aprimorar/reescrever/dar mais tema a uma cultura existente, ou disser algo como 'crie um name list para X', 'gera nomes para uma cultura Y', 'vamos aprimorar ssm_<id>', 'adiciona uma nova espécie inspirada em Z', '/gerar-name-list'."
---

# Gerar Name List

Gera um `assets/name_lists/<id>.json` completo — com conteúdo criativo real, não um esqueleto — a partir de uma entrevista temática que sugere convenções concretas para cada aspecto do name_list (naves de combate, naves utilitárias, frota, exército, planetas, personagens), e roda `bun run names` ao final pra integrar ao mod. Serve tanto pra **criar uma cultura nova do zero** quanto pra **aprimorar/reescrever** uma já existente.

Toda a interação é em **português do Brasil** (AGENTS.md deste repositório).

## Contexto do pipeline (leia antes de perguntar qualquer coisa)

- Fonte da verdade: `assets/name_lists/*.json`. `scripts/generate-names/` (comando `bun run names`) converte isso em `mod/sagittarius-species/common/name_lists/*.txt`, `mod/sagittarius-species/localisation/<idioma>/name_lists/*.yml` (10 idiomas), e agrega a chave `species_names` de **todos** os JSONs num único `mod/sagittarius-species/common/species_names/ssm_species_names.txt`.
- O comando falha alto (exit 1) se o JSON usar uma chave reservada inválida (`ship_names`/`ship_class_names` fora da lista de `ship_size` do jogo, `army_names` fora da lista de `army`, `planet_names` fora da lista de `planet_class`), se um `sequential_name` não tiver o prefixo `l10n|`, se uma `key` de `species_names` colidir entre arquivos, ou se uma `species_class` não for uma classe válida do jogo. Gere o conteúdo já respeitando essas regras (detalhadas abaixo) pra não precisar de várias rodadas de correção.
- **Antes de perguntar qualquer coisa ao usuário**, explore o ambiente:
  - Leia 2-3 JSONs existentes em `assets/name_lists/*.json` (ex.: `altmer.json`, `brazil.json`) pra absorver o formato exato, o estilo de `desc` (`§YLeaders:§!`, `§YShips:§!`, etc.), e os valores de `category` já usados.
  - Leia `SPECIES_CLASSES_VALIDAS` em `scripts/portrait-schema/vocabulario.ts` pra saber as `species_class` aceitas (as classes vanilla que servem a espécie de império — `PSIONIC`/`CYBERNETIC` ficam de fora de propósito, existem só pro ship set). Espécie-flavor **não** tem vínculo com retrato: o jogo sorteia nome e retrato de forma independente dentro da classe.
  - Leia `scripts/vanilla-keys.json` pra saber as listas válidas de `army`, `shipSize` e `planetClass` (snapshot congelado extraído do jogo).
  - Rode uma checagem simples (grep/leitura) das chaves `species_names[].key` já usadas em todos os JSONs de `assets/name_lists/`, pra garantir que as novas chaves que você vai inventar não colidem (a validação global do script pega isso, mas descobrir antes evita rodadas de correção).
  - Se o pedido for pra **aprimorar/reescrever uma cultura existente**, leia o JSON inteiro dela primeiro (contagens por categoria via um script rápido, tipo `Object.entries(...).map(([k,v]) => [k, v.length])`, em vez de carregar o arquivo gigante inteiro na conversa) pra saber o que já existe, quais categorias estão fracas/vazias, e não repetir pergunta sobre o que o usuário já deixou claro no pedido.

## Novo vs. aprimoramento

**Novo (do zero):** siga a entrevista completa abaixo, criando `assets/name_lists/<id>.json` novo.

**Aprimoramento/reescrita de uma cultura existente:** o usuário vai dizer algo como "vamos aprimorar ssm_brazil" ou "quero uma reescrita dos nomes de nave/planeta". Nesse caso:
- Pule as perguntas de `id`/`category`/`species_class` (já existem — só leia do JSON atual).
- Primeiro, **mapeie o estado atual**: se o JSON já tem `_meta` (ver seção de metadados abaixo), leia de lá o tema e a quantidade-alvo registrados da última vez, por aspecto — é mais confiável que adivinhar tema olhando os nomes. Se não tem `_meta` (arquivo antigo), compare com outra cultura mais desenvolvida do mod (ex.: `altmer.json`) pra achar categorias fracas em volume ou temática. Apresente esse mapeamento ao usuário antes de perguntar qualquer coisa — é informação que embasa a entrevista, não é pergunta, é fato que você descobre sozinho.
- Depois, pergunte **qual escopo do aprimoramento**: só um aspecto específico (ex.: só `ship_names`), vários, ou tudo? Não assuma — o pedido pode ser bem específico ("quero que science vire nomes de cientista") ou aberto ("aprimora tudo").
- Pra cada aspecto dentro do escopo, **não presuma que é uma reescrita temática** — pergunte qual tipo de mudança o usuário quer, já que podem ser coisas bem diferentes:
  - **Trocar a temática** (o que fizemos pro `ssm_brazil`) — mesma quantidade, conteúdo novo.
  - **Ampliar a variedade** — mesma temática atual (ou a registrada em `_meta`), mais itens.
  - **Reduzir a variedade** — mesma temática, menos itens (ex.: cultura ficou "gorda demais" e o usuário quer enxugar).
  - Nada impede combinar os dois eixos (trocar tema *e* mudar quantidade) — pergunte os dois quando não estiver óbvio pelo pedido.
- Só entre nas perguntas de convenção de nomenclatura (seção abaixo) pros aspectos que entraram no escopo, e só quando a operação escolhida for "trocar temática" (ampliar/reduzir mantendo o tema não precisa repassar as opções de convenção, só re-confirmar qual é o tema atual). Não toque em campos fora do escopo pedido (ex.: se só pediram nave e planeta, não mexa em `character_names`/`army_names`/`fleet_names`).
- No final, rode `bun run names` e confirme ausência de duplicata dentro de cada categoria reescrita antes de reportar sucesso (arrays gerados por concatenar pools podem colidir sem querer — já aconteceu). Atualize também o `_meta` dos aspectos alterados (ver seção abaixo).

## Entrevista

Uma pergunta de cada vez, aguardando resposta antes da próxima. Se o usuário já deu tema/escopo ao invocar a skill, use isso como ponto de partida e pule direto pras perguntas que ainda faltam — não repita o que já foi dito.

1. **Tema/inspiração geral.** Se não veio nos argumentos, pergunte. Esse tema é o ponto de partida pras sugestões de convenção por aspecto (próxima seção) — mas não precisa (e geralmente não deve) ser o único tema aplicado a tudo; culturas ricas combinam várias referências relacionadas ao mesmo universo temático, uma por aspecto.
2. **Identificador do arquivo** (só pra cultura nova). Proponha um `id` curto em inglês/ASCII com base no tema, e confirme com o usuário.
3. **`category`** (só pra cultura nova). Todos os name_lists existentes hoje usam `"Humanoid"`. Pergunte se esta cultura nova é humanoide também ou outra categoria — não assuma.
4. **Convenções de nomenclatura por aspecto.** Ver seção dedicada abaixo — é o coração da entrevista.
5. **`species_class` das espécies-flavor** (só pra cultura nova, ou se o aprimoramento incluir `species_names`). Mostre as classes aceitas e pergunte quais fazem sentido pro tema. Uma cultura pode usar 1 ou várias (o mod já mistura, ex.: Brazil tem espécies `HUM` e `MACHINE` na mesma cultura).
6. **Quantas espécies-flavor e com que nomes/planetas natais** (mesma condição do item 5). Pra cada classe escolhida, quantas variantes de espécie gerar. Pode gerar os nomes você mesmo (criativo, temático) e apresentar pro usuário confirmar/ajustar, em vez de pedir pra ele digitar um por um.
7. **Volume-alvo.** Cultura nova: pergunte a escala. Aprimoramento: já foi decidido por aspecto na seção "Novo vs. aprimoramento" (trocar/ampliar/reduzir) — aqui só confirme o número-alvo final de cada categoria tocada. Referência vanilla (`HUMAN1.txt`): ~300-500 nomes por categoria de nave, ~547 `second_names`.
   - **Enxuta** (~10-50 por categoria de nave, ~50-150 nomes de personagem) — cultura secundária/nicho.
   - **Vanilla** (~300-500 por categoria de nave usada, ~500+ nomes de personagem) — cultura principal, mesmo nível de `HUMAN1.txt`.
   - **Customizado** — o usuário informa um número.

**Portão de confirmação obrigatório.** Depois da entrevista (e depois de qualquer rodada de ajuste dentro dela — nunca presuma que um ajuste pontual já autoriza gerar), apresente um resumo completo (tema, convenção + volume-alvo de cada aspecto coberto) e pergunte explicitamente, com `AskUserQuestion`, algo como "Chegamos a um consenso de como tudo vai ficar? Posso gerar o JSON agora?". Só escreva o arquivo depois de um "sim" explícito. Um "quase, ajusta X" não vira autorização — depois do ajuste, repita o resumo atualizado e pergunte de novo. Isso vale tanto pra cultura nova quanto pra aprimoramento.

## Convenções de nomenclatura por aspecto (o coração da entrevista)

Em vez de um único "tema" genérico aplicado a tudo igual, quebre a pergunta por **aspecto** — cada um vira uma pergunta própria, com **2-4 opções concretas e reais/plausíveis** (não vagas) e uma recomendação com justificativa curta. As opções vêm de pesquisar/recordar convenções de nomenclatura de verdade ligadas ao tema informado (históricas, militares, científicas, mitológicas, literárias — o que fizer sentido) — não invente épitetos genéricos tipo "Nome Forte 1", "Nome Forte 2".

**Exemplo de referência real desta sessão** (tema: cultura brasileira militar) — use como modelo de granularidade e qualidade, não repita literalmente pra outros temas:

- Naves rápidas/utilitárias (`corvette`, `destroyer`, `transport`) → nomes indígenas de etnia/tribo (ex.: Tupinambá, Guarani, Kaingang — como os submarinos reais da Marinha)
- Naves de colonização (`colonizer`, `sponsored_colonizer`) → caravelas históricas da colonização (Anunciada, Vitória, São Gabriel)
- Naves construtoras (`constructor`) → arquitetos/engenheiros brasileiros (Oscar Niemeyer, Lúcio Costa)
- Naves de guerra pesadas (`cruiser`, `battleship`, `ion_cannon`) → batalhas históricas brasileiras (Riachuelo, Guararapes, Monte Castelo)
- Ápice da frota (`titan`, `juggernaut`, `military_station_*`) → patronos e almirantes (Tamandaré, Barroso)
- Ciência (`science`, `research_station`) → cientistas brasileiros (Oswaldo Cruz, Bertha Lutz, César Lattes)
- Planetas → animal brasileiro em estilo "constelação" ("Constelação da Onça-Pintada", "Boto-Cor-de-Rosa Celeste"), com o bicho batendo com o **bioma** de cada `pc_<classe>` (ex.: `pc_ocean` → animais marinhos; `pc_nuked` → megafauna extinta/pré-histórica brasileira, encaixando com o tema de mundo morto; `pc_arctic` → animais que toleram frio extremo e visitam o litoral sul do Brasil)

Pra qualquer tema novo, siga esse mesmo espírito: pergunte, aspecto por aspecto (agrupando os que fazem sentido ter o mesmo tema, como fizemos aqui), qual convenção usar, sempre com opções concretas nomeando exemplos reais/plausíveis de verdade — não categorias abstratas vazias.

Aspectos a cobrir (pule os que não fizerem parte do escopo, no caso de aprimoramento):

1. **Naves de combate** (`corvette`, `destroyer`, `cruiser`, `battleship`, `titan`, `juggernaut`) — pergunte se usam uma convenção única ou se dividem (ex.: naves leves com uma referência, capitais com outra, como no exemplo acima).
2. **Naves utilitárias/de exploração** (`constructor`, `colonizer`, `sponsored_colonizer`, `transport`, `science`, `research_station`, `military_station_*`, `ion_cannon`) — mesma pergunta: convenção única ou várias por função (colonização ≠ construção ≠ ciência, como no exemplo).
3. **`ship_names.generic`** — pool de fallback; normalmente faz sentido ser uma mistura das convenções acima (não precisa de tema próprio).
4. **Frota** (`fleet_names`) — geralmente nomes de unidade militar (esquadrão, corpo expedicionário, etc.) com o adjetivo/gentílico do tema.
5. **Exército** (`army_names`, os `sequential_name` — sempre com `l10n|` e um placeholder tipo `$ORD$`) — mesma lógica de unidade militar, tom pode variar por tipo de exército (defesa, ocupação, escravo, etc., olhe as chaves já usadas em `altmer.json`/`brazil.json` como referência do que cada uma significa).
6. **Planetas** — convenção geral, e se o bioma (`pc_<classe>`) deve influenciar a escolha dentro dessa convenção (como no exemplo do animal-por-bioma).
7. **Personagens** (`character_names` — nomes próprios de pessoa) — de onde tirar primeiro/segundo nome: um idioma/cultura real, um padrão inventado com prefixos/sufixos combinatórios (como o mod já faz pra Altmer), etc.

Se o usuário responder "mix"/"várias" pra um aspecto com múltiplas categorias, proponha o mapeamento categoria→convenção por escrito (como fizemos aqui) e peça confirmação numa pergunta só, em vez de perguntar categoria por categoria.

## Geração de conteúdo (regras técnicas obrigatórias)

- **Estrutura do JSON**, top-level:
  ```json
  {
    "name": "Sagittarius - <Nome>",
    "desc": "§YLeaders:§! ...\n§YShips:§! ...\n§YFleets:§! ...\n§YColonies:§! ...",
    "ssm_<id>": {
      "category": "...",
      "ship_names": { "generic": [...], "<ship_size>": [...] },
      "ship_class_names": { "generic": [...], "<ship_size>": [...] },
      "fleet_names": { "random_names": [...] },
      "army_names": { "<army_type>": { "sequential_name": "l10n|..." } },
      "planet_names": { "generic": { "names": [...] }, "<pc_classe>": { "names": [...] } },
      "character_names": { "main": { "weight": <número>, "first_names_male": [...], "first_names_female": [...], "second_names": [...] } }
    },
    "species_names": [
      { "key": "...", "name": "...", "plural": "...", "home_planet": "...", "home_system": "...", "species_class": "HUM" }
    ],
    "_meta": {
      "ship_names": {
        "corvette": { "theme": "etnias indígenas de tribo brasileiras", "target_count": 29 },
        "generic": { "theme": "mistura de todas as convenções de ship_names abaixo", "target_count": 9 }
      },
      "planet_names": {
        "pc_ocean": { "theme": "animais marinhos brasileiros, estilo 'X Celeste'", "target_count": 6 }
      },
      "character_names": { "theme": "...", "target_count": 248 }
    }
  }
  ```
  `species_names` e `_meta` são **irmãos** de `ssm_<id>` no JSON, nunca aninhados dentro dele — o `.txt` do name_list não aceita essas chaves (o gerador (`parseNameListFile`) já as remove antes de escrever).
  - `_meta` registra, por aspecto/categoria, o tema decidido na entrevista e a quantidade-alvo escrita — é o que permite uma próxima chamada da skill (aprimoramento) saber "qual era o tema disso" sem ter que adivinhar olhando os nomes, e decidir com precisão se uma categoria já bateu, ficou aquém ou passou do volume-alvo. Escreva/atualize `_meta` pra todo aspecto que você gerar ou alterar (não precisa cobrir 100% das chaves de uma vez — cubra pelo menos o que você tocou nesta rodada). Não é lido por `bun run names`, só existe pra uso da própria skill.
- **Regra de localização do projeto: literal por padrão.** Toda string de nome (`ship_names`, `character_names`, `planet_names`, arrays em geral) é string literal comum, sem prefixo. O prefixo `l10n|` é reservado **só** pra `sequential_name` (campos com placeholder `$ORD$`/`$O$`/`$C$`/`$R$`/`$HEX$`) — é requisito funcional desde o patch 3.6 do jogo, não estilo; esquecer o prefixo faz o nome nunca incrementar, sem erro visível em jogo (mas o `bun run names` trava nisso).
- **`character_names`**: nomeie o bloco cultural de `main` (nunca `default` — colide com uma regra do schema do cwtools) e sempre inclua `weight`.
- **Chaves reservadas**: use só chaves que existam em `scripts/vanilla-keys.json` (`army`, `shipSize`, `planetClass`). `ship_names`/`ship_class_names` aceitam `generic` livre; `army_names` aceita `generic`/`general` livres; `planet_names` aceita `generic` livre — fora isso, a chave precisa estar na lista.
- **`species_names[].key`**: identificador único (sem espaço, só letras/números/underscore) — confira que não colide com nenhuma chave já usada em outro JSON de `assets/name_lists/`.
- **`species_names[].species_class`**: obrigatória, e precisa estar em `SPECIES_CLASSES_VALIDAS` (`scripts/portrait-schema/vocabulario.ts`) — é a chave sob a qual o jogo agrupa a entrada em `ssm_species_names.txt`.
- **Sem duplicata dentro da mesma categoria.** Ao montar arrays combinando pools/fatiando listas, confira programaticamente (`v.filter((x,i) => v.indexOf(x) !== i)`) antes de escrever — já rolou bug de duplicata por `slice`/`while` mal calculado numa sessão anterior.

## Passo final

Só começa depois do "sim" explícito no portão de confirmação (seção Entrevista).

1. Escreva `assets/name_lists/<id>.json` (indentação de 2 espaços, conforme `.editorconfig`), incluindo `_meta` atualizado pros aspectos tocados.
2. Rode `bun run names`.
3. Se falhar, leia os erros (são específicos: chave inválida, seção desconhecida, `sequential_name` sem `l10n|`, `key` duplicada, `species_class` inválida) e corrija o JSON, repetindo até passar.
4. Ao passar, informe ao usuário o que foi gerado (contagens por categoria, convenções aplicadas por aspecto, espécies-flavor criadas/alteradas) e que os arquivos do mod (`.txt`/`.yml`) já foram atualizados.

## Fora de escopo

Esta skill não mexe em `portrait_sets`, `portrait_categories`, retratos gráficos (`.dds`) ou qualquer coisa fora de `assets/name_lists/` + a geração via `bun run names`. Se o tema pedido pedir um retrato que ainda não existe no mod, informe o usuário — criar um portrait novo é um trabalho de arte separado, fora do escopo desta skill (veja `docs/pipeline-taxonomy.md`).
