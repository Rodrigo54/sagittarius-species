# Histórico da sessão: pipeline de geração de arte via IA (`generate-art`) e rework do `ssm_default`

Relato detalhado da sessão que criou o pipeline `bun run generate-art` — geração de retratos de espécie via
ComfyUI local, orquestrada a partir do `portrait.json` — e o usou pra reworkear a espécie humana (`ssm_default`,
25 machos + 25 fêmeas) do zero. Existe pra uma conversa nova poder retomar o trabalho (ajustar outra espécie,
depurar um problema de geração, entender por que uma configuração específica foi escolhida) sem precisar
redescobrir tudo isso por tentativa e erro de novo. Não é documentação de referência permanente do formato do
`portrait.json` (isso é o `CLAUDE.md`) — é o relato de como se chegou lá e por quê.

## Visão geral do que foi construído

- **`scripts/comfyui/ssm_species_portrait_workflow.json`** — template do workflow ComfyUI (formato API), com 27
  nodes. Base: nodes do custom node pack **ComfyUI-OOP** (`0xRavenBlack/ComfyUI-OOP`, já instalado) compõem um
  prompt estruturado por atributo (`OOPPersonNode`, `OOPHairNode`, `OOPEyesNode`, `OOPMouthNode`,
  `OOPClothingNode`, `OOPPoseNode`, `OOPStyleNode`, `OOPViewNode` → `OOPNode`). Em cima disso, a sessão adicionou:
  texto livre concatenado (`StringConcatenate` + `CLIPTextEncode` novo), remoção de fundo com canal alfa
  (`LoadBackgroundRemovalModel`/`RemoveBackground`/`InvertMask`/`JoinImageWithAlpha`), img2img via referência por
  gênero (`LoadImage` → `ImageScale` → `VAEEncode`), ControlNet OpenPose pra consistência de pose/enquadramento
  (`Inference_Core_OpenposePreprocessor` → `ControlNetLoader` → `ControlNetApplyAdvanced`) e um `LoraLoader`
  configurável.
- **`scripts/generate-art/`** — pipeline TypeScript que lê `geracaoArt` do `portrait.json`, mescla `base` +
  overrides de gênero + variante (`merge.ts`), patcheia o template (`workflow.ts`), fala com a API do ComfyUI
  (`comfyui-client.ts`: enfileirar, poll, baixar imagem, upload de referência), e escreve em staging
  (`.portraits-generated/`, fora do git). CLI: `bun run generate-art <slug> <male|female|flat>
  [--variante=NNN[,NNN,...]] [--seed=N] [--promote]`.
- **Schema `geracaoArt`** no `portrait.json` (tipos em `scripts/generate-art/oop-types.ts`): `base` (campos
  comuns), `modelo` (checkpoint/sampler/img2img/ControlNet/LoRA — ver seção "Configuração final" abaixo),
  `male`/`female`/`flat` (override de gênero + `referenceImage` + `variantes` nomeadas `"001"`..`"NNN"`, uma por
  indivíduo, contagem tem que bater exato com `counts.<gênero>`).
- **`ssm_default` reworkeada**: as 25+25 imagens legadas foram substituídas por arte gerada por esse pipeline —
  humanos em armadura sci-fi azul/dourada, estilo "3D render de jogo".

## Decisões de arquitetura (via `/questione-me`)

A entrevista estruturada resolveu, em ordem:

1. **Formato do prompt**: híbrido — campos estruturados dos nodes OOP (validados contra enums reais extraídos do
   `object_info` do ComfyUI, não inventados) + um campo `extra` de texto livre pro que os combos não cobrem
   (expressão facial, "olhando pra câmera", etc.). Puro estruturado não bastava: boa parte do exemplo dado pelo
   usuário ("serious expression", "looking at camera", "3d game art style") não tem campo correspondente em
   nenhum node OOP.
2. **Merge base→gênero→variante**: raso por seção (`{...base.hair, ...variante.hair}`), não substituição
   integral do bloco. **Exceção**: o campo `extra` começou como "último nível vence" e foi trocado no meio da
   sessão pra **concatenar** todos os níveis (ver seção "Bug: etnia African diluída" abaixo) — override integral
   exigiria duplicar o texto inteiro da `base` em toda variante que precisasse de um detalhe a mais.
