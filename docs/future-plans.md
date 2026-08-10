# Pendências e ideias futuras

Registro do que ainda está genuinamente em aberto — não implementado, sem decisão tomada, ou decisão tomada de
propósito adiar. Itens resolvidos saem daqui assim que resolvidos (o histórico de como cada um foi resolvido
vive em `docs/history/`, não aqui).

## Remigrar `ssm_mermaids` pro `ssm_shared`

`ssm_mermaids` segue congelada no rig legado `sl_shared` desde a preparação da release 1.8.0, por causa de um
defeito de enquadramento encontrado em teste in-game: migrada pro `ssm_shared`, a cauda de peixe — o traço mais
característico da espécie — saía do quadro (a arte tinha sido escalada grande demais, e a validação automática
de então só garantia que o conteúdo alcançasse a borda inferior do canvas, sem avaliar se algum elemento
importante da composição ficava de fora por cima/pelas laterais).

Reverter a migração ficou bem mais barato depois que o enquadramento passou a ser **derivado** a cada
`bun run portrait` (ver `docs/rig.md`) em vez de reescrito na arte-fonte: trocar de rig é só editar o campo
`rig` do `portrait.json` e rodar o pipeline de novo, sem degradar nada mesmo que o resultado não agrade — dá
pra experimentar. O que falta não é mecânico, é o próprio defeito: alguma regra nova de enquadramento (guia com
mais folga lateral, ou um ajuste específico da espécie) e julgamento visual, comparando antes/depois em
`.portraits-framed/`. `ssm_astral` tinha o mesmo status e já foi remigrada com sucesso (2026-08-10) — o defeito
dela (variantes desalinhadas entre si) tinha causa raiz diferente e foi resolvido pelo enquadramento por
densidade (`"ancora": "cabeca"`, ver `docs/rig.md`), o que não se aplica diretamente ao caso da sereia.

## Etnia por arquétipo (`ETNIAS` específico por `TIPOS`)

Hoje `ETNIAS` (`scripts/portrait-schema/vocabulario.ts`) é uma lista **única e global**, usada do mesmo jeito
não importa o `tipo` (arquétipo visual) da espécie — faz sentido pra `Human` (`African`/`Asian`/`Nordic`/etc.),
mas não faz sentido nenhum pra `Robot` (não tem etnia) e seria um vocabulário completamente diferente pra
`Elf`/`Mermaid`/`Molluscoid`/etc. (ex.: um elfo poderia ter "sub-etnias" tipo Alto Elfo/Elfo da Floresta/Elfo
Negro, sem nenhuma relação com `African`/`Asian`).

**Não implementado de propósito (YAGNI).** As únicas espécies com `geracaoArt` configurado hoje (`ssm_default`,
`ssm_astral`) são as duas `tipo: "Human"` — não existe ainda nenhum caso concreto de espécie `Elf`/`Mermaid`/
`Robot`/etc. com `geracaoArt` que precisaria de etnia própria. Generalizar `ETNIAS` pra depender de `TIPOS`
agora seria complexidade especulativa, sem `portrait.json` real pra validar o formato contra. Quando a primeira
espécie não-`Human` precisar disso de verdade, o formato certo (provavelmente algo como um mapa
`Record<Tipo, string[]>`, ou um enum por arquétipo) fica mais claro com um caso real na mesa.
