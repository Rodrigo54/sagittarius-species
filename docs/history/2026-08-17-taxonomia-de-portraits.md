# O dia em que descobrimos que as `species_classes` do mod nunca funcionaram

Registro da sessão de 2026-08-17, que começou com um bug pequeno — `bun run portrait ssm_drakelings` gerou o
`.txt` do retrato mas não registrou a espécie em lugar nenhum, então nenhum império de IA usaria os drakelings —
e terminou com um pipeline novo (`bun run taxonomy`), três arquivos a menos no mod e 1010 linhas de localização
apagadas.

O estado atual está em `docs/pipeline-taxonomy.md`. Aqui fica o porquê.

## O gatilho

Adicionar uma espécie exigia editar `common/species_classes/`, `common/portrait_sets/` e
`common/portrait_categories/` **à mão**, sem nada ligando esses arquivos ao `portrait.json` que o pipeline já
lia. Esquecer era o resultado padrão, não a exceção — e foi o que aconteceu com os drakelings.

A decisão de fundo foi tornar esses arquivos saída de pipeline, como já eram o `ssm_<espécie>_portrait.txt` e os
`name_lists`. O resto da sessão foi descobrir **o que** declarar, e para isso foi preciso entender o que cada
arquivo do jogo realmente faz.

## O que a investigação derrubou

### 1. `portraits` dentro de `species_class` é rejeitado pelo parser

A crença herdada — vinda do **Stellar Legion Mod**, de onde veio o rig — era que sem uma `species_class`
customizada o jogo não geraria impérios de IA com os retratos novos. Por isso `ssm_species_classes.txt`
declarava `ssm_sagittarius`, `ssm_presapient` e `ssm_robot`, cada uma com sua lista de `portraits`.

O `error.log` do próprio jogo, de uma sessão com o mod carregado, diz o contrário:

```text
Error: "Unexpected token: portraits, near line: 15" in file: "common/species_classes/ssm_species_classes.txt"
Error: "Unexpected token: portraits, near line: 45" in file: "common/species_classes/ssm_species_classes.txt"
Error: "Unexpected token: portraits, near line: 73" in file: "common/species_classes/ssm_species_classes.txt"
```

Linhas 15, 45 e 73: exatamente os três blocos `portraits`. O campo era **descartado no carregamento** — as três
classes nunca contribuíram retrato nenhum. O que sempre fez os retratos funcionarem foi `portrait_sets`.

Duas coisas ajudaram a crença a sobreviver anos: as regras da comunidade usadas pelo cwtools **ainda** declaram
`portraits` como campo válido de `species_class` (então o editor nunca reclamou), e o mesmo padrão aparece em
mods ativos — **Portraits Orphanage** faz igual, e sofre do mesmo erro.

### 2. O `name` de uma `portrait_category` é só uma chave de localização

A pergunta era se dava pra manter a categoria própria `sagittarius` apagando a classe `ssm_sagittarius`. O
vanilla responde: `biogenesis = { name = BIOGENESIS_CAT }` e `synthetics = { name = SYNTH }` — nenhum dos dois
existe em `common/species_classes/`. `BIOGENESIS_CAT` só aparece no `portrait_categories` e como chave de loc.

Categoria é aba de UI. Nada mais.

### 3. Insulto e cumprimento vêm da classe, e só dela

As chaves são `<SPECIES_CLASS>_insult_01`, `_compliment_01`, `_organ`, `_mouth`... em
`localisation/*/name_lists/name_lists_l_*.yml`, resolvidas por funções internas do jogo
(`GetSpeciesNameInsult`, `GetSpeciesNamePluralCompliment`). Não existe granularidade por retrato nem por
espécie-flavor.

Isso deu ao mod uma escolha real: `ssm_sagittarius` tinha **28 chaves completas, em 10 idiomas** (insultos,
cumprimentos, sons, anatomia) — trabalho pago e nunca usado, porque nenhuma espécie chegava a pertencer à
classe. Reativá-las exigiria um `portrait_set` com `species_class = ssm_sagittarius`.

