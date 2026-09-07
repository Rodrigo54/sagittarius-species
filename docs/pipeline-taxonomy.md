# Pipeline de taxonomia: como uma espécie chega às abas do jogo

Como `bun run taxonomy` transforma a filiação declarada em cada `portrait.json` nos dois arquivos de `common/`
que registram os retratos do mod, e a mecânica **vanilla** por trás disso — o que é `species_class`, o que é
`portrait_set`, o que é `portrait_category`, e por que cada um existe. Pra arte e enquadramento do retrato em
si, veja `docs/pipeline-portraits.md`.

## Os três conceitos do jogo, e quem faz o quê

| Conceito | Onde mora | O que decide |
| --- | --- | --- |
| **`species_class`** | `common/species_classes/` (vanilla) | O que a espécie **é** mecanicamente: traços, clima, cultura gráfica de nave, insultos/cumprimentos, se a IA pode sorteá-la. |
| **`portrait_set`** | `common/portrait_sets/` | Quais retratos ficam disponíveis para uma `species_class` — e, via `randomizable`/`playable`, **para quem**. |
| **`portrait_category`** | `common/portrait_categories/` | Só a **aba** do editor de império: agrupa sets para exibição. |

Duas consequências que não são óbvias e definem todo o resto:

1. **A classe de uma espécie vem do set, nunca da categoria.** Escolher um retrato pela aba "Sagittarius" ou
   pela aba "Aquatic" dá exatamente o mesmo resultado, se o retrato veio do mesmo set.
2. **O `name` de uma categoria é só uma chave de localização**, não uma referência a `species_class`. O vanilla
   prova: `biogenesis = { name = BIOGENESIS_CAT }` e `synthetics = { name = SYNTH }`, e nem `BIOGENESIS_CAT` nem
   `SYNTH` existem em `common/species_classes/`. É por isso que a categoria própria deste mod
   (`sagittarius = { name = ssm_sagittarius }`) funciona sem existir classe alguma com esse nome — basta a chave
   `ssm_sagittarius` nos `.yml`.

### Por que este mod não tem `species_classes` próprias

**O campo `portraits` dentro de um bloco `species_class` é rejeitado pelo parser do jogo.** Não é ignorado em
silêncio: aparece no `error.log` como `Unexpected token: portraits`. Um mod que declare a lista de retratos ali
não está registrando nada — o registro que funciona é `portrait_sets`.

Classes próprias continuariam válidas como *classes* (arquétipo, cultura gráfica, flavor de insulto), mas só
teriam retrato através de um `portrait_set` apontando para elas. Este mod não faz isso: usa as classes vanilla,
e o histórico da decisão está em `docs/history/2026-08-17-taxonomia-de-portraits.md`.

### As classes que existem mas não servem para espécie

`PSIONIC` e `CYBERNETIC` **não** entram no vocabulário aceito (`SPECIES_CLASSES_VALIDAS` em
`scripts/portrait-schema/vocabulario.ts`), apesar de existirem em `common/species_classes/`. As duas têm
`randomized = { always = no }`, e a `PSIONIC` traz um comentário explícito da Paradox:

```text
PSIONIC = {
	# This species class should only be used for its ship set
	playable = { has_shroud_dlc = yes }
	randomized = { always = no }
	graphical_culture = psionic_01
}
```

Elas existem para o **ship set** — a aparência das naves. Usá-las como classe de espécie tiraria a espécie do
sorteio de impérios de IA, que é o oposto do que se quer ao publicar um retrato. É por isso que
`ssm_mercenary` e `ssm_astral` são `HUM` e aparecem nas abas `cybernetics`/`psionics` apenas como **categoria**.

## O que a espécie declara

Dois campos no `portrait.json`, validados pelo schema (`scripts/portrait-schema/`):

```json
{
  "species_classes": ["INF", "REP"],
  "categories": ["infernals", "reptilians"]
}
```

- **`species_classes`** — as classes que a espécie pode ter, **em ordem de preferência**. É a ordem que gera os
  gates de DLC (veja abaixo). Uma classe só = espécie sem alternativa.
- **`categories`** — as abas onde ela aparece, declaradas por extenso. `sagittarius` nunca é declarada: toda
  espécie do mod entra nela automaticamente.

Regras que o schema garante: nenhuma repetição, e nenhuma categoria **espelhada** sem a classe que ela espelha
(declarar `aquatics` sem `AQUATIC` é erro). O inverso é permitido — uma espécie pode ter uma classe e não
declarar a aba dela, aparecendo só nas temáticas.

### Os dois tipos de categoria

- **Espelhada**: corresponde a uma classe (`infernals` ↔ `INF`, `humanoids` ↔ `HUM`). O `name` é a própria
  classe.
- **Temática**: transversal a classes, com rótulo próprio. No vanilla, `cybernetics` agrupa sets de **sete**
  classes diferentes (`cybernetic_humans`, `cybernetic_reptilians`, `cybernetic_fungoids`...), e o set temático
  aparece nas duas abas: a da classe e a do tema.

