# Histórico da sessão: migração do `geracaoArt` pra um schema próprio (abolindo o `ComfyUI-OOP`)

Relato da sessão que substituiu a dependência do custom node pack `ComfyUI-OOP` (`0xRavenBlack/ComfyUI-OOP`) por
composição de prompt inteiramente em TypeScript, e desenhou um schema `zod` próprio pra `portrait.json`. Iniciada
durante o trabalho de configurar `geracaoArt` pro `ssm_astral` (ver `generate-art-historico-da-sessao.md` pro
histórico anterior, da sessão que criou o pipeline original baseado em ComfyUI-OOP). Continua sendo o relato de
uma sessão, não referência de formato — isso é `CLAUDE.md`.

## Motivação

Durante o trabalho de `ssm_astral`, o mesmo sintoma apareceu repetidas vezes: um atributo pedido explicitamente no
prompt (cobertura de tronco, etnia, olhos) não era respeitado, e o conserto (reordenar texto, adicionar peso
`(:1.3)`) empurrava o problema pra outro atributo em vez de resolver — "o que fica por último numa string gigante
perde". Investigando a causa raiz: os nodes do `ComfyUI-OOP` (`OOPStyleNode`, `OOPViewNode`, `OOPHairNode`,
`OOPEyesNode`, `OOPMouthNode`, `OOPClothingNode`, `OOPPoseNode`, `OOPPersonNode`, `OOPNode`) faziam **só** tradução
de enum pra texto em inglês + concatenação — nenhuma mágica de conditioning. Isso tornou a decisão simples: dá pra
fazer essa mesma tradução em TypeScript, com controle total de ordem/peso, e ainda resolver dois gaps que o
`ComfyUI-OOP` nunca teve: vocabulário de roupa (só tinha roupa civil, `Jacket`/`TShirt`/`Coat`, nada de
armadura/escama) e negativo por espécie (o negativo era 100% fixo no template, sem campo em `portrait.json` pra
customizar).

## Decisões de arquitetura (via `/questione-me`)

1. **Substituição total, não cirúrgica** — os 9 nodes saem todos, mesmo os que não tinham dado problema
   (`hair`/`eyes`/`person`/`pose`/`style`/`view`), pra não manter dois mecanismos de composição coexistindo.
2. **Migração de ambas as espécies (`ssm_default` e `ssm_astral`) na mesma sessão** — só existiam 2 espécies
   usando o pipeline, manter os dois formatos em paralelo custaria mais que migrar os dois de uma vez.
3. **Schema novo, campo por campo:**
   - **`tipo: { value, description? }`** (novo) — arquétipo visual (`Human`, `Elf`, `Mermaid`, `Necroid`,
     `Furry`, `Molluscoid`, `Eldritch`, `Robot`, `Avian`, `Alien`, `Cyborg`), sem relação com `species_class` do
     jogo. `value` é categoria ampla e reaproveitável (`Human` cobre `ssm_default`, `ssm_knight`, `ssm_astral`,
     `ssm_mercenary` — visualmente bem diferentes); `description` diferencia o sabor dentro do mesmo `value`
     (`ssm_timbot` = "cute Pixar-style robot" vs. `ssm_new_order` = "war machine aesthetic", os dois `Robot`) ou
     detalha um arquétipo raro/não-recorrente (`Mermaid`, `Eldritch`). Tratado como âncora: peso automático,
     emitido cedo.
   - **`torso: { description?, state? }`** (novo, substitui `clothing`) — `description` é texto livre
     (armadura/escama/pele nua/pelagem, o que fizer sentido); `state` (`Bare`, `FullyCovered`,
     `ArmsCoveredTorsoBare`, `TorsoCoveredArmsBare`, `PartiallyCovered`) é o campo estruturado que faltava — foi
     exatamente a falta dele que causou o bug mais recorrente da sessão anterior (ver "Bug recorrente" abaixo).
     Neutro: nenhum estado é "melhor", `ssm_mermaids` com escama à mostra é tão correto quanto `ssm_astral` com
     armadura completa.
   - **`extra_prompt: { positive?, negative? }`** (substitui `extra: string`) — ganhou o lado negativo, que antes
     não existia por espécie.
   - **`person`/`hair`/`eyes`** — mesma forma de antes, vocabulário portado como cópia estática de
     `oop-types.ts` (não mais extraído ao vivo do `object_info` do ComfyUI).
   - **`pose`/`view`/`style`/`mouth` removidos como campo por espécie** — travados globalmente em
     `scripts/generate-art/base.json`, pra sempre bater com o rig `ssm_shared` (resolve de vez o corte de
     braço/cabeça que a sessão de `ssm_astral` caçou por várias rodadas).
