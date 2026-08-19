# Pipeline de portraits: da arte-fonte ao mod, e a mecânica por trás

Como o retrato de uma espécie é conectado através dos arquivos do mod, como `bun run portrait` sincroniza
`assets/portraits/` com `mod/`, e a mecânica **vanilla** do sistema de retratos do Stellaris por trás disso
tudo (filtrada pro que é relevante aqui — não é documentação genérica de modding, essa vive na
[wiki oficial](https://stellaris.paradoxwikis.com/Portrait_modding)). Pra anatomia do rig compartilhado
(mesh/UV/enquadramento), veja `docs/rig.md`.

## Modelo de dados: como um retrato de espécie é conectado

O sistema de espécies/retratos da Paradox é uma cadeia de arquivos que se referenciam entre si. Dentro de
`mod/sagittarius-species/`, **todos são gerados** — adicionar uma espécie é criar a pasta em
`assets/portraits/` com o `portrait.json` e rodar os pipelines:

1. **`common/portrait_sets/ssm_portrait_sets.txt`** — mapeia uma `species_class` (`HUM`, `MAM`, `MOL`, `AVI`,
   `REP`, `INF`, `MACHINE`, ...) para as entradas de retrato individuais (ex.: `ssm_elves`, `ssm_cyborg`) que
   estão dentro dela, com as condições de DLC de cada uma. É o registro que de fato faz um retrato existir no
   jogo. **Gerado** por `scripts/generate-taxonomy/` — veja `docs/pipeline-taxonomy.md`.
2. **`common/portrait_categories/ssm_portrait_categories.txt`** — mapeia uma categoria (a aba do editor de
   império: `sagittarius`, `humanoids`, `machines`) para os `portrait_sets` que ela exibe. **Gerado** pelo mesmo
   pipeline.
3. **`gfx/portraits/portraits/ssm_<species>_portrait.txt`** (um arquivo por espécie) — define as entidades de
   retrato (macho/fêmea, ou uma única entidade pras espécies sem gênero), referenciando
   texturas em `gfx/models/portraits/ssm_<species>/...`, além das regras de `portrait_groups` que definem qual
   retrato aparece em qual gênero/contexto. **Gerado automaticamente** por `scripts/generate-portraits/` a
   partir do `portrait.json` e dos PNGs de `assets/portraits/ssm_<species>/` — não edite esse `.txt`
   manualmente, edite o `portrait.json` e/ou os PNGs de origem e rode `bun run portrait` de novo.
4. **`gfx/models/portraits/ssm_<species>/<gênero>/NNN.dds`** — as texturas convertidas de fato, sempre sob a
   pasta do gênero a que pertencem: `male/` e `female/` numa espécie com gênero, `genderless/` numa espécie sem
   (veja "Como o gerador funciona" abaixo).

Todos os identificadores dentro do mod, **incluindo as pastas de arte-fonte em `assets/portraits/`**, usam o
prefixo `ssm_` (Sagittarius Species Mod) para evitar colisão com outros mods do Stellaris — o prefixo antigo
`gsm_` foi descontinuado e todas as pastas de espécie já foram renomeadas para `ssm_`, eliminando a troca manual
de prefixo que existia antes entre arte-fonte e mod publicado.

## Como o gerador funciona: `assets/portraits/` → `mod/` sempre em sincronia

`scripts/generate-portraits/` (comando `bun run portrait`) mantém tanto as texturas quanto o
`ssm_<espécie>_portrait.txt` de cada espécie sempre espelhando exatamente o que existe em
`assets/portraits/ssm_<espécie>/`, toda vez que roda:

1. Cada pasta `assets/portraits/ssm_<espécie>/` tem um **`portrait.json` obrigatório**:
   `{ "name": "<espécie sem prefixo>", "rig"?: "sl_shared" | "ssm_shared", "modo"?: "largura"
   | "altura", "ancora"?: "conteudo" | "cabeca", "species_classes": [...], "categories": [...],
   "counts": { "male", "female" } | { "genderless" } }`. `species_classes`/`categories` são a filiação da espécie — o que
   ela é no jogo e em que abas aparece; quem consome é o `generate-taxonomy` (veja
   `docs/pipeline-taxonomy.md`). Espécies
   **`counts` é a fonte única dos gêneros da espécie**: as chaves declaradas dizem se ela tem gênero
   (`male` + `female`) ou não (`genderless`), e são exatamente os nomes das subpastas onde os PNGs `NNN.png`
   vivem — `assets/portraits/ssm_<espécie>/<gênero>/`. Não há campo booleano separado dizendo isso, e as duas
   formas de `counts` são mutuamente exclusivas (nunca as duas juntas, nunca um gênero sozinho). O arquivo é a
   fonte de verdade declarada — não é inferido a partir da contagem real de arquivos. `rig` omitido = `"sl_shared"`; `modo` omitido = `"largura"` e
   `ancora` omitida = `"conteudo"` (as duas só fazem sentido em rig com guia, veja abaixo).
2. **Dois contratos de arte, um por rig** (`RIGS` em `scripts/generate-portraits/types.ts`):
   - **`ssm_shared` — master + enquadramento derivado.** `assets/` guarda a arte **nativa**, em qualquer
     resolução, trimada no bounding box de conteúdo — não existe canvas/template fixo pra pintar em cima, o
     enquadramento é derivado, não desenhado. O enquadramento (trim → resize → composição no canvas do rig)
     roda a cada `bun run portrait`, em `framing.ts`, escrevendo em `.portraits-framed/` (fora do git — é o
     enquadramento final em PNG, conferível a olho sem abrir um DDS). O guia é expresso em **fração do canvas**,
     o que torna o canvas do rig uma constante trocável sem recalibrar nada. `modo` escolhe entre escalar pela
     largura do guia (padrão) ou pela altura mínima (`altura`) — veja "Escolher o `modo`" abaixo. `ancora`
     escolhe o que encosta no topo do guia: o bounding box da arte (padrão) ou a **cabeça**
     (`"ancora": "cabeca"`). Rationale completo e candidatas por espécie: `docs/rig.md`.
   - **`sl_shared` — legado, sem nenhuma espécie hoje.** O PNG em `assets/` já vem enquadrado e é usado como
     está, exigindo o canvas exato do rig (825×1650) — cópia byte a byte pro staging. O contrato continua
     implementado e é o que `rig` omitido resolve por padrão (`RIG_PADRAO` em
     `scripts/generate-portraits/types.ts`), mas todo `portrait.json` do repositório declara `ssm_shared`
     explicitamente.
3. **Validação antes de qualquer escrita ou remoção** (mesmo padrão de `scripts/generate-names/`): confere que
   `name` bate com o nome da pasta, que a contagem declarada em `counts` bate exatamente com os PNGs
   encontrados, que os arquivos são `001.png`..`NNN.png` sequenciais e zero-padded a 3 dígitos, sem buracos, e —
   conforme o contrato do rig — ou que o PNG tem o canvas exato (legado), ou que o master tem canal alfa e a
   geometria calculada cabe no canvas (`ssm_shared`). Qualquer divergência é erro — nada é escrito nem apagado
   se houver um erro em qualquer espécie.
4. Só depois de validado tudo: para cada espécie, qualquer `.dds` já existente em
   `mod/sagittarius-species/gfx/models/portraits/ssm_<espécie>/` que não corresponda a um PNG de origem é
   **apagado** (limpeza total, sem exceção — histórico: essa decisão já removeu deliberadamente texturas órfãs
   sem PNG de origem que estavam publicadas, como `ssm_cyborg/013.dds`). Depois disso, a arte é enquadrada e
   convertida via `converter.ts`, e o `ssm_<espécie>_portrait.txt` inteiro é regenerado a partir do zero. Essa
   limpeza é só de arquivo dentro da pasta de uma espécie que continua existindo — o pipeline **não** limpa
   pastas de espécie inteiras que ficaram órfãs: se uma espécie for removida de `assets/portraits/`, a pasta
   dela em `mod/.../gfx/models/portraits/` e o `ssm_<espécie>_portrait.txt` correspondente precisam ser
   apagados à mão.
5. O template do `.txt` gerado é 100% derivado dos gêneros declarados em `counts` e da contagem de
   arquivos — `clothes_selector`, `attachment_selector` e `custom_attachment_label` são sempre os mesmos valores
   constantes em toda espécie hoje; `entity` é `sl_humanoid_01_entity` ou `ssm_humanoid_01_entity` conforme o
   `rig` do `portrait.json` (`RIGS` em `scripts/generate-portraits/types.ts`); `greeting_sound` varia só por
   gênero (`human_male_greetings_01` / `human_female_greetings_01`, sempre macho pras espécies sem gênero); cada
   espécie tem sempre um único grupo de retrato por gênero (sufixo `_01`); o bloco `portrait_groups` segue o
   boilerplate padrão (`game_setup`, `species`, `pop`, `leader`, `ruler`) idêntico ao que já existia manualmente.

### Escolher o `modo` de enquadramento

No canvas do `ssm_shared` (980×780) o guia resolve em largura 600, topo y=144, base y=780.

**`largura` (padrão)** escala a arte pros 600 px do guia e corta na borda inferior o que passar de 780. A arte
sai do **mesmo tamanho em toda espécie**, porque a largura é fixa — é isso que faz os retratos parecerem um
conjunto. É o modo certo pra composição de busto, onde nada abaixo do peito precisa aparecer.

**`altura`** escala pra que a base toque exatamente y=780, e deriva a largura da proporção do PNG. Dois casos
pedem esse modo:

1. **A composição é larga demais pro guia** — proporção `altura/largura` do conteúdo abaixo de ~1,06 (isto é,
   `alturaMinima / largura` do guia). Escalada pros 600 px do guia, a arte fica curta demais pra alcançar a
   base e o busto flutuaria. Aqui `largura` é **erro de validação**, com mensagem própria.
2. **A arte tem abaixo do busto um elemento que precisa aparecer** — a cintura, um cinto, a transição pra uma
   anatomia não-humana. Escalando pela largura, esse pedaço cai muito além de y=780 e nunca chega à tela.
   Aqui `largura` **valida sem reclamar** e simplesmente some com o elemento: nenhum erro avisa, a decisão é
   visual. O caso canônico é `ssm_mermaids`: só em `altura` a cintura com a base da cauda fica visível — e a
   cauda é o traço que define a espécie.

O preço do caso 2 é tamanho, e é real: a largura resultante fica bem abaixo dos 600 do guia (numa arte de
proporção 1,4 dá ~455 px), então a espécie sai menor que as que usam `largura`, e **varia entre variantes da
mesma espécie**, porque cada PNG enquadra uma quantidade diferente de corpo. Não existe ajuste que dê as duas
coisas: da cabeça à cintura são ~3 alturas de cabeça, e isso não cabe entre y=144 e y=780 com a cabeça no
tamanho que o guia dá. Escolher `altura` é aceitar o personagem menor em troca do elemento visível.

Vale conferir contra a janela real de UI antes de decidir: dos 122 contextos medidos por
`scripts/measure-framing/`, só **36% mostram até a borda inferior** do canvas — a base visível mediana é
y≈725. Um elemento que o `modo` traz pra y≈690 aparece em 94% dos contextos; um que fica em y=780 aparece em
pouco mais de um terço.

## Portraits e Portrait Groups (mecânica vanilla)

Todas as espécies deste mod usam **retratos animados** (não os retratos estáticos simples que a wiki também
descreve, veja "Retratos estáticos" abaixo) — mas nenhuma delas tem mesh ou animação própria; todas reaproveitam
um rig já pronto (veja "A técnica usada aqui" abaixo).

O que é escolhido como "a Aparência" de uma espécie de um império é chamado de "Portrait Group". Cada Portrait
Group pode conter um ou vários portraits.

Cada portrait é definido por:

1. **`entity`**: o mesh e a animação usados pelo retrato, definidos em `gfx/models/portraits/*.asset`.
2. **`clothes_selector`/`attachment_selector`**: qual conjunto de roupa/cabelo o retrato escolhe (veja seção
   própria abaixo).
3. **`greeting_sound`**: o som que a espécie faz ao abrir a janela de diplomacia/eventos (veja seção própria
   abaixo).
4. **`character_textures`**: os `.dds` pintados sobre o mesh definido em `entity` — é aqui que entra a arte de
   cada espécie deste mod.

Um Portrait Group define, para 6 situações diferentes, qual portrait usar:

1. **`default`**: o portrait usado quando nada mais se aplica.
2. **`game_setup`**: qual portrait aparece na tela de Seleção de Império, ao criar um país. Não tem efeito
   nenhum depois que o jogo começa.
3. **`species`**: qual portrait aparece na aba de Espécies do jogo principal. Se houver mais de um portrait
   nesse escopo, **só um vale** (nunca aleatório) — o primeiro da lista, sempre o mesmo. Só muda in-game criando
   um template da espécie, onde o jogo sorteia um portrait dentre os do escopo `pop`.
4. **`pop`**: qual(is) portrait(s) podem ser sorteados para um pop dessa espécie, visto na aba do planeta.
5. **`leader`**: qual portrait usar para líderes do país (cientistas, generais, almirantes, governadores).
6. **`ruler`**: qual portrait usar para o governante do país.

Exemplo real deste mod, `gfx/portraits/portraits/ssm_elves_portrait.txt`:

```text
portrait_groups = {
  ssm_elves = {
    default = ssm_elves_male_01
    game_setup = {
      add = {
        trigger = { ruler = { OR = { gender = female  gender = indeterminable } } }
        portraits = { ssm_elves_female_01 }
      }
      add = {
        trigger = { ruler = { OR = { gender = male  gender = indeterminable } } }
        portraits = { ssm_elves_male_01 }
      }
    }
    species = {
      add = { portraits = { ssm_elves_male_01 } }
    }
    pop = {
      add = {
        trigger = { NOR = { species = { species_gender = male } } }
        portraits = { ssm_elves_female_01 }
      }
      add = {
        trigger = { NOR = { species = { species_gender = female } } }
        portraits = { ssm_elves_male_01 }
      }
    }
    leader = { # mesmo padrão de game_setup, por gênero }
    ruler = { # mesmo padrão de game_setup, por gênero }
  }
}
```

Note que `species` sempre resolve para `ssm_elves_male_01` — é assim que o gerador
(`scripts/generate-portraits/`) trata a regra "só um vale" descrita acima: o escopo `pop` é quem de fato varia
por gênero.

## A técnica usada aqui: reaproveitar um rig já pronto

A wiki descreve dois jeitos de criar um retrato: **estático** (`spriteType`/`texturefile`, sem animação, usado
só pra ícones simples) e **animado** (criar um mesh novo, riggar no Maya, exportar animações). Este mod usa
nenhum dos dois do jeito descrito lá — usa uma terceira técnica, mais comum em mods de retrato que não têm
recursos pra modelar/riggar do zero: **reaproveitar o mesh e as animações de um mod já existente**, e criar só a
textura nova (`character_textures`) que é pintada em cima dele.

Concretamente: todo `entity` de todo `ssm_<espécie>_portrait.txt` deste mod aponta para uma entity definida
dentro de `gfx/models/portraits/ssm_shared/` (ou, pelo contrato legado, `gfx/models/portraits/sl_shared/`; mesh em
`_humanoid_portrait_meshes.gfx`, referenciando `humanoid_01_portrait.mesh`). O prefixo `sl_` vem do **Stellar
Legion Mod**, um mod hoje **extinto** de quem esse rig foi originalmente herdado — ele não existe mais no Steam
Workshop, mas o mesh/animação continuam vivos dentro de `sl_shared/`, versionados como parte deste mod. **Não
existe mais o mod original pra consultar/atualizar essas animações** — `sl_shared/` é a única fonte que resta.
`ssm_shared/` é um fork próprio deste mod, derivado de `sl_shared/` reduzido a um único plano com UV corrigida
(canvas de `character_textures` **980×780**, contra 825×1650 do legado) — veja `docs/rig.md` pro porquê e como
cada espécie escolhe um dos dois via `portrait.json`. **Todas as 18 espécies publicadas usam `ssm_shared`
hoje** — nenhuma segue no legado `sl_shared`, que permanece no repositório como fonte de derivação do fork e
como única cópia do mesh/animação originais.

Como consequência prática:

- **Adicionar uma espécie nova nunca envolve Maya, rigging ou animação nova.** O único trabalho de arte é
  produzir a arte-fonte (nativa, trimada, qualquer resolução — o enquadramento é derivado, ver "Como o gerador
  funciona" acima) e rodar `bun run portrait` (ou gerar via IA, ver `docs/pipeline-generate-art.md`).
- O outro mod **Some Cool Species**
  ([Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3013229124)) usa a mesma técnica de
  reaproveitar um rig existente — útil como segunda referência caso `sl_shared/` precise de ajuste e a wiki não
  seja suficiente.
- Como o rig é compartilhado por **todas** as espécies que o usam, qualquer mudança em `sl_shared/`/`ssm_shared/`
  (escala, estados de animação) afeta todas elas ao mesmo tempo — não há como ajustar só uma nesse nível.

## Retratos estáticos

Além da técnica animada usada por todas as espécies deste mod (seção acima), o Stellaris também suporta um
retrato **estático**: uma única imagem sem animação nenhuma, sem `entity`/mesh, sem `character_textures`. É a
forma mais simples de retrato que o jogo aceita — útil pra um ícone ou uma espécie de aparição rápida onde não
vale o esforço/peso de reaproveitar um rig animado. **Nenhuma espécie deste mod usa essa técnica hoje**; fica
documentada aqui como referência caso um dia sejam necessários retratos leves e sem animação.

Um retrato estático é uma entrada dentro de `portraits = { }` (não `portrait_groups = { }`) num arquivo `.txt`
em `gfx/portraits/portraits/`, apontando direto pra uma textura, de um dos dois jeitos:

```text
portraits = {
  ssm_exemplo_static = {
    spriteType = "GFX_portrait_ssm_exemplo_static"
  }
}
```

— onde `GFX_portrait_ssm_exemplo_static` precisa existir como um `spriteType` definido num `.gfx` (ex.:
`gfx/interface/portraits/ssm_portraits.gfx`), apontando pro arquivo `.dds`:

```text
spriteTypes = {
  spriteType = {
    name = "GFX_portrait_ssm_exemplo_static"
    texturefile = "gfx/interface/portraits/ssm_exemplo_static.dds"
  }
}
```

ou, sem precisar declarar um `spriteType` à parte, apontando pro `.dds` direto no próprio `portraits.txt`:

```text
portraits = {
  ssm_exemplo_static = {
    texturefile = "gfx/interface/portraits/ssm_exemplo_static.dds"
  }
}
```

Passos pra criar um:

1. Recortar a arte do personagem sem fundo (transparência via canal alfa) e exportar como `.dds` — mesmas
   opções de formato descritas em `docs/pipeline-texturas.md` (BC1/BC3 UNORM via `texconv`, nunca as variantes
   sRGB).
2. Salvar o `.dds` em algum lugar dentro de `gfx/` (por convenção deste mod, seguir o padrão `ssm_` de prefixo).
3. Registrar a entrada em `portraits = { }` num `.txt` novo dentro de `gfx/portraits/portraits/`, usando
   `spriteType` (se quiser reaproveitar a entrada `.gfx` em outro lugar da UI) ou `texturefile` direto (mais
   simples, se for só pro retrato).
4. Registrar o nome do portrait (`ssm_exemplo_static`) num `portrait_set`, do mesmo jeito que os retratos
   animados (veja "Modelo de dados" acima) — sem isso, o portrait não aparece no jogo nem herda
   cumprimentos/insultos corretos (veja seção abaixo).

Diferente do retrato animado, um retrato estático não tem `portrait_groups` com os 6 escopos, nem
`character_textures`, `clothes_selector`/`attachment_selector` ou `greeting_sound` próprios — é só a imagem.

## Cumprimentos e insultos

Cumprimento e insulto vêm da **`species_class`** da espécie, e só dela. As chaves são
`<SPECIES_CLASS>_insult_01`, `_compliment_01`, `_organ`, `_mouth`, `_ear`... em
`localisation/<idioma>/name_lists/name_lists_l_*.yml`, e o jogo as resolve por funções internas
(`GetSpeciesNameInsult`, `GetSpeciesNamePluralCompliment`). Não existe granularidade por retrato nem por
espécie-flavor.

Como as espécies deste mod usam classes vanilla (veja `docs/pipeline-taxonomy.md`), elas recebem o flavor
dessas classes: um reptiliano do mod é xingado de "newt" como qualquer reptiliano do jogo. Ter flavor próprio
exigiria uma `species_class` própria com um `portrait_set` apontando pra ela — o rationale de não fazer isso
está em `docs/history/2026-08-17-taxonomia-de-portraits.md`.

Além disso, os triggers `wears_clothes`, `lithoids_portrait` e `necroids_portrait`
(`common/scripted_triggers/00_scripted_triggers.txt`), usados pra decidir certos insultos (ex.: nudista vs.
vestido), **não** derivam da `species_class`: cada um é uma lista **hardcoded** de nomes de `species_portrait`
vanilla (`wears_clothes` verifica `is_human_species` OR `species_portrait = humanoid_02/03/04`;
`lithoids_portrait` verifica `species_portrait = lith1/lith2/...`). Como os nomes deste mod nunca aparecem
nessas listas, **nenhuma espécie daqui é tratada como "veste roupa", "lithoide" ou "necroide" por esses triggers
específicos** — elas caem no comportamento padrão. Sobrescrevê-los exigiria substituir o arquivo inteiro
(`scripted_triggers` não faz merge por chave entre mods, ao contrário de `portrait_groups`/`room_selector`), o
que arrisca conflito com outros mods — por isso este mod não faz essa mudança.

## `clothes_selector` e `attachment_selector`

São blocos definidos em `gfx/portraits/asset_selectors/`, que escolhem qual roupa/cabelo/anexo (`attachment`)
um retrato usa em diferentes condições (governante vs. pop comum, por exemplo). Hoje, em **todas** as espécies
deste mod, ambos são fixados em `"no_texture"` — ou seja, desativados; nenhuma espécie usa roupa ou cabelo
modular por cima da arte. Se algum dia isso mudar (dar roupa/cabelo a uma espécie específica), o ponto de
partida é criar um arquivo novo em `gfx/portraits/asset_selectors/` no mesmo formato dos selectors vanilla, e
trocar o `"no_texture"` pelo nome desse selector no `.txt` da espécie — mas isso não é gerado automaticamente
pelo pipeline hoje (veja `scripts/generate-portraits/`).

## `greeting_sound`

Hoje, **toda** espécie deste mod usa sons genéricos humanos
(`human_male_greetings_01`/`human_female_greetings_01` — sempre macho pras espécies sem gênero), mesmo
pra espécies com tema bem distante de humano (avianos, moluscos, necromantes). Isso é uma simplificação do
pipeline (`scripts/generate-portraits/`), não uma limitação do jogo — o vanilla já traz coleções temáticas
prontas em `\sound`, caso se queira diferenciar por espécie no futuro:

| Tema | Coleções vanilla disponíveis |
| --- | --- |
| Aviano | `avian_generic_greeting`, `avian_01_greetings` |
| Molusco | `molluscoid_generic_greeting`, `molluscoid_01_greetings`, `cute_molluscoid_snail_greetings`, `cute_molluscoid_starfish_greetings` |
| Artrópode | `arthopoid_generic_greeting`, `arthropoid_01_greetings`, `cute_arthopoid_greetings` |
| Fungoide | `fungoid_generic_greeting`, `fungoid_01_greetings`, `fungoid_02_greetings`, `cute_fungoid_greetings` |
| Mamífero | `mammalian_01_greetings` (+ `mammalian_portrait_pack`) |
| Réptil | `reptilian_generic_greeting`, `reptilian_01_greetings`, `cute_reptilian_greetings` |
| Necroide | `necroids_greetings` |
| Lithoide | `lithoids_greetings` |
| Plantoide | `plantoid_greetings` |
| Humano/humanoide genérico | `human_generic_greeting`, `humanoid_male_greeting_a..d`, `humanoid_female_greeting_a..d` |
| Império caído | `fallen_empire_01_greetings` |

Cada entrada acima é uma **coleção** (`\sound\category.asset` + `\sound\sound.asset`), não um arquivo único —
o campo `greeting_sound` no `.txt` de retrato aceita o nome da coleção e o jogo sorteia uma variação dela.

## Non-intrusive Replacer (nota)

A wiki documenta uma técnica pra substituir um Portrait Group **vanilla** condicionalmente (por `is_species` ou
`has_country_flag`), preservando o checksum e deixando o retrato original e o modado coexistirem no mesmo jogo —
veja a seção
["Alternative: Non-intrusive Replacer"](https://stellaris.paradoxwikis.com/Portrait_modding#Alternative:_Non-intrusive_Replacer)
do artigo original. **Este mod não usa essa técnica hoje** (nenhum `is_species`/`has_country_flag` no
repositório) — ele adiciona `portrait_sets`/`portrait_categories` próprios em vez de substituir os do vanilla.
Fica registrado aqui como referência pro caso de precisar compatibilizar com o mod-irmão
[Galaxar 2.0](https://steamcommunity.com/sharedfiles/filedetails/?id=3320507446) ou com outro mod no futuro.

## Ver também

- [Portrait modding](https://stellaris.paradoxwikis.com/Portrait_modding) — artigo original da wiki, fonte
  deste documento.
- [Some Cool Species](https://steamcommunity.com/sharedfiles/filedetails/?id=3013229124) — outro mod que
  reaproveita um rig existente da mesma forma que este mod faz com `sl_shared/`.
- [Galaxar 2.0](https://steamcommunity.com/sharedfiles/filedetails/?id=3320507446) — mod-irmão deste projeto.
- **Stellar Legion Mod** — mod de origem do rig `sl_humanoid_01_entity`/`sl_spider_01_entity` em `sl_shared/`;
  hoje extinto (removido do Steam Workshop), sem link disponível. `sl_shared/` é a única cópia restante desse
  mesh/animação.
- `docs/pipeline-taxonomy.md` — como a espécie chega às abas do jogo: `portrait_sets`, `portrait_categories`,
  gates de DLC.
- `docs/rig.md` — anatomia do mesh compartilhado, derivação do enquadramento, ferramental Blender.