3. **Variação individual**: variantes nomeadas explícitas (`"001"`..`"NNN"`), não `randomize` dos nodes (que
   sorteia sem controle entre *todas* as opções do combo) nem uma paleta pequena ciclada. Contagem de variantes
   tem que bater exato com `counts.<gênero>` — fail-fast se não bater.
4. **Revisão antes de virar asset**: staging (`.portraits-generated/`, fora do git) → revisão manual → `--promote`
   só copia se os N arquivos esperados estiverem todos presentes.
5. **Seed determinística** por `slug:gênero:variante` (FNV-1a 32-bit) — mesma variante gera sempre a mesma imagem;
   regenerar de propósito usa `--seed` explícito só naquele índice.

## Bugs encontrados e corrigidos, em ordem cronológica

### 1. Máscara de fundo invertida (personagem virava transparente, fundo ficava opaco)

Sintoma: depois de completar a cadeia `RemoveBackground` → `JoinImageWithAlpha`, o **personagem** saía
transparente e o **fundo** opaco — o oposto do esperado. Lendo o código-fonte de
`comfy_extras/nodes_compositing.py` (`JoinImageWithAlpha.execute`): o node faz `alpha = 1.0 - resize_mask(alpha,
...)` internamente — ele espera a convenção padrão de `MASK` do ComfyUI (1 = área mascarada/a remover), mas
`RemoveBackground` devolve o oposto (1 = primeiro plano/personagem, confirmado pelo `output_tooltips: ["Generated
foreground mask"]`). Corrigido inserindo um `InvertMask` (`1.0 - mask`, confirmado lendo `nodes_mask.py`) entre os
dois. Verificado pixel a pixel (`magick.exe identify`/`-format "%[pixel:p{x,y}]"`) antes de aceitar como corrigido.

### 2. Dependência Python faltando pro ControlNet OpenPose

`Inference_Core_OpenposePreprocessor` (do custom node pack ComfyUI-Inference-Core-Nodes) falhou com
`ModuleNotFoundError: No module named 'matplotlib'`. Resolvido com `pip install matplotlib` no venv específico do
ComfyUI (`D:\StabilityMatrix\Packages\ComfyUI\venv\Scripts\python.exe`, achado procurando `venv` dentro da pasta
do pacote no StabilityMatrix — `embedded_python: false` no `/system_stats` foi a pista de que existia um venv
separado).

### 3. Gênero e enquadramento não respeitados em CFG baixo

Com `cfg: 2` (herdado de um checkpoint Turbo anterior), ~40% das gerações masculinas saíam femininas mesmo com
`person.gender: "Male"` corretamente mesclado (confirmado inspecionando o `mesclarCampos` diretamente) — o
condicionamento do prompt tem pouca força em CFG baixo pra competir com o viés do checkpoint. Subir pra `cfg: 5`
resolveu os dois problemas de uma vez (o enquadramento via `MediumShot` também parou de variar aleatoriamente).

### 4. Sintaxe de embedding errada

O usuário colou um bloco de negative prompt no formato A1111/WebUI, incluindo `<embedding:EasyNegative>`. ComfyUI
usa `embedding:EasyNegative` (sem os colchetes `<>`) — corrigido antes de aplicar. Confirmado que os arquivos
(`easynegative.safetensors`, `ng_deepnegative_v1_75t.pt`) existem via `GET /models/embeddings`.

### 5. Negativo pesado demais causando artefatos

O bloco de negative prompt colado (2322 caracteres, com ênfase tripla `(((...)))` em quase tudo) causou manchas
coloridas localizadas (bochecha, ombro) que não apareciam antes. Enxugado pra 1176 caracteres: deduplicado, sem
nenhuma ênfase em parênteses. Os mesmos índices que tinham defeito saíram limpos na régeneração.

### 6. LoRA incompatível com o checkpoint (glitch no olho)

Trocar de `mahuaXLTurbo_v20` pra `pilgrimBASESDXL_v4GMG` mantendo o LoRA `PerfectEyesXL` (calibrado pro checkpoint
anterior) produziu glitch/distorção colorida perto do olho em 3 de 5 gerações. Zerar `loraStrength` (0.8 → 0)
eliminou o problema — e os olhos continuaram bons sem LoRA nenhum com esse checkpoint.

