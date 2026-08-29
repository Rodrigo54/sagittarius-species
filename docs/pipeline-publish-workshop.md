# Publicação no Steam Workshop

`scripts/publish-workshop/` (comando `bun run publish-workshop -- [--metadata-only]`) publica o mod no Steam
Workshop via `steamcmd`. Este documento detalha as peças; o resumo de alto nível está no `CLAUDE.md`, seção
"Publicação no Steam Workshop".

## Por que `steamcmd`

O Steam Workshop tem uma API completa (`ISteamUGC`, com `SetItemUpdateLanguage` etc.) que exige compilar uma
aplicação contra o Steamworks SDK. `steamcmd` expõe uma fatia bem menor dela por linha de comando
(`workshop_build_item <arquivo.vdf>`), oficialmente recomendada pela Valve só "para fins de teste" — mas é o
suficiente pro que este mod precisa (publicar conteúdo + título/descrição em um único idioma), sem precisar
montar um projeto C++ só pra isso.

## `bin/steamcmd/`

Baixado por `bun run setup` (entrada em `FERRAMENTAS`, `scripts/download-bin.ts`), tipo `'bootstrap'` — diferente
de `texconv`/`imagemagick` (tipo `'exe'`/`'7z'`, versão fixada manualmente, comparada via `.version`),
`steamcmd` não tem uma versão fixável: o próprio `steamcmd.exe` se auto-atualiza sozinho toda vez que roda,
baixando os arquivos que faltam direto dos servidores da Steam. Por isso a instalação só verifica se
`bin/steamcmd/steamcmd.exe` já existe — se sim, pula, sem nunca comparar/reinstalar por cima. Isso importa
porque, depois do primeiro uso, essa mesma pasta passa a guardar a sessão de login cacheada pelo `steamcmd`;
uma reinstalação destruiria esse cache e obrigaria a fazer login (com senha + Steam Guard) de novo.

## Os arquivos `.md` em `steam-workshop/`

