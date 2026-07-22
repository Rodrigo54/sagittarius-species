# Configuração do cwtools neste repositório

Este documento explica **por que** a validação do cwtools-vscode está configurada do jeito que está neste
repositório — não é a documentação genérica da ferramenta (essa vive na
[wiki oficial](https://github.com/cwtools/cwtools-vscode/wiki)).

## O problema: a raiz do mod não é a raiz do repo

A extensão [`tboby.cwtools-vscode`](https://marketplace.visualstudio.com/items?itemName=tboby.cwtools-vscode)
exige que a pasta aberta no VS Code **seja, ela mesma, a raiz do mod** — o lugar onde fica `descriptor.mod` (veja
["Multiple mods - workspace"](https://github.com/cwtools/cwtools-vscode#multiple-mods---workspace) no README da
extensão).

Neste repositório, porém, o mod fica em `mod/sagittarius-species/`, não na raiz — a raiz também guarda
`scripts/`, `assets/`, `testmod/`, etc. Abrir a raiz do repo direto no VS Code faz o cwtools não reconhecer
`mod/sagittarius-species/` como um mod válido, então a validação simplesmente **não roda** lá dentro (sem erros,
sem autocomplete, sem nada).

## A solução: workspace multi-root

Use o arquivo **`sagittarius-species.code-workspace`** na raiz do repo em vez de abrir a pasta diretamente
(`File > Open Workspace from File...` no VS Code). Ele declara duas pastas-raiz:

1. a raiz do repo (scripts, assets, documentação);
2. `mod/sagittarius-species/` — é essa que o cwtools reconhece como raiz do mod e passa a validar de verdade.

Isso segue o padrão de ["multi-root workspace"](https://code.visualstudio.com/docs/editing/workspaces/workspaces)
do próprio VS Code, que é a forma oficialmente recomendada pela extensão de lidar com mais de uma raiz de mod (ou,
como aqui, uma raiz de mod que não coincide com a raiz do repositório).

### Onde o cache de regras/dados vanilla realmente fica

Ao contrário do que a documentação genérica sugere para regras customizadas manuais, o cache **automático** usado
por `cwtools.rules_version = "latest"`/`"stable"` não fica dentro do workspace — ele fica dentro da própria
instalação da extensão: `~/.vscode/extensions/tboby.cwtools-vscode-<versão>/.cwtools/<jogo>/`, incluindo um
arquivo binário grande (`stl.cwb` para Stellaris, várias centenas de MB) com os dados vanilla já processados. Uma
pasta `.cwtools/` dentro do workspace só é usada se você mesmo criar uma, manualmente, para sobrepor regras
específicas (o caso "custom .cwt files" da wiki) — não é algo que precise existir aqui.

Na primeira vez que `mod/sagittarius-species/` carrega como pasta-raiz do workspace (ou depois de atualizar a
instalação do Stellaris), a extensão sobe um processo separado — visível no Gerenciador de Tarefas como
**"CWTools Server"** — que processa toda a instalação vanilla apontada por `cwtools.cache.stellaris` e monta esse
cache. Para o Stellaris isso é pesado (chegou a ficar ~30 minutos rodando, ~3,8 GB de RAM, na primeira vez que
testamos): é esperado, não é travamento. Os logs desse processo aparecem no painel **Output** do VS Code, no canal
**"Paradox Language Services"** (não "CWTools" — esse é só o nome de exibição da extensão na Marketplace).

## Por que as configurações do cwtools ficam no `.code-workspace`, não num `.vscode/settings.json`

Todas as chaves `cwtools.*` relevantes aqui (`errors.ignorefiles`, `ignore_patterns`, `rules_version`,
`localisation.languages`) são `"scope": "window"` no manifesto da extensão — conferido diretamente no
`package.json` instalado em `~/.vscode/extensions/tboby.cwtools-vscode-*`. Configuração `window`-scoped **não**
pode ser definida no `.vscode/settings.json` de uma pasta específica dentro de um workspace multi-root (o VS Code
ignora silenciosamente); só tem efeito nas configurações globais de usuário ou no bloco `"settings"` do próprio
`.code-workspace`. Como essas chaves são específicas deste projeto, ficam no `.code-workspace` — assim qualquer
colaborador que abrir esse arquivo já herda a configuração certa, sem precisar mexer nas próprias configs globais.

`cwtools.cache.stellaris` (o caminho da instalação vanilla do Stellaris) é diferente: tem `"scope": "application"`,
é específico de cada máquina, e por isso fica nas configurações globais de usuário — não no repositório.

## O que cada configuração faz

- **`cwtools.ignore_patterns`** inclui `testmod/**` — essa pasta guarda arquivos `.txt` de outros mods usados só
  para inspeção pontual (veja a seção "Pipeline de listas de nomes" do `CLAUDE.md`), não faz parte do mod
  publicado, e não deve ser validada como se fosse.
- **`cwtools.rules_version`** fica em `"latest"` (decisão consciente, não um pin manual) — significa que as
  regras de validação (`.cwtools/`) atualizam sozinhas a cada commit novo do
  [`cwtools-stellaris-config`](https://github.com/cwtools/cwtools-stellaris-config), então podem mudar sem aviso.
  Diferente do `bin/` (veja `CLAUDE.md`), que pina versões manualmente para reprodutibilidade, aqui optou-se por
  ficar sempre atualizado.
- **`cwtools.localisation.languages`** inclui `"Braz_Por"` além do `"English"` padrão da extensão — porque
  português do Brasil é o idioma fonte-da-verdade deste repositório (veja `CLAUDE.md`), é dali que
  `scripts/name-lists.ts` gera o `.txt` em Clausewitz. Validar só em inglês (o padrão da extensão) deixaria passar
  problema de localização justamente no idioma onde o conteúdo nasce.

## Cópia para a pasta local de mods (`bun run copy` / `overwrite`)

Os scripts `scripts/copy.ps1`, `scripts/overwrite.ps1` e os equivalentes bash
(`scripts/copy-latest-to-local-mod.sh`, `scripts/overwrite-local-mod-with-latest.sh`) excluem explicitamente
`.cwtools/` da cópia para `Documents\Paradox Interactive\Stellaris\mod\`. Isso é uma precaução, não uma correção
de um problema atual: o cache automático de regras **não** vive dentro de `mod/sagittarius-species/` (veja a seção
acima), então normalmente não há nada ali para excluir. A exclusão só importa se alguém, no futuro, criar uma
pasta `.cwtools/` manual dentro da pasta do mod para sobrepor regras (uso legítimo documentado pela extensão) — aí
sim, sem essa exclusão, ela iria parar na pasta de mods locais e, por consequência, arriscar ir para o Steam
Workshop na hora de publicar.