### 7. `steps` baixo demais pra checkpoint não-turbo

Depois de trocar pro `pilgrimBASESDXL` (não é um modelo destilado/turbo), `steps` continuou em 8 (valor herdado do
checkpoint Turbo anterior). Resultado: olho esquerdo/direito saindo com cor e formato diferentes entre si
(assimetria) — o modelo não "tem tempo" de convergir num rosto simétrico com tão poucos passos. Subir pra
`steps: 28` corrigiu a simetria de forma consistente (verificado com recortes ampliados dos olhos via
`magick.exe -crop`).

### 8. Etnia "African" diluída pela referência (e a mudança de arquitetura que isso causou)

O campo `person.ethnicity: "African"` estava corretamente mesclado e enviado (confirmado inspecionando
`mesclarCampos`), mas o indivíduo saía com pele clara — a referência de img2img (branca) tinha influência
suficiente em `denoise: 0.8` + ControlNet pra "puxar" o tom de pele de volta. Dois problemas revelados juntos:

- **Fix de conteúdo**: reforçar via `extra`: `"dark skin, deep brown skin tone, black skin, African facial
  features"`, aplicado nas 11 variantes com `ethnicity: "African"` (7 macho + 4 fêmea).
- **Fix de arquitetura necessário pra isso funcionar**: a regra original de merge fazia o `extra` de nível mais
  específico **substituir** o de nível menos específico — declarar esse reforço por variante teria apagado o
  `extra` da `base` (que tem "3D render", "no helmet", a descrição do traje espacial, etc.). `mesclarCampos` foi
  alterado pra **concatenar** os `extra` de todos os níveis presentes (`base`, gênero, variante) em vez de o
  último vencer. Essa mudança generaliza bem: qualquer reforço específico de indivíduo passa a ser aditivo, nunca
  destrutivo.

### 9. Peito com "bico" na armadura feminina

Bug de design de armadura (não de dado incorreto): a armadura do peito feminina saía com uma protuberância central
estilo mamilo — comum em algumas gerações de "armadura anatômica" sci-fi, mas indesejado aqui. Corrigido em duas
frentes: negativo (`nipple armor, nipple plate, chest armor bumps, protruding chest armor, anatomically shaped
breast armor, chest cups`) + reforço positivo na `base.extra` (`smooth flat chest armor plate, no protrusions on
chest armor`).

### 10. Ênfase de peso vazando pra atributos vizinhos

Ao tentar corrigir cabelo rosa + olho castanho simultaneamente num indivíduo específico (male/002) que não estava
saindo como pedido, texto solto (`"brown eyes, deep brown iris"` no `extra`) resolveu o olho mas **derrubou** o
cabelo de volta pra castanho (a palavra "brown" "vazou" pro cabelo). Trocar pra sintaxe de peso —
`"(pink hair:1.3), (brown eyes:1.3)"` (ComfyUI aceita sintaxe A1111 nativamente em `CLIPTextEncode`) — resolveu os
dois juntos, mas por sua vez desequilibrou `person.gender` o suficiente pra a armadura do peito sair no formato
feminino num personagem masculino. Precisou de mais um reforço positivo (`"flat masculine chest, male chest
armor, muscular male torso"`) pra fechar os três atributos ao mesmo tempo. Lição prática: pesos de ênfase em
atributos "fortes" (cor incomum, gênero) competem entre si e com o resto do prompt — corrigir um pode quebrar
outro, então mudanças desse tipo sempre merecem confirmação visual antes de aceitar como definitivas.

### 11. Salvamento de arquivo fora de sincronia com a geração

Duas vezes na sessão o usuário editou o `portrait.json` no editor mas a mudança não tinha sido salva ainda quando
pediu pra regerar — o script sempre lê o arquivo do zero a cada invocação (`lerConfig`), então rodou com o estado
antigo do disco. Não é bug do pipeline: é só o lembrete de sempre confirmar `grep`/`Read` do que está
*salvo* antes de gerar, principalmente quando uma run em background já está em andamento (o processo carrega o
config uma vez no início — salvar o arquivo no meio da run não afeta os índices que faltam gerar nessa mesma
execução, só invocações novas).