- **`description.pt.md`** — a descrição em português, **fonte de autoria**: é aqui que o texto nasce e é
  revisado. Não é publicado (a API exposta pelo `steamcmd` não aceita descrição por idioma — ver "Fora de
  escopo"), e o script de publish nem lê este arquivo. Quem for mudar a descrição edita este primeiro e depois
  reflete a mudança no `description.md`; os dois carregam a mesma estrutura (mesmas seções, mesma ordem, mesmos
  emojis, mesmos números), o que torna a tradução um espelho.
- **`description.md`** — a descrição do item na página do Workshop, em inglês, **tradução do `description.pt.md`**.
  Markdown válido (headings, `**negrito**`,
  links, imagens — inclusive o padrão `[![alt](imgurl)](linkurl)` pra um banner clicável). Usado inteiro em
  **todo publish** (não só `--metadata-only`) — `title`/`description` sempre vão no VDF, então a descrição da
  Steam nunca fica desatualizada em relação ao arquivo.
- **`change-notes.md`** — histórico de mudanças, mantido à mão. Cada versão é uma seção `## <versão>` (ex.:
  `## 1.9.0`); **novas entradas sempre entram no topo do arquivo** (abaixo do parágrafo introdutório, acima da
  seção anterior) — é assim que o script sabe qual é "a versão mais recente": pega sempre a primeira seção `##`
  que encontrar. O modo normal do publish usa só essa seção; o resto do arquivo é histórico de referência, nunca
  reenviado.

`description.md` e `change-notes.md` eram uma mistura de BBCode literal com markdown solto antes desta pipeline existir — foram reescritos
pra Markdown puro (ver `git log` de `steam-workshop/*.md` em torno da introdução deste pipeline) porque o
conversor precisa de sintaxe válida pra funcionar direito; BBCode digitado à mão nesses arquivos ainda funciona
(não é sintaxe markdown válida, então o parser trata como texto puro e ele atravessa sem mudança), mas não é
mais necessário.

## Conversão Markdown → BBCode (`md-to-bbcode.ts`)

`marked` (`lexer()`) faz só o parsing/tokenização; um renderer escrito à mão (`renderToken`, com `renderInline`/
`renderBlock` pra juntar os filhos de cada token) percorre a árvore de tokens e emite o dialeto BBCode da Steam:

| Markdown | BBCode |
| --- | --- |
| `# H1` / `## H2` / `### H3`+ | `[h1]`/`[h2]`/`[h3]` (níveis abaixo de h3 são grampeados em `[h3]` — a Steam não tem `[h4]+`) |
| `**negrito**` | `[b]` |
| `*itálico*` / `_itálico_` | `[i]` |
| `~~riscado~~` | `[strike]` |
| `` `code` `` / bloco de código | `[code]` |
| `- item` / `* item` (lista) | `[list]` + `[*] item` por linha |
| `[texto](url)` | `[url=url]texto[/url]` |
| `![alt](url)` | `[img]url[/img]` |
| `[![alt](imgurl)](linkurl)` (link com imagem aninhada) | `[url=linkurl][img]imgurl[/img][/url]` |
| `> citação` | `[quote]` |
| quebra de linha "dura" (`\` ou duas espaços no fim da linha) | quebra de linha simples, sem tag |

Testado em `md-to-bbcode.test.ts`, incluindo o caso do link com imagem aninhada e o caso de BBCode literal
misturado com markdown na mesma frase (o padrão real usado em `description.md`).

## Timestamp automático no header de `change-notes.md` (`change-notes.ts`)

`extrairPrimeiraSecao` localiza a seção `## <versão>` mais no topo e separa a versão do timestamp, se já
existir um (`— YYYY-MM-DD HH:mm` no final da linha de heading). `comTimestamp` calcula a linha de heading final:
se a seção já tinha timestamp, devolve sem mudança; senão, anexa a hora local atual. `gravarTimestamp` reescreve
só essa linha no arquivo (preservando todo o resto) — mas só é chamada **depois** da confirmação do publish, no
`index.ts`; se o Rodrigo cancelar, `change-notes.md` fica intocado, mesmo já tendo calculado que timestamp
*seria* usado.

Esse timestamp é metadado só local, pra correlacionar a entrada do arquivo com o update correspondente no
histórico nativo da Steam (que já carimba data/hora sozinha) — nunca entra no texto do `changenote` enviado. Só
o corpo da seção (o que vem depois da linha de heading) é convertido e enviado.

Importante: **o `changenote` de uma build já publicada não pode ser editado depois** — não existe comando no
`steamcmd`, nem (até onde a documentação da Valve cobre) uma forma de fazer isso pelo painel web pra itens de
Workshop "comuns" (publicados via `workshop_build_item`, diferente de apps com Steamworks Partner/depots). É por
isso que o resumo de confirmação sempre mostra o texto final, já convertido, antes de qualquer coisa ser
enviada.

## VDF (`vdf.ts`)

`montarVdf` gera o bloco `"workshopitem" { ... }` que o `steamcmd +workshop_build_item <arquivo>` espera —
formato KeyValues (Clausewitz-like, mas não é o mesmo dialeto do resto do mod, não usa `jomini`). `title`/
`description` são sempre incluídos; `changenote` é opcional (presente no modo normal, ausente em
`--metadata-only` — nada impede combinar os três no mesmo VDF, a Valve documenta isso como incluir "the
key/value pairs that should be updated"):

```
"workshopitem"
{
	"appid"		"281990"
	"publishedfileid"	"<remote_file_id do descriptor.mod>"
	"contentfolder"	"<caminho absoluto de mod/sagittarius-species/>"
	"previewfile"	"<caminho absoluto de mod/sagittarius-species/thumbnail.png>"
	"title"	"<name do descriptor.mod>"
	"description"	"<description.md inteiro, convertido pra BBCode>"
	"changenote"	"<corpo da seção de change-notes.md, convertido pra BBCode — ausente em --metadata-only>"
}
```

O KeyValues do `steamcmd` lê este VDF **sem sequências de escape**: dentro de um valor entre aspas, `\"` não
escapa nada — a aspa encerra o valor ali, e o resto do texto cai na posição de chave, derrubando o publish com
`Assertion Failed: CKeyValuesSystem::AddStringToPool: key name too long` seguido de `got } in key in file
workshopitem`. Como não existe forma de representar uma aspa dupla no valor, `sanitizarValorVdf` troca cada uma
por aspa tipográfica, alternando abertura (`“`) e fechamento (`”`) — é o único caractere que a montagem do VDF
altera. Barra invertida e quebra de linha são literais e passam intactas, inclusive nos caminhos Windows de
`contentfolder`/`previewfile` (`D:\dev\...` vai como está). Gerado em runtime dentro de `bin/steamcmd/` (fora do
git, sobrescrito a cada publish).

## Orquestração (`index.ts`)

```
1. valida plataforma (Windows), steamcmd instalado, STEAM_USERNAME setada
2. lê descriptor.mod (name/version/remote_file_id)
3. monta o conteúdo (changenote de change-notes.md, ou title+description de description.md)
4. imprime resumo + pede confirmação ("digite sim")
5. se confirmado:
   a. bun run copy (sincroniza o mod local de teste)
   b. grava timestamp em change-notes.md (só no modo normal, só se ainda não tinha)
   c. escreve o VDF em bin/steamcmd/publish.vdf
   d. steamcmd +login $STEAM_USERNAME +workshop_build_item <vdf> +quit (stdio herdado do
      terminal — steamcmd pode pedir senha/Steam Guard interativamente)
```

`node:util.parseArgs` faz o parsing da única flag (`--metadata-only`) — é o padrão do projeto pra CLIs novas
daqui pra frente, não só deste script.

### Detecção de sucesso: exit code do steamcmd não é confiável

`steamcmd` tem uma manha antiga e bem documentada: depois de `workshop_build_item`, ele frequentemente termina
com código de saída não-zero (ex.: `7`) mesmo quando a atualização foi commitada com sucesso — validado na
prática (publish real, 2026-08-10): saída trazia `Committing update...Success.` e o processo mesmo assim saiu
com `7`. Por isso `executarSteamcmd` (`index.ts`) não usa o exit code como sinal de sucesso; ele captura
stdout/stderr (repassando cada pedaço pro terminal em tempo real, então a experiência interativa — incluindo o
prompt de senha/Steam Guard, que continua lendo do stdin real — não muda) e procura a frase literal
`Committing update...Success.` na saída acumulada. Só essa frase decide sucesso; o exit code vira só informação
secundária (uma mensagem de aviso quando não-zero mas a frase apareceu, ou parte do erro quando a frase não
apareceu).

## `STEAM_USERNAME` / `.env`

Login sempre passa o usuário explicitamente (`+login <usuário>`), mesmo com sessão cacheada — o `steamcmd` não
tem um "último usuário lembrado" automático como o cliente gráfico da Steam. `STEAM_USERNAME` vem de um `.env`
local (`.gitignore`d; copie `.env.example` pra `.env` e preencha). Senha e código do Steam Guard nunca ficam em
arquivo — são sempre pedidos interativamente pelo próprio `steamcmd`, e a sessão resultante fica cacheada em
`bin/steamcmd/` (sem `+logout` forçado no final do script).

## Testando sem publicar de verdade

Todo o caminho até a confirmação (validações, parsing do `descriptor.mod`, extração/timestamp de
`change-notes.md`, conversão MD→BBCode, montagem do resumo) roda com qualquer `STEAM_USERNAME` (mesmo
inválido) e responder "não" no prompt cancela sem tocar em `change-notes.md`, sem rodar `bun run copy` e sem
chamar `steamcmd`. É assim que dá pra validar mudanças no script sem risco de publicar algo sem querer — só
confirmar "sim" de fato dispara login real + `bun run copy` + publish.

## Fora de escopo (de propósito)

- **Galeria de screenshots do Workshop** (`steam-workshop/pictures/screenshot__*.jpg`, `banner.png` etc.) — o
  VDF do `workshop_build_item` só controla `previewfile` (o ícone/thumbnail do item, um único arquivo); a
  galeria de imagens adicionais da página não tem nenhum comando exposto no `steamcmd`, só o painel web da
  Steam.
- **Localização por idioma** (título/descrição em PT-BR *e* EN separados) — existe na API `ISteamUGC`
  (`SetItemUpdateLanguage`), mas não é exposta pelo VDF do `steamcmd`, que só tem `title`/`description` planos,
  sem chave de idioma. Faria falta uma aplicação compilada contra o Steamworks SDK — fora de escopo aqui.
- **Sync automático de versão** entre `package.json`/`descriptor.mod`/`README.md` — continua manual (ver
  "Metadados de release" no `CLAUDE.md`).
- **Integração com o fluxo GitFlow/release** (`job-github-release`) — o publish no Workshop não é disparado
  automaticamente por nenhum merge/tag; é sempre um comando manual, separado.