4. **Schema cobre o `portrait.json` inteiro** (não só `geracaoArt`) — inclui os campos que `generate-portraits`
   também usa (`name`/`gendered`/`rig`/`counts`/`modo`/`ancora`), substituindo a validação manual dos dois
   pipelines por uma fonte de verdade só.
5. **`zod` (não `ajv`)** — schema TS com tipos inferidos automaticamente (`z.infer`), preferido sobre JSON Schema
   escrito à mão porque o `.json` gerado (`z.toJSONSchema()`, nativo do zod v4) é artefato derivado, não fonte de
   verdade duplicada.
6. **Composição sem orçamento de token** — ordem fixa e determinística resolve o problema ("o que fica por
   último perde"), sem precisar estimar tokenização BPE real do CLIP.
7. **`--export-prompt`** (novo) — monta e imprime o prompt sem enfileirar no ComfyUI, ciclo de debug instantâneo.

## O que foi construído

- **`scripts/portrait-schema/`** (pasta nova, compartilhada entre `generate-art` e `generate-portraits`):
  `vocabulario.ts` (enums estáticos + `TIPOS`/`ESTADOS_TORSO` novos), `schema.ts` (schema `zod` completo do
  `portrait.json`, `.strict()` em todo objeto, `.superRefine()` conferindo `variantes` batendo com `counts`),
  `index.ts` (barrel), `gerar-json-schema.ts` (gera `portrait.schema.json` via `z.toJSONSchema()`,
  `portrait.schema.json` associado em `.vscode/settings.json` pra autocomplete).
- **`scripts/generate-art/base.json`** + **`base.ts`** — valores fixos/globais (style/view/pose/expressão
  travados, negativo compartilhado), com schema `zod` próprio validando na carga.
- **`scripts/generate-art/prompt-builder.ts`** — o composer: `montarPrompts(campos, baseFixo)` → `{ positive,
  negative }`. Ordem: estilo fixo → âncoras com peso `1.3` (`tipo`, `torso.state`, `eyes.color`) → estruturado
  (pessoa/cabelo/olhos/torso.description) → pose/expressão/enquadramento fixos → `extra_prompt.positive` por
  último. Negativo: baseline fixo + `extra_prompt.negative`.
- **`scripts/comfyui/ssm_species_portrait_workflow.json`** simplificado de 27 pra 17 nodes — os 9 OOP +
  `StringConcatenate` saíram; os dois `CLIPTextEncode` recebem texto pronto injetado por `workflow.ts`.
- **`generate-art/merge.ts`** reescrito — `extra_prompt.positive`/`.negative` concatenam independentemente;
  `tipo` troca por inteiro (não mescla campo a campo, ver "Bug do merge de tipo" abaixo).
- **`generate-art/validation.ts` e `oop-types.ts` removidos** — redundantes com o schema `zod`.
- **`generate-portraits/discovery.ts`** (`lerConfig`) — ponto de carga único dos dois pipelines, valida via
  `zPortraitConfig.safeParse` e lança erro descritivo se malformado.
- **Testes Bun**: `merge.test.ts` (7 testes) e `prompt-builder.test.ts` (8 testes) — pegaram 2 bugs reais antes
  de considerar pronto (ver abaixo).
- **`ssm_default` e `ssm_astral` migradas** — 100 variantes no total, validadas e conferidas via
  `--export-prompt`.

## Bugs encontrados e corrigidos, em ordem cronológica

### 1. `zod-to-json-schema` incompatível com zod v4

O pacote de terceiro `zod-to-json-schema` (instalado inicialmente pra gerar o JSON Schema) devolveu um schema
**vazio** (`{}`) pra um schema `zod` v4 de teste, silenciosamente, sem lançar erro. Descoberto testando antes de
construir o schema inteiro em cima. zod v4 tem suporte nativo (`z.toJSONSchema()`), melhor e sem dependência
extra — `zod-to-json-schema` foi removido.

### 2. zod descarta chave desconhecida em silêncio

Testado contra os `portrait.json` reais de `ssm_default`/`ssm_astral` (ainda no schema antigo, antes da
migração): a validação "passava", mas o `geracaoArt.base` inteiro vinha vazio (`{}` pra `ssm_default`) — zod, por
padrão, ignora chave desconhecida em vez de dar erro (`pose`/`view`/`style`/`clothing`/`extra` não existem mais
no schema novo, então sumiam sem aviso). Corrigido aplicando `.strict()` em todo objeto do schema — chave
desconhecida virou erro claro, apontando exatamente o que não existe mais.

### 3. `main()` de `generate-portraits` sem try/catch em volta da carga

`lerConfig` (agora lançando exceção em JSON malformado) era chamado via `Promise.all` pras 18 espécies **antes**
da etapa que agrega e reporta erros juntos — uma espécie com erro de forma faria o processo inteiro crashar com
stack trace, quebrando o padrão "valida tudo, reporta tudo de uma vez, nada é escrito" documentado no
`CLAUDE.md`. Corrigido envolvendo a carga por espécie em try/catch e mesclando os erros de carga com os erros de
arquivo (`validarEspecie`) antes do relatório final.

### 4. Merge de `tipo` mesclando campo a campo por engano

Pego pelo teste `merge.test.ts`, não em produção: `mesclarTipo` chamava a mesma função `Object.assign` usada pros
outros campos (`person`/`hair`/`eyes`/`torso`), mas o comentário ao lado dizia explicitamente que `tipo` deveria
trocar **por inteiro** (não mesclar `value`/`description` de níveis diferentes — os dois são acoplados, uma
`description` escrita pra "Human, mystical..." não sobrevive bem a um `value` trocado pra "Robot"). Implementação
não batia com a intenção documentada; corrigido pra pegar o último bloco inteiro, não mesclar campo a campo.

### 5. Comentário JSDoc fechando o bloco sem querer

`prompt-builder.test.ts` não compilava: um comentário continha a sequência literal `*/` no meio do texto em
português (`"só a *forma*/comportamento..."`), fechando o bloco `/** */` no meio da frase. Corrigido reformulando
o texto pra não ter asterisco-espaço-barra adjacentes.

## Bug recorrente que motivou a migração (referência)

Documentado em detalhe na sessão de `ssm_astral` (não repetido aqui por extenso): cobertura de tronco ("barriga
de fora") continuou sendo ignorada mesmo depois de reforço textual com peso, reordenação, e troca de LoRA/
checkpoint — cada ajuste resolvia um sintoma e revelava o próximo (torso → depois etnia, quando o reforço de
torso ganhou prioridade e "empurrou" a etnia pro fim da string). A causa raiz nunca foi um valor de peso errado:
era a ausência de um campo estruturado dedicado pra cobertura de tronco, que hoje é `torso.state`.

## Bug pós-migração: negação dentro do prompt positivo (`ssm_astral`)

Depois da migração, ao ajustar `ssm_astral` pra um checkpoint novo, dois problemas persistiram através de várias
trocas de checkpoint/LoRA/denoise: o cristal do peito continuava saindo redondo (não estrela) e os machos saíam
andróginos, mesmo com âncora de peso dedicada pros dois. A causa raiz **não era o modelo** — era o próprio texto
do prompt: `torso.description` tinha `"not a circular orb, not a round gem, not concentric rings"` e
`male.extra_prompt.positive` tinha `"...not feminine"`, os dois no lado **positivo**. CLIP/modelos de difusão não
processam negação como semântica de exclusão — um substantivo mencionado no positivo, mesmo prefixado por "not"/
"no", ainda funciona como sinal pro conceito, competindo com (ou até reforçando) o que se queria evitar. É
antipadrão conhecido de prompt engineering: negação/exclusão sempre vai no prompt **negativo**, nunca no
positivo. Corrigido removendo as duas frases negadas do positivo (reescritas em linguagem só afirmativa) e
movendo o conteúdo excluído pro `extra_prompt.negative` correspondente — o resultado melhorou sem trocar checkpoint
de novo, confirmando que boa parte do "viés do checkpoint" suspeitado nas rodadas anteriores era, na verdade,
prompt mal construído.

## Coisas que continuam não garantidas pra próxima espécie

Mesma ressalva do histórico anterior, ainda válida:

- Nem todo atributo estruturado é respeitado igualmente — área pequena do rosto e cobertura de tronco perdem
  mais fácil pra referência/viés do checkpoint. O peso automático em `tipo`/`torso.state`/`eyes.color` ajuda, mas
  não é garantia — checkpoints de estilo "2D"/anime têm viés forte pra tropos (tronco nu em armadura) que texto
  sozinho briga mal contra.
- `steps`/`cfg` dependem do checkpoint (Turbo vs. normal).
- LoRA de reforço de olho pode brigar com um pedido de "sem pupila visível" — testado e confirmado durante o
  trabalho de `ssm_astral`.
