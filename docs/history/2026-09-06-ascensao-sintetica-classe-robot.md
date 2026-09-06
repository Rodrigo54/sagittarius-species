# Ascensão Sintética não mostrava nenhum robô do mod

Relato de como se chegou à causa e à correção de um bug relatado pelo Rodrigo: depois de ascender uma espécie a
sintética num save com todas as DLCs (Machine Age incluso), nenhum dos quatro retratos mecânicos do mod
(`ssm_timbot`, `ssm_cyborg`, `ssm_green_order`, `ssm_new_order`) aparecia como opção na tela de Personalizar
Espécie — mesmo esses quatro aparecendo normalmente ao criar um império mecânico do zero (Machine Intelligence,
Driven Assimilator, Rogue Servitor).

## Investigação

A primeira hipótese — falha na taxonomia declarada pelo `portrait.json` do timbot — caiu rápido: os quatro
`species_classes: ["MACHINE"]` estavam registrados certinho em `ssm_portrait_sets.txt`/`ssm_portrait_categories.txt`,
idênticos entre si, e o fato de a criação de império novo funcionar (confirmado pelo Rodrigo) já indicava que o
problema não estava na taxonomia como um todo.

A virada veio explorando os arquivos do próprio jogo (`common/species_classes/00_species_classes.txt`,
`common/portrait_sets/00_portrait_sets.txt`, `common/scripted_effects/02_machine_age_effects.txt`): o Stellaris
tem **duas** `species_class` de robô, não uma:

- `MACHINE` — a que este mod já usava. Base-game, sem gate de DLC, escolhível na criação de império.
- `ROBOT` — `playable = { has_global_flag = game_started }` no vanilla: **nunca** aparece na criação de império,
  só na tela de Personalizar Espécie que a Ascensão Sintética (e a montagem de robôs) abre em pleno jogo. O
  próprio vanilla registra um set (`robots`, em `00_portrait_sets.txt`) com essa classe, do mesmo jeito que
  qualquer outro `portrait_set` — confirmando que um mod pode fazer o mesmo.

As duas classes têm pools de retrato **totalmente separados**: nenhum retrato registrado só em `MACHINE`
aparece na tela de `ROBOT`, e vice-versa. O mod nunca tinha registrado nada em `ROBOT` — daí os quatro robôs
sumirem especificamente nesse fluxo, e só nele.

## Decisão

Perguntado quais retratos deveriam ganhar a classe `ROBOT`, o Rodrigo escolheu os quatro que já são `MACHINE`
(não as 19 espécies do mod inteiras — isso pediria arte robótica nova por classe de origem, como o vanilla faz
com `sd_hum_robot`/`sd_mam_robot`/etc., fora de escopo aqui).

A forma de declarar isso também foi decidida em conversa: em vez de um campo novo no `portrait.json` (cogitado
um boolean `synthetic_portrait` ou um array `extra_species_classes`), o Rodrigo pediu a regra mais simples —
**`ROBOT` nunca é declarável, o gerador deriva sozinho**: toda espécie cujo `species_classes` incluir `MACHINE`
entra automaticamente também no set `ssm_robots`, sem nenhuma mudança nos `portrait.json` existentes nem nos
futuros. Ficou de fora do vocabulário declarável (`SPECIES_CLASSES_VALIDAS`) de propósito, pelo mesmo motivo que
`PSIONIC`/`CYBERNETIC` também ficam de fora — só que aqui a razão é "não existe pra ser escolhida", não "só
serve pro ship set".

Também ficou claro que `ROBOT` não precisa de entrada em `portrait_categories`: o vanilla não tem nenhuma aba
apontando pra essa classe (a tela que a usa não tem abas, é uma lista só), então `ssm_robots` só existe em
`ssm_portrait_sets.txt`.

## Implementação

`derivarSets` (`scripts/generate-taxonomy/agrupamento.ts`) ganhou um segundo passo, depois do laço normal sobre
`species_classes`: toda espécie com `MACHINE` na lista entra também, incondicional, num grupo `ROBOT|` que vira
o set `ssm_robots`. `SetDerivado.species_class` foi alargado para aceitar o literal `'ROBOT'` além de
`SpeciesClassId` — só nesse tipo interno do gerador, sem tocar o vocabulário declarável do schema. `nomeDoSet`
resolve `ROBOT` direto pro nome fixo (`SET_ROBOT_DERIVADO`, em `vocabulario.ts`), sem passar pela lógica de
sufixo temático — não existe mais de um grupo `ROBOT` possível, já que a derivação nunca carrega categoria.

Ver o estado atual (o que `ROBOT` é, por que o mod deriva assim) em `docs/pipeline-taxonomy.md`.