Chegamos a considerar a alternativa de somar chaves às classes vanilla (`REP_insult_03`, aproveitando que a
contagem varia por classe — `MINDWARDEN` tem exatamente 3, o que prova que o jogo lê até faltar). Foi
descartada: a chave é por classe, então o insulto dracônico entraria no sorteio de **toda** espécie reptiliana
do jogo, e `INF` já usa `01..04`, sem vaga.

A decisão foi **apagar as três classes e aceitar o flavor vanilla**. As espécies do mod são humanoides,
reptilianas, aquáticas — e recebem os insultos dessas classes, como qualquer espécie do jogo. As 99 linhas de
loc por idioma foram removidas; sobrou só `ssm_sagittarius`, que a categoria consome como rótulo.

### 4. `PSIONIC` e `CYBERNETIC` existem para o ship set

Ao decidir se `ssm_astral` deveria ser `PSIONIC` e `ssm_mercenary` `CYBERNETIC` — o que parecia óbvio, já que
as categorias existiam —, as duas classes se revelaram armadilhas: ambas têm `randomized = { always = no }`, e a
`PSIONIC` traz o comentário `# This species class should only be used for its ship set`. Adotá-las **tiraria as
espécies do sorteio de IA**, exatamente o oposto do objetivo da sessão.

As duas seguem `HUM`, aparecendo nas abas temáticas apenas como categoria.

### 5. `species_names` não tem vínculo com retrato

O JSON de name_list declarava um `portrait` por espécie-flavor, e `portrait-map.ts` parseava
`ssm_portrait_sets.txt` **por regex** para deduzir a `species_class` dali. A pergunta que desfez isso: amarrar um
name_list a um portrait garante que o retrato venha com aquele name list, ou que a IA que use aquele retrato
use aquele name list?

Nenhum dos dois. `species_names` não tem campo de portrait em lugar nenhum do vanilla — a entrada só tem `name`,
`plural`, `home_planet`, `home_system`, `name_list`, agrupada sob a `species_class`. Ao gerar um império, o jogo
sorteia espécie-flavor e retrato **independentemente**, dentro da classe. O campo `portrait` era só um atalho de
autoria.

Trocá-lo por `species_class` explícito matou de uma vez o `portrait-map.ts`, o regex sobre Clausewitz gerado, a
checagem de ambiguidade e a dependência de ordem entre os dois pipelines. O `ssm_species_names.txt` saiu
**byte-idêntico** depois da migração das 30 entradas — a prova de que a troca não mudou comportamento.

## O desenho que sobrou

A espécie declara **o que ela é** (`species_classes`, em ordem de preferência) e **onde aparece**
(`categories`). Todo o resto é derivado: o set vem do agrupamento `(classe × categorias)`, o gate de DLC vem de
uma tabela por classe, o nome do set vem do vocabulário do jogo.

Duas ideias descartadas no caminho, e por quê:

- **Derivar o set só da classe.** Cairia no problema de `ssm_cybernetics`, que existe justamente para o
  `ssm_mercenary` (`HUM`) ocupar uma aba diferente da dos elfos (`HUM`). Set é a interseção de classe e
  categoria — que é como o vanilla nomeia os dele: `cybernetic_reptilians`, `psionic_fungoids`.
- **Um arquivo central `taxonomia.json`.** Chegou a ser a decisão, e caiu quando ficou claro que a informação
  já estava toda no `portrait.json` mais o vocabulário fixo do jogo. Arquivo central seria um terceiro lugar
  para esquecer de editar — o problema que a sessão veio resolver.

## O fallback, e o que o jogo ensinou sobre ele

