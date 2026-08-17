# 2026-08-14 — `ssm_mermaids` sai do `sl_shared`, e o rig legado fica sem nenhuma espécie

Relato da última migração de rig do pacote. Com ela, `sl_shared` deixa de ser o rig de qualquer espécie e passa
a existir só como entrada de derivação do `ssm_shared` — o estado atual está descrito em `docs/rig.md` e
`docs/pipeline-portraits.md`; aqui fica o porquê.

## O que travava

`ssm_mermaids` estava congelada no `sl_shared` desde a preparação da release 1.8.0, por um defeito encontrado em
teste in-game: migrada pro `ssm_shared`, a cauda de peixe — o traço que define a espécie — saía do quadro. A
validação automática de então só garantia que o conteúdo alcançasse a borda inferior do canvas; nada avaliava se
um elemento importante da composição ficava de fora.

Isso deixou a espécie num limbo desconfortável: era a única presa a um rig cuja UV desperdiça metade do canvas,
e por isso a única que não podia receber arte pelo pipeline de geração via IA, que pressupõe o canvas do
`ssm_shared`.

`ssm_astral` esteve no mesmo limbo e saiu antes (2026-08-10), mas por outro caminho: o defeito dela era variante
desalinhada entre si, resolvido por `"ancora": "cabeca"` (enquadramento por densidade). Nada disso servia pra
sereia, cujo problema era o extremo oposto do quadro — a borda de baixo, não a de cima.

## O que destravou

Três peças, nesta ordem:

1. **Enquadramento derivado.** Depois que o enquadramento passou a ser recalculado a cada `bun run portrait` em
   vez de ficar assado na arte-fonte, trocar de rig virou editar um campo e rodar o pipeline. Experimentar
   deixou de ter custo, e uma tentativa frustrada deixou de degradar qualquer coisa.
2. **`modo: "altura"`** (`d7fc42c`, no mesmo dia). É a peça que faltava e que o registro de pendências pedia sem
   saber nomear ("alguma regra nova de enquadramento"): **só nesse modo a cintura com a base da cauda fica
   visível**. Escalando pela largura do guia, esse pedaço da composição cai além da borda inferior do canvas e
   nunca chega à tela — e nada no pipeline reclama, porque `largura` valida sem erro nesse caso; a perda é
   silenciosa e só aparece a olho. Escalar pela altura mínima faz a base tocar exatamente a borda inferior,
   trazendo o cós de cintura alta e o começo da cauda pra dentro do quadro. O preço — a espécie sai menor que
   as que escalam por largura, e o tamanho varia entre variantes — foi aceito conscientemente; é o trade-off
   documentado em "Escolher o `modo`" (`docs/pipeline-portraits.md`).
3. **Arte nova, não a antiga reenquadrada.** As 50 variantes (25 por gênero) foram **regeradas** pelo pipeline
   de IA, com `geracaoArt` completo — `archetype: "Mermaid"`, templates de torso próprios por gênero, e
   referências novas (`reference_male_3.png`/`reference_female_3.png`). A arte de 2024 herdada do canvas
   825×1650 não foi convertida: foi substituída. É por isso que o commit da migração (`73f411a`) troca todos os
   PNGs de `assets/` por masters nativos, várias vezes maiores.

Duas correções de rumo apareceram durante a rodada e ficaram registradas nos prompts de
`assets/portraits/ssm_mermaids/ssm_mermaids.md`: a espécie deixou de ser desenhada como "guerreiro aquático" (as
primeiras referências puxavam armadura e ombreiras espinhosas sozinhas, sem ninguém pedir) e virou "gente comum
que vive debaixo d'água"; e o peito masculino sob a malha de escama precisou de um bloco inteiro de `torso.extra`
descrevendo-o como superfície contínua, porque renderizava com aparência de busto feminino.

## Rastro deixado no caminho

- `db8bb26` regenerou os `.dds` (1.367.984 → 764.528 bytes por arquivo — a queda é o canvas 825×1650 dando lugar
  ao 980×780).
- `dfc5ba8` corrigiu o `entity` de `ssm_mermaids_portrait.txt`, que ainda apontava pra `sl_humanoid_01_entity`
  depois da troca de rig. O `.txt` é gerado a partir do campo `rig`, então isso é sintoma de uma execução do
  pipeline com o estado intermediário — vale como lembrete de que trocar `rig` exige rodar `bun run portrait` de
  novo, e conferir o `.txt` gerado, não só as texturas.

## Consequência estrutural

Com a sereia migrada, **nenhuma espécie usa `sl_shared`**. O rig legado continua versionado porque
`bun run shared-rig` deriva o `ssm_shared` a partir dele e porque é a única cópia restante do mesh e das
animações do extinto Stellar Legion Mod — não porque alguma arte publicada dependa dele. O default de `rig`
omitido no schema (`RIG_PADRAO`) continua sendo `sl_shared`, mas todo `portrait.json` do repositório declara
`ssm_shared` explicitamente, então esse default hoje é um vestígio, não um comportamento em uso.
