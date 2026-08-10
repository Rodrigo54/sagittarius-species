# Restauração dos masters nativos de `assets/portraits/` (rig `ssm_shared`)

Script one-shot (`scripts/restore-masters/index.ts`, commit `34b2bd8`, 2026-07-27) — já rodou, já foi apagado do
repositório. Este arquivo é o registro do propósito e da técnica, pra servir de ponto de partida se uma
restauração parecida (arte publicada vira arte-fonte de novo) for necessária de novo. Não é história de decisão
de arquitetura — é a lógica de um script descartável.

## Por quê

`scripts/migrate-portraits/` (também já extinto) reenquadrava os PNGs de `assets/portraits/` **in place**: a
arte publicada era o resultado de um resize (+18% a +45% de upscale sobre a fonte original), e o master nativo
só sobrevivia no histórico do git. Quando o enquadramento passou a ser **derivado** a cada `bun run portrait`
(em vez de reescrito na arte-fonte), fazia sentido `assets/` voltar a guardar arte nativa — mas a arte nativa já
tinha sido sobrescrita pela versão enquadrada, então precisava ser recuperada do commit anterior à migração de
cada espécie.

## A técnica

1. **Mapa de commit por espécie.** Um `Record<slug, commitDeMigracao>` fixo no script, um commit por espécie —
   o estado pré-migração é o **pai** desse commit (`${commit}^`). Cobria as 16 espécies migradas pro
   `ssm_shared` na época (`ssm_mermaids`/`ssm_astral` ficaram de fora de propósito: estavam revertidas pro
   `sl_shared`, congeladas — `ssm_astral` foi remigrada depois, ver `docs/rig.md`).
2. **Fonte é a árvore do git, não o disco.** `git ls-tree -r --name-only <commit>^ -- assets/portraits/<slug>/`
   lista os PNGs como existiam antes da migração. Comparado contra `git ls-files` (o disco hoje): se a
   contagem divergisse, era sinal de que a migração tinha mudado a composição da espécie (arquivo
   adicionado/removido), e o caso precisava de olho humano antes de sobrescrever qualquer coisa — o script
   parava e reportava, não adivinhava.
3. **Validação de canvas por arquivo.** Cada PNG extraído do commit pré-migração precisava bater exatamente com
   o canvas do `sl_shared` (825×1650) — se não batesse, o commit mapeado para aquela espécie estava errado (ou
   a arte já era outra coisa) e a restauração parava sem escrever nada.
4. **Duas fases, nada escrito até tudo validar.** Fase 1 extrai todos os PNGs de todas as espécies pra uma pasta
   temporária (`.restore-masters-tmp/`) e valida cada um (é PNG válido, tem o canvas certo, o trim box não é
   vazio). Só se **zero erros** em **todas** as espécies, a fase 2 roda: trim + gravação no destino final. Um
   erro em qualquer espécie cancelava a operação inteira, sem escrever nada em lugar nenhum (mesmo padrão de
   "valida tudo, escreve por último" que os pipelines `generate-*` usam).
5. **Trim sem fuzz.** `magick <origem> -trim +repage <destino>` — remove só pixels 100% transparentes,
   preservando o halo de alpha 1..7 que a IA deixa em volta da arte (é esse halo que o enquadramento em
   `framing.ts` reconhece como conteúdo). Fuzz teria arriscado cortar esse halo. Perda zero: verificado
   comparando 48 amostras (soma do canal alfa idêntica ao original, dimensão igual ao trim box).
6. **Rede de segurança do próprio git.** O script recusava rodar se `assets/portraits/` tivesse mudanças não
   commitadas (`git status --porcelain`) — a restauração sobrescreve arquivos no lugar, e sem working tree
   limpo não haveria como desfazer um mapeamento de commit errado.

## Resultado

487 arquivos restaurados em 16 espécies, `git status` do `mod/` ficando limpo depois de rodar `bun run portrait`
com o guia antigo — prova de que o pipeline novo (baseado em master nativo) produzia saída byte-a-byte idêntica
à do pipeline antigo (baseado em arte pré-enquadrada), separando "a forma do pipeline mudou" de "o valor visual
mudou". Ver `docs/history/2026-07-27-enquadramento-medicao.md` para a sessão seguinte que usou esses masters.