## Como o set é derivado

O gerador **não** tem uma lista de sets: ele agrupa as espécies por `(species_class × conjunto de categorias)`,
e cada grupo vira um set. É isso que permite duas espécies da mesma classe aparecerem em abas diferentes —
`ssm_mercenary` (`HUM`, em `humanoids`+`cybernetics`) não pode dividir set com os elfos (`HUM`, só em
`humanoids`), senão a aba Cybernetic mostraria elfos.

O nome sai de `SET_DA_CLASSE` (`scripts/generate-taxonomy/vocabulario.ts`): `HUM` → `ssm_humanoids`,
`MACHINE` → `ssm_machine`. Quando a classe tem mais de um grupo, as categorias temáticas entram no nome:
`ssm_humanoids_cybernetics`, `ssm_humanoids_psionics`. **O nome depende do conjunto inteiro de espécies** — um
grupo temático sozinho na classe usa o nome curto e ganha o sufixo no dia em que um segundo grupo aparecer.
Renomear é inofensivo: set só é referenciado por `portrait_categories`, gerado no mesmo passo.

## Gates de DLC e o fallback por preferência

Seis classes dependem de Species Pack. O trigger de cada uma é derivado no script (`GATE_DA_CLASSE`), nunca
declarado no JSON — é propriedade da classe, não da espécie:

| classe | gate |
| --- | --- |
| `PLANT` | `has_plantoids` |
| `LITHOID` | `has_lithoids` |
| `NECROID` | `has_necroids` |
| `AQUATIC` | `has_aquatics` |
| `TOX` | `has_toxoids` |
| `INF` | `has_infernals` |

Três dessas classes têm uma **segunda porta** (`PLANT` também é jogável com o Ancient Relics, `AQUATIC` com o
Shadows of the Shroud, `NECROID` com o Vipra the Vapor), e o gate usado é o do Species Pack mesmo assim — é o
recorte que o vanilla faz nos sets dessas classes. Quem entrou pela porta secundária recebe a espécie na classe
de fallback, nunca fica sem retrato.

A ordem de `species_classes` vira condição assim: **a primeira afirma o gate; as seguintes acumulam as
negações.** Para `["AQUATIC", "HUM"]`:

```text
ssm_aquatics = {
  species_class = AQUATIC
  conditional_portraits = {
    randomizable = { has_aquatics = yes }
    playable     = { has_aquatics = yes }
    portraits = { "ssm_mermaids" }
  }
}

ssm_humanoids = {
  species_class = HUM
  portraits = { "ssm_elves" ... }              # espécies sem condição
  conditional_portraits = {
    randomizable = { has_aquatics = no }       # a IA só faz sereia humanoide sem o DLC
    playable     = { always = yes }            # o jogador escolhe humanoide quando quiser
    portraits = { "ssm_mermaids" }
  }
}
```

Note que os dois eixos divergem no fallback: `randomizable` (a IA) segue a preferência, `playable` (o editor)
não. O porquê está em "Duas regras da UI", logo abaixo.

Uma classe **sem** gate declarada antes do fim da lista é erro de validação: como ela está sempre disponível, a
negação que levaria à classe seguinte nunca seria verdadeira, e o set resultante seria inalcançável.

### Duas regras da UI que moldam o resto

Ambas foram medidas in-game, e juntas explicam por que o `playable` do fallback é `always = yes` e por que a
guarda-chuva não recebe todos os sets:

1. **`playable` falso não esconde a célula: deixa cinza.** É o mesmo mecanismo com que o Stellaris exibe
   retratos de DLC que o jogador não comprou — a célula aparece bloqueada, com um tooltip explicando a condição
   (`❌ Aquatics Species Pack está ativado`, no caso de um gate negado).
2. **O jogo deduplica o retrato por aba e fica com a primeira ocorrência**, na ordem em que os sets aparecem na
   categoria — não com a mais permissiva. Se o mesmo retrato vem de dois sets e o primeiro está bloqueado, é o
   bloqueado que aparece.

Daí duas decisões do gerador:

- **No fallback, `playable = { always = yes }`.** Espelhar a negação ali deixaria a espécie cinza na aba da
  classe de fallback justamente para quem *tem* o DLC — o oposto da intenção. Quem tem o Aquatics pode escolher
  a sereia humanoide de propósito; a preferência continua valendo para a IA, via `randomizable`.
- **A guarda-chuva recebe só os sets sempre disponíveis** — os que são a última opção de alguma espécie. Um set
  condicionado a DLC na aba do mod deixaria a espécie cinza ali para quem não tem o DLC, mesmo havendo fallback,
  porque a dedupe escolhe pela ordem e não pela disponibilidade.

Resultado para `ssm_mermaids`:

