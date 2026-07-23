# Sistema de retratos do Stellaris — referência para este mod

Este documento explica **como o sistema de retratos do Stellaris funciona por baixo do capô** (mecânica vanilla),
filtrado pro que é relevante para este mod — não é a documentação genérica de modding (essa vive na
[wiki oficial](https://stellaris.paradoxwikis.com/Portrait_modding)). Para "como este projeto está organizado" e
"como gerar os arquivos automaticamente", veja a seção "Modelo de dados: como um retrato de espécie é conectado"
do `CLAUDE.md` — este arquivo não duplica aquele conteúdo, só complementa com a mecânica do jogo por trás dele.

Todas as 15+ espécies deste mod usam **retratos animados** (não os retratos estáticos simples que a wiki também
descreve, veja "Retratos estáticos" abaixo) — mas nenhuma delas tem mesh ou animação própria; todas reaproveitam um
rig já pronto (veja a seção "A técnica usada aqui" abaixo).

## Portraits e Portrait Groups

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
2. **`game_setup`**: qual portrait aparece na tela de Seleção de Império, ao criar um país. Não tem efeito nenhum
   depois que o jogo começa.
3. **`species`**: qual portrait aparece na aba de Espécies do jogo principal. Se houver mais de um portrait nesse
   escopo, **só um vale** (nunca aleatório) — o primeiro da lista, sempre o mesmo. Só muda in-game criando um
   template da espécie, onde o jogo sorteia um portrait dentre os do escopo `pop`.
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

Note que `species` sempre resolve para `ssm_elves_male_01` — é assim que o gerador (`scripts/generate-portraits/`)
trata a regra "só um vale" descrita acima: o escopo `pop` é quem de fato varia por gênero.

## A técnica usada aqui: reaproveitar um rig já pronto

A wiki descreve dois jeitos de criar um retrato: **estático** (`spriteType`/`texturefile`, sem animação, usado só
pra ícones simples) e **animado** (criar um mesh novo, riggar no Maya, exportar animações). Este mod usa nenhum
dos dois do jeito descrito lá — usa uma terceira técnica, mais comum em mods de retrato que não têm recursos pra
modelar/riggar do zero: **reaproveitar o mesh e as animações de um mod já existente**, e criar só a textura nova
(`character_textures`) que é pintada em cima dele.

Concretamente: todo `entity` de todo `ssm_<espécie>_portrait.txt` deste mod aponta para uma entity definida dentro
de `gfx/models/portraits/sl_shared/` ou `gfx/models/portraits/ssm_shared/` (mesh em `_humanoid_portrait_meshes.gfx`,
referenciando `humanoid_01_portrait.mesh`). O prefixo `sl_` vem do **Stellar Legion Mod**, um mod hoje **extinto**
de quem esse rig foi originalmente herdado — ele não existe mais no Steam Workshop, mas o mesh/animação continuam
vivos dentro de `sl_shared/`, versionados como parte deste mod. **Não existe mais o mod original pra
consultar/atualizar essas animações** — `sl_shared/` é a única fonte que resta. `ssm_shared/` é um fork próprio
deste mod, derivado de `sl_shared/` com a UV corrigida (canvas de `character_textures` diferente, 840×1024 em vez
de 825×1650) — veja a seção "`sl_shared` vs. `ssm_shared`" do `CLAUDE.md` pro porquê e como cada espécie escolhe
um dos dois via `portrait.json`. Nenhuma espécie publicada usa `ssm_shared` hoje.

Como consequência prática:

- **Adicionar uma espécie nova nunca envolve Maya, rigging ou animação nova.** O único trabalho de arte é pintar
  a textura de cima do template `assets/portraits/portrait.psd` (pensado pro enquadramento do `sl_shared`, o rig
  legado — ainda não existe um template equivalente pro `ssm_shared`), respeitando o enquadramento que o mesh do
  rig escolhido espera — depois disso é só rodar `bun run portrait` (veja `CLAUDE.md`).
- O outro mod **Some Cool Species**
  ([Steam Workshop](https://steamcommunity.com/sharedfiles/filedetails/?id=3013229124)) usa a mesma técnica de
  reaproveitar um rig existente — útil como segunda referência caso `sl_shared/` precise de ajuste e a wiki não
  seja suficiente.
- Como o rig é compartilhado por **todas** as espécies do mod, qualquer mudança em `sl_shared/` (escala, estados de
  animação) afeta todas as espécies ao mesmo tempo — não há como ajustar só uma delas nesse nível.

## Retratos estáticos

Além da técnica animada usada por todas as espécies deste mod (seção acima), o Stellaris também suporta um retrato
**estático**: uma única imagem sem animação nenhuma, sem `entity`/mesh, sem `character_textures`. É a forma mais
simples de retrato que o jogo aceita — útil pra um ícone ou uma espécie de aparição rápida onde não vale o
esforço/peso de reaproveitar um rig animado. **Nenhuma espécie deste mod usa essa técnica hoje**; fica documentada
aqui como referência caso um dia sejam necessários retratos leves e sem animação.

Um retrato estático é uma entrada dentro de `portraits = { }` (não `portrait_groups = { }`) num arquivo `.txt` em
`gfx/portraits/portraits/`, apontando direto pra uma textura, de um dos dois jeitos:

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

1. Recortar a arte do personagem sem fundo (transparência via canal alfa) e exportar como `.dds` — mesmas opções
   de formato descritas em `image.md` (BC1/BC3 UNORM via `texconv`, nunca as variantes sRGB).
2. Salvar o `.dds` em algum lugar dentro de `gfx/` (por convenção deste mod, seguir o padrão `ssm_` de prefixo —
   veja `CLAUDE.md`).
3. Registrar a entrada em `portraits = { }` num `.txt` novo dentro de `gfx/portraits/portraits/`, usando
   `spriteType` (se quiser reaproveitar a entrada `.gfx` em outro lugar da UI) ou `texturefile` direto (mais
   simples, se for só pro retrato).
4. Registrar o nome do portrait (`ssm_exemplo_static`) na `species_class` correspondente em
   `common/species_classes/ssm_species_classes.txt`, do mesmo jeito que os retratos animados (veja "Modelo de
   dados" no `CLAUDE.md`) — sem isso, o portrait não aparece no jogo nem herda cumprimentos/insultos corretos
   (veja seção abaixo).

Diferente do retrato animado, um retrato estático não tem `portrait_groups` com os 6 escopos, nem
`character_textures`, `clothes_selector`/`attachment_selector` ou `greeting_sound` próprios — é só a imagem.

## Registro em species_classes e cumprimentos/insultos

Retratos modados costumam vir com cumprimentos e insultos "errados" (a IA/lore do jogo trata a espécie como
genérica). A causa раiz está em três arquivos vanilla:

- **`common/species_classes/00_species_classes.txt`**: `HUM` define quais nomes de portrait contam como
  "humanoide". Qualquer portrait cujo nome não estiver listado ali (ou na `species_class` equivalente do mod, como
  a `ssm_sagittarius` deste projeto) não é considerado humanoide pelo resto do jogo.
- **`common/species_classes/01_base_species_classes.txt`**: lista todos os nomes de Portrait Group que o jogo
  reconhece. Um Portrait Group cujo nome não aparecer aqui **não aparece no jogo**, e não recebe cumprimentos ou
  insultos de acordo com sua `species_class`.
- **`common/scripted_triggers/00_scripted_triggers.txt`**: define os triggers `wears_clothes`,
  `lithoids_portrait` e `necroids_portrait`, usados para decidir insultos (ex.: nudista vs. vestido).

O ponto que a wiki simplifica demais: esses três triggers **não** derivam dinamicamente da `species_class` do
portrait — cada um é uma lista **hardcoded** de nomes específicos de `species_portrait` vanilla (ex.:
`wears_clothes` verifica `is_human_species` OR `species_portrait = humanoid_02/03/04`; `lithoids_portrait`
verifica `species_portrait = lith1/lith2/...`; e por aí vai). Como os nomes deste mod (`ssm_elves`, `ssm_cyborg`,
etc., registrados em `ssm_species_classes.txt`) nunca aparecem nessas listas, **nenhuma espécie deste mod é tratada
como "veste roupa", "lithoide" ou "necroide" por esses triggers específicos** — elas caem no comportamento
padrão/genérico. Sobrescrever esses triggers pra incluir os nomes `ssm_` exigiria substituir o arquivo inteiro
(`scripted_triggers` não faz merge por chave entre mods, ao contrário de `portrait_groups`/`room_selector`), o que
arrisca conflito com outros mods que também tentem sobrescrevê-lo — por isso este mod não faz essa mudança.

## `clothes_selector` e `attachment_selector`

São blocos definidos em `gfx/portraits/asset_selectors/`, que escolhem qual roupa/cabelo/anexo (`attachment`) um
retrato usa em diferentes condições (governante vs. pop comum, por exemplo). Hoje, em **todas** as espécies deste
mod, ambos são fixados em `"no_texture"` — ou seja, desativados; nenhuma espécie usa roupa ou cabelo modular por
cima da arte. Se algum dia isso mudar (dar roupa/cabelo a uma espécie específica), o ponto de partida é criar um
arquivo novo em `gfx/portraits/asset_selectors/` no mesmo formato dos selectors vanilla, e trocar o
`"no_texture"` pelo nome desse selector no `.txt` da espécie — mas isso não é gerado automaticamente pelo pipeline
hoje (veja `scripts/generate-portraits/`).

## `greeting_sound`

Hoje, **toda** espécie deste mod usa sons genéricos humanos (`human_male_greetings_01`/`human_female_greetings_01`
— sempre macho pras espécies "flat"/sem gênero), mesmo pra espécies com tema bem distante de humano (avianos,
moluscos, necromantes). Isso é uma simplificação do pipeline (`scripts/generate-portraits/`), não uma limitação
do jogo — o vanilla já traz coleções temáticas prontas em `\sound`, caso se queira diferenciar por espécie no
futuro:

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
do artigo original. **Este mod não usa essa técnica hoje** (nenhum `is_species`/`has_country_flag` no repositório)
— ele adiciona `species_classes`/`portrait_categories` próprios em vez de substituir os do vanilla. Fica registrado
aqui como referência pro caso de precisar compatibilizar com o mod-irmão
[Galaxar 2.0](https://steamcommunity.com/sharedfiles/filedetails/?id=3320507446) ou com outro mod no futuro.

## Ver também

- [Portrait modding](https://stellaris.paradoxwikis.com/Portrait_modding) — artigo original da wiki, fonte deste
  documento.
- [Some Cool Species](https://steamcommunity.com/sharedfiles/filedetails/?id=3013229124) — outro mod que reaproveita
  um rig existente da mesma forma que este mod faz com `sl_shared/`.
- [Galaxar 2.0](https://steamcommunity.com/sharedfiles/filedetails/?id=3320507446) — mod-irmão deste projeto.
- **Stellar Legion Mod** — mod de origem do rig `sl_humanoid_01_entity`/`sl_spider_01_entity` em `sl_shared/`; hoje
  extinto (removido do Steam Workshop), sem link disponível. `sl_shared/` é a única cópia restante desse
  mesh/animação.
