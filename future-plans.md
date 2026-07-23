# Ideias futuras para o pipeline de retratos

Notas de uma conversa exploratória sobre possíveis melhorias no fluxo de arte/animação de retratos deste mod.
Nada aqui está implementado nem decidido como próximo passo — é um registro do que foi discutido, pra não perder o
raciocínio.

## Geração de arte com ComfyUI + ControlNet

Ideia: usar StabilityMatrix rodando ComfyUI, com uma pose travada via ControlNet, pra gerar os PNGs de cada
espécie, e seguir dali com o fluxo já existente do repositório (`assets/portraits/ssm_<espécie>/...` →
`bun run portrait`, veja `CLAUDE.md`).

Isso faz sentido e não tem impedimento — é até necessário, não só desejável: como `sl_humanoid_01_entity` (veja
`portraits.md`) é um rig compartilhado que deforma uma textura só (não texturas por parte do corpo), travar a pose
via ControlNet garante que as variações geradas fiquem na mesma pose de repouso que o rig espera, evitando que a
animação (idle/sad) deforme a arte de um jeito estranho por causa de poses inconsistentes entre as variações.

## Animações novas no rig compartilhado (ex.: respiração)

Pra criar uma animação nova (tipo um loop sutil de respiração) sem depender do Maya:

1. Instalar o addon **`io_pdx_mesh`** no Blender (alternativa comunitária ao PDX Exporter do Maya, também usada
   por outros jogos na Clausewitz Engine).
2. Importar `sl_shared/humanoid_01_portrait.mesh` de volta no Blender (só existe o `.mesh` já compilado — não a
   cena original de quem criou o extinto Stellar Legion Mod).
3. Criar uma Action nova: keyframes de leve escala/rotação num joint do tronco (`spine_1`), em loop fechado
   (primeiro e último frame idênticos).
4. Exportar como `.anim` novo via `io_pdx_mesh`, e registrar como `state` novo no `.asset`/`.gfx` (mesmo mecanismo
   documentado em `portraits.md`, seção "A técnica usada aqui").
5. Testar no jogo.

O papel de um LLM aqui é escrever o script Python (`bpy`) que gera os keyframes de forma determinística — não
executar o Blender nem validar visualmente o resultado.

> **Atualização (2026-07-23)**: existe agora um guia completo e atualizado que vai além deste esboço —
> `ssm-shared-animacao-do-zero.md` na raiz do repo cobre construir um **rig inteiro do zero** (mesh plano
> autoral, esqueleto enxuto com ossos por região, skinning localizado e clipes `.anim` paramétricos), com o
> contrato fixo do jogo (câmera/shader/registro), o fluxo de export/validação via `io_pdx_mesh` + scanner
> binário, e as armadilhas já conhecidas. O esboço acima fica como registro; o guia é a fonte atual.

## Corrigir o desperdício de UV do `sl_humanoid_01_entity` — feito

Implementado: veja a seção "`sl_shared` vs. `ssm_shared`" do `CLAUDE.md`. Resumo do que foi decidido, contra o que
estava especulado aqui: o caminho escolhido foi o da "entity irmã" (isola o impacto, `sl_shared/` nunca foi
tocado), mas com dois ajustes em relação ao que este documento imaginava —

- A correção **não** ficou restrita a "reescalar o UV island que já existia": o mesh foi reduzido a um único
  plano (`pPlaneShape6` — os outros 5 são removidos do binário, ver a seção do `CLAUDE.md` pro porquê), e a UV
  desse plano deixou de ter a divisão frente/trás (metade do canvas), unificada numa única região cobrindo o
  canvas inteiro. O canvas em si também mudou, de 825×1650 pra **980×976** — proporção calculada pra bater com o
  bounding box real do plano mantido (a UV é projeção planar quase linear da posição do vértice), na mesma
  densidade de pixel da textura vanilla equivalente (`human_female_body_01.dds`, 420×512). Cogitamos usar
  840×1024 (a proporção vanilla direto), mas o mesh deste mod não tem a mesma proporção do mesh vanilla — teria
  esticado a arte ~28%. Editar a geometria do mesh pra forçar 840×1024 foi descartado: exigiria escala não uniforme
  sobre uma malha com esqueleto de ~40 ossos, arriscando cisalhar as animações sem uma forma barata de validar.
