# Pendências e ideias futuras

Registro do que ainda está genuinamente em aberto — não implementado, sem decisão tomada, ou decisão tomada de
propósito adiar. Itens resolvidos saem daqui assim que resolvidos (o histórico de como cada um foi resolvido
vive em `docs/history/`, não aqui).

## Etnia por arquétipo (`ETNIAS` específico por `TIPOS`)

Hoje `ETNIAS` (`scripts/portrait-schema/vocabulario.ts`) é uma lista **única e global**, usada do mesmo jeito
não importa o `tipo` (arquétipo visual) da espécie — faz sentido pra `Human` (`African`/`Asian`/`Nordic`/etc.),
mas não faz sentido nenhum pra `Robot` (não tem etnia) e seria um vocabulário completamente diferente pra
`Elf`/`Mermaid`/`Molluscoid`/etc. (ex.: um elfo poderia ter "sub-etnias" tipo Alto Elfo/Elfo da Floresta/Elfo
Negro, sem nenhuma relação com `African`/`Asian`).

**Não implementado de propósito (YAGNI).** Existem hoje duas espécies não-`Human` com `geracaoArt`, e cada uma
resolveu a questão sem precisar de vocabulário próprio:

- **`ssm_mermaids`** (`archetype: "Mermaid"`) declara `person.ethnicity` normalmente (`Caucasian`, `Nordic`,
  `African`, `Asian`...) e funciona bem — sereias são humanoides de rosto humano, então a etnia humana descreve
  exatamente o que deveria descrever.
- **`ssm_drakelings`** (`archetype: "Draconic"`) simplesmente **omite** `person.ethnicity`. O campo é
  `.optional()` no schema e seção/campo ausente não emite fragmento nenhum no prompt
  (`scripts/generate-art/prompt-builder.ts`), então uma espécie de focinho escamoso não paga nada por um
  vocabulário que não usa.

Ou seja: o caso que forçaria a mudança seria uma espécie não-humana que precisa de **sub-etnias próprias**
(um elfo com Alto Elfo/Elfo da Floresta/Elfo Negro, um robô com linhas de fabricação) — e nenhuma existe ainda.
Generalizar `ETNIAS` pra depender de `TIPOS` agora seria complexidade especulativa, sem `portrait.json` real pra
validar o formato contra. Quando esse caso aparecer, o formato certo (provavelmente um mapa
`Record<Tipo, string[]>`, ou um enum por arquétipo) fica mais claro com ele na mesa.