## Configuração final que sobreviveu a todos os testes

```jsonc
"modelo": {
  "checkpoint": "pilgrimBASESDXL_v4GMG.safetensors",
  "steps": 28,
  "cfg": 5,
  "sampler_name": "euler_ancestral",
  "scheduler": "sgm_uniform",
  "width": 832,
  "height": 1216,
  "denoise": 0.8,
  "controlNetStrength": 0.8,
  "lora": "DetailedEyes_V3.safetensors",
  "loraStrength": 0.6
}
```

- `referenceImage` de `male` e `female` apontam pros dois pro **mesmo** `reference_male.png` (testado
  explicitamente contra usar uma referência dedicada por gênero — a masculina sozinha deu resultado mais
  consistente entre os dois gêneros, então foi adotada pros dois).
- Negativo final (`node "11"` do workflow) inclui, além do básico de qualidade/anatomia: exclusão de capacete
  (`helmet, full-face helmet, visor, ...`), exclusão de logos/bandeiras reais (`NASA logo, real flag, national
  flag, ..., meatball logo`), exclusão de armadura com bico (`nipple armor, ...`), e os embeddings
  `embedding:EasyNegative`/`embedding:ng_deepnegative_v1_75t`.
- `base.extra`: `"3D render, CGI character art, stylized video game character art, digital painting, not
  photorealistic, serious expression, confident posture, looking at camera, no helmet, bare head, face fully
  visible, wearing a futuristic sci-fi space suit with metallic plating, science fiction astronaut uniform, space
  marine armor, smooth flat chest armor plate, no protrusions on chest armor"`.
- Idade de todas as 50 variantes forçada pra 20-29 (pedido do usuário, aplicado com um script determinístico que
  reamostra qualquer `person.age >= 30`).

## Coisas que NÃO estão garantidas pra próxima espécie

Nada disso é automático — foi tunado espécie a espécie, indivíduo a indivíduo, nesta sessão:

- **Nem todo atributo estruturado é respeitado igualmente.** Cor de olho e etnia (áreas pequenas do rosto)
  perdem mais fácil pra referência via img2img/ControlNet do que cor de cabelo (área grande). Reforço via
  `extra` (concatenado, não substituindo a base) é o mecanismo já disponível quando isso acontecer de novo.
- **`steps` e `cfg` dependem do checkpoint escolhido.** Um checkpoint Turbo quer poucos passos/CFG baixo; um
  checkpoint normal precisa de ~25-30 passos e CFG mais alto (~5), senão sai assimetria facial.
- **LoRA precisa ser testado contra o checkpoint específico**, não só contra a arquitetura (SD1.5 vs. SDXL) — o
  `DetailedEyes_V3` (nominalmente SD1.5) funcionou bem com `pilgrimBASESDXL`; o `PerfectEyesXL` (SDXL de verdade)
  deu glitch. Testar com 5 imagens antes de rodar o lote inteiro é o fluxo que pegou isso.
- **Bandeiras/logos reais (NASA, bandeiras nacionais) ainda podem vazar** mesmo com o negativo reforçado — é
  variação rara, não eliminada por completo.

## Ferramental de diagnóstico usado (reutilizável)

- `magick.exe identify -verbose <png> | grep -A5 "Alpha:"` — estatística do canal alfa (confirmar remoção de
  fundo).
- `magick.exe <png> -format "%[pixel:p{x,y}]" info:` — valor de pixel específico (confirmar transparência em
  canto vs. opacidade no centro, ponto a ponto).
- `magick.exe <png> -crop WxH+X+Y +repage -resize W2xH2 saida.png` — recorte + ampliação (usado repetidamente pra
  inspecionar olhos de perto, onde defeitos pequenos não aparecem na miniatura).
- `bun -e 'import(...).then(...)'` rodando `mesclarCampos`/`validarGeracaoArt` direto — pra confirmar, antes de
  gastar GPU, exatamente o que o pipeline vai enviar pro ComfyUI (separou bug de dado de bug de geração/modelo
  várias vezes nesta sessão).