| | aba Sagittarius | aba Aquatic | aba Humanoid | império de IA |
| --- | --- | --- | --- | --- |
| **sem** o Aquatics | sereia (humanoide) | cinza (vitrine do DLC) | sereia | `HUM` |
| **com** o Aquatics | sereia (humanoide) | sereia | sereia | `AQUATIC` |

Você escolhe a classe **pela aba por onde entra**: a aba Aquatic dá a sereia aquática, a Humanoid dá a
humanoide — uma espécie `HUM` de verdade, com traços, clima e flavor humanoides. A aba do mod sempre oferece a
versão que funciona para qualquer jogador.

## A classe `ROBOT`: retrato pós-Ascensão Sintética

O jogo tem uma segunda species_class de robô, além de `MACHINE`: **`ROBOT`**. É a classe que a Ascensão Sintética
(e a montagem de robôs) atribui à espécie resultante — nunca aparece na criação de império (`playable = {
has_global_flag = game_started }` no vanilla), só na tela de Personalizar Espécie que se abre **depois** que a
partida já começou. `MACHINE` e `ROBOT` têm pools de retrato totalmente separados: um retrato registrado só em
`MACHINE` funciona normalmente pra criar um império mecânico do zero, mas nunca aparece pra quem ascende a
sintético num império orgânico — são duas listas diferentes, não uma questão de aba ou de DLC.

Nenhuma espécie declara `ROBOT` no `portrait.json` — não é uma `species_classes` válida (`SPECIES_CLASSES_VALIDAS`
em `scripts/shared/stellaris.ts` não a lista). O gerador deriva sozinho: **toda espécie que declarar `MACHINE`
entra automaticamente também num set `ssm_robots` (`species_class = ROBOT`), incondicional**, pra que qualquer
retrato mecânico do mod fique disponível também na Ascensão Sintética. `ssm_robots` não tem categoria nenhuma e
fica fora da guarda-chuva: o vanilla também não tem nenhuma `portrait_category` apontando pra `ROBOT` (o próprio
set `robots` do jogo-base não aparece em nenhuma aba), porque a tela que usa essa classe não tem abas — é uma
lista só. Detalhes da derivação: `derivarSets` em `scripts/generate-taxonomy/agrupamento.ts`; o porquê completo,
incluindo como isso foi descoberto: `docs/history/2026-09-06-ascensao-sintetica-classe-robot.md`.

## Formato do arquivo gerado

- **Um bloco `conditional_portraits` por espécie**, nunca agrupando espécies de condição igual. O arquivo fica
  mais longo e cada espécie vira uma unidade isolada: adicionar ou remover uma dá um diff de poucas linhas, e a
  ordem dela na aba é controlável espécie a espécie.
- Espécies **sem condição nenhuma** ficam na lista `portraits = { }` simples do set.
- Ordem determinística: sets por classe e nome, espécies por slug, categorias na ordem do vocabulário com
  `sagittarius` primeiro.

## Comandos

```bash
bun run taxonomy   # regenera os dois arquivos de common/ a partir dos portrait.json
bun run portrait   # faz a mesma coisa no fim, depois de sincronizar arte/DDS
```

`bun run portrait` **sempre** regenera o registro inteiro, mesmo filtrado a uma espécie
(`bun run portrait ssm_drakelings`) — os dois arquivos descrevem o mod todo, e escrever com filtro produziria um
registro incompleto. Ler os 19 `portrait.json` custa milissegundos. A taxonomia é **derivada junto das outras
validações e escrita só no fim**, pra que uma filiação inválida em qualquer espécie trave a execução antes de
converter textura ou apagar `.dds` órfão.

`bun run taxonomy` sozinho serve pra quando nenhuma arte mudou — só a filiação.

## Anatomia do pipeline

| Arquivo | Papel |
| --- | --- |
| `scripts/generate-taxonomy/index.ts` | Entry point de `bun run taxonomy`. |
| `scripts/generate-taxonomy/gerar.ts` | `derivarTaxonomia` (lê + valida, sem escrever) e `escreverTaxonomia`. |
| `scripts/generate-taxonomy/agrupamento.ts` | Agrupa por `(classe × categorias)`, nomeia os sets, deriva as condições. |
| `scripts/generate-taxonomy/txt-writer.ts` | Serializa os dois `.txt`. |
| `scripts/generate-taxonomy/vocabulario.ts` | Vocabulário do jogo: nome do set por classe, gate por classe, rótulo por categoria. |
| `scripts/portrait-schema/vocabulario.ts` | O que a espécie **pode declarar**: classes e categorias válidas, e qual categoria espelha qual classe. |

## Ver também

- `docs/pipeline-portraits.md` — a arte do retrato: enquadramento, DDS, `portrait_groups`.
- `docs/pipeline-nomes.md` — `species_names` agrupado por `species_class`, sem vínculo com retrato.
- `docs/history/2026-08-17-taxonomia-de-portraits.md` — por que este pipeline existe e o que foi descoberto.