- A edição do `.mesh` **não** precisou ser manual no Blender — `scripts/generate-shared-rig/mesh-uv.ts` faz um
  patch binário determinístico e testado (`mesh-uv.test.ts`), porque a transformação (reescalar o array `u0` de
  cada plano) acabou sendo puramente geométrica, sem nenhum julgamento visual envolvido. O Blender/BlenderMCP
  entrou só depois, pra conferência visual (textura xadrez aplicada aos 6 planos, screenshot da viewport) — não
  pra fazer a edição em si.

**Histórico de bugs (todos resolvidos)**: unificar a UV com os 6 planos ainda presentes criava um
"fantasma"/gêmeo atrás do personagem (as 6 camadas de profundidade do relevo 2.5D passavam a exibir o retrato
inteiro cada uma) — resolvido mantendo um único plano no mesh (`removerPlanosOcultos` em `mesh-uv.ts`). A escolha
de *qual* plano manter passou por três iterações, porque cada camada difere em skinning, shader e geometria:
`pPlaneShape2` distorcia a arte na animação (83% do peso de skinning na cadeia do braço direito), `pPlaneShape6`
era camada de cabelo (shader não renderiza arte comum — quadro vazio) e ficava fundo/curvado (corte curvo
transparente na cintura). O plano final é o **`pPlaneShape4`**: camada de corpo, praticamente plano, na origem,
strain de aresta 10.1% máx / 0.3% mediana. Ver `ssm-shared-historico-da-sessao.md` na raiz do repo pro relato
completo de todas as tentativas e diagnósticos.

## `ssm_test_rig` — espécie de teste do rig novo

`assets/portraits/ssm_test_rig/` (`portrait.json` com `"rig": "ssm_shared"`) foi criada pra testar o `ssm_shared` de
ponta a ponta, incluindo abrir o jogo de verdade — foi assim que o bug do "fantasma" acima foi encontrado (e,
temporariamente, os bugs das tentativas de correção — ver `ssm-shared-historico-da-sessao.md`). `001.png` é um
placeholder xadrez com marcadores de canto coloridos (flagra flip/rotação/distorção de longe); `002.png` é arte
real pintada pelo Rodrigo (usada pra testar em condição realista, não só num xadrez sintético).
Registrada em `ssm_species_classes.txt` (`ssm_sagittarius`) e `ssm_portrait_sets.txt` (`ssm_humanoids`). Não é uma
espécie real do mod — remover antes de publicar uma release. O mesmo vale pras cópias de comparação
`ssm_old_<espécie>` criadas por `scripts/migrate-portraits/` (ver `CLAUDE.md`): acumulam durante a migração de rig
pra comparação in-game e são varridas todas de uma vez na preparação de release (assets + registros nos dois `.txt`
+ pasta de DDS e `ssm_old_<espécie>_portrait.txt` no `mod/` — o pipeline **não** limpa pastas de espécie órfãs no
`mod/`, a varredura é manual).

## BlenderMCP — configurado, com ressalvas de compatibilidade

[`ahujasid/blender-mcp`](https://github.com/ahujasid/blender-mcp) está configurado nesta máquina (`claude mcp
list` mostra `blender: uvx blender-mcp — Connected`) e foi usado na tarefa acima pra validar visualmente a UV
corrigida via `execute_blender_code`/`get_viewport_screenshot`.

Ressalva encontrada: o addon `io_pdx_mesh` (necessário pra importar/exportar `.mesh` dentro do Blender) estava
instalado mas **não carregava** no Blender 5.2 local (Python 3.13) — usa `from imp import reload`, módulo `imp`
removido no Python 3.12+. Precisou de patch manual no arquivo real do addon (fora deste repositório: instalação
via Microsoft Store/MSIX vive virtualizada em
`%LOCALAPPDATA%\Packages\BlenderFoundation.Blender_ppwjx1n5r4v9t\LocalCache\Roaming\Blender Foundation\Blender\...`,
não no `%APPDATA%` literal). Depois desse patch, a importação de mesh funcionou, mas o sistema de **material/shader**
do addon (não usado pra validar a UV, só apareceria se fosse exportar/gerar material novo) tem várias
incompatibilidades adicionais com APIs removidas no Blender 4.x+ (`use_auto_smooth`, `shadow_method`,
`ShaderNodeSeparateRGB`) — não vale a pena persegui-las até que exportar/criar material vire necessário de
verdade; contornado por enquanto monkeypatching `create_material` pra no-op e aplicando uma textura de teste
própria (UV grid) direto via `bpy`.