O fallback por DLC (`["AQUATIC", "HUM"]` = aquática com o Species Pack, humanoide sem) nasceu exclusivo nos dois
eixos: `randomizable` e `playable` recebiam a mesma condição. Isso tirava uma escolha — com o Aquatics
instalado, não havia como fazer uma sereia humanoide de propósito —, e a primeira tentativa de resolver foi um
**set complementar** (`ssm_humanoids_alt`), com `randomizable = { always = no }` e `playable` exigindo o DLC da
classe preferida, fora da categoria guarda-chuva.

O desenho inteiro repousava numa suposição: a de que `playable` falso **esconderia** o retrato da aba. O teste
in-game derrubou as duas metades dela de uma vez:

1. **`playable` falso não esconde: acinzenta.** Na aba Humanoide, sereia, elfos verdes e necron apareceram
   bloqueados, com o tooltip do jogo explicando a condição: `❌ Aquatics Species Pack está ativado`. É o mesmo
   mecanismo com que o Stellaris exibe retratos de DLC não comprado — vitrine —, funcionando ao contrário,
   porque quem tinha o DLC é que ficava sem a versão humanoide.
2. **O jogo deduplica o retrato por aba, ficando com a primeira ocorrência na ordem dos sets da categoria** —
   não com a mais permissiva. Foi o que a contagem in-game mostrou: uma célula por aba em todos os casos. Na
   aba Humanoide venceu `ssm_humanoids` (bloqueado), porque vem antes de `ssm_humanoids_alt`; na aba
   Sagittarius venceu `ssm_aquatics` (liberado), porque vem antes de `ssm_humanoids`.

Consequência direta: o set complementar **nunca ganharia a dedupe**, sendo sempre o segundo. Ele foi removido.
E a promessa que tínhamos combinado — "a aba do mod mostra a premium para quem tem o DLC e o fallback para quem
não tem" — mostrou-se inalcançável, porque a dedupe escolhe por ordem, e a ordem é fixa no arquivo: o que varia
é só se a célula está cinza.

O desenho final tem duas regras, ambas consequência direta do que foi medido:

- **`playable = { always = yes }` no fallback.** A preferência vive só no `randomizable`, que a IA lê e a UI
  não exibe. Nada fica cinza indevidamente, e a escolha de classe passa a ser "pela aba por onde você entra".
- **A guarda-chuva recebe só os sets sempre disponíveis** (os que são a última classe de alguma espécie). Um
  set condicionado a DLC ali deixaria a espécie cinza na aba do mod para quem não tem o DLC.

A segunda regra formalizou um padrão que o mod já usava sem nome: antes desta sessão, `ssm_necroids`,
`ssm_plantoids` e `ssm_psionic` estavam **fora** da categoria `sagittarius`, escritos assim à mão — o mesmo
truque, aplicado caso a caso, provavelmente descoberto do mesmo jeito.

## O que mudou de comportamento, de fato

| Antes | Depois |
| --- | --- |
| `ssm_drakelings` não existia em set nenhum | `INF` (com o DLC) ou `REP` (sem) |
| Sereia só `AQUATIC`; sem o Species Pack, retrato oferecido numa classe injogável | Fallback humanoide, e escolha explícita com o DLC |
| `ssm_necron`/`ssm_green_elves` em duas classes sem gate: IA sorteava nas duas | Preferência: necroide/plantoide com DLC, humanoide sem |
| `ssm_astral` em **dois** sets `HUM` — peso dobrado no sorteio | Um set só |
| Três `species_class` próprias rejeitadas pelo parser | Removidas; 3 erros a menos no `error.log` |
| 1030 linhas de localização de flavor, nunca consumidas | 20 linhas (o rótulo da categoria, em 10 idiomas) |

O checksum do jogo continua alterado — `common/**/*.txt` entra no `checksum_manifest.txt`, e `portrait_sets`/
`portrait_categories` são obrigatórios em `common/`. Compatibilidade com conquistas é inalcançável para um mod
de espécies, e apagar o `species_classes` não muda isso.
