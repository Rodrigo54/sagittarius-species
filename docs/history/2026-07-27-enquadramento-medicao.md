# Recentralização e recorte do enquadramento no rig `ssm_shared`

Relato da sessão que executou a correção, em 2026-07-27, na branch `feature/portrait-framing` a partir da
`develop` pós-1.8.0. O documento anterior era um **plano** escrito em 2026-07-25; este é o registro do que de
fato foi feito, incluindo os pontos em que o plano estava errado. Contexto de fundo: `docs/rig.md` (seções
"`sl_shared` vs. `ssm_shared`" e "Enquadramento", incluindo a derivação técnica e o recorte do topo) e
`docs/history/2026-07-23-ssm-shared-rig.md`. O rationale vivo de enquadramento por âncora (por que
`"ancora": "cabeca"` existe, e as candidatas por espécie) que nasceu no fim desta sessão foi migrado pra dentro
de `docs/rig.md` — não repetido aqui.

## TL;DR

O sintoma era um retrato descentrado: toda arte migrada estava **69 px à direita** do centro do canvas, porque o
guia de enquadramento fora calibrado contra o **esqueleto** do rig herdado, e o jogo enquadra o **plano**.

O que se entregou vai além disso:

1. `assets/portraits/` passou a guardar **master nativo**, com o enquadramento derivado no pipeline. O canvas
   deixou de ser decisão permanente.
2. O enquadramento do jogo deixou de ser estimativa: **122 contextos de UI** derivados dos `.gui`, mais uma
   âncora medida in-game.
3. O topo do plano — a faixa que a câmera nunca captura — foi **recortado da geometria**, e o canvas encolheu de
   980×976 para **980×780**, com as texturas 20% menores e zero perda visível.
4. O guia foi centrado, corrigindo os 69 px.

Validado programaticamente e in-game.

## 1. Onde o plano original estava errado

**A seção 10 do plano não fechava.** Ela propunha "remapear V no `.mesh` e redimensionar o canvas" para eliminar
a faixa morta. Mas o plano inteiro sempre aparece no mesh: remapear V linearmente só troca *qual faixa* da
textura é esticada por ele. Eliminar a faixa exige **recortar geometria** — remover linhas de vértices.

**O ganho imaginado não existia com a arte de hoje.** O plano supunha recuperar densidade. Medindo os PNGs
pré-migração no git contra os migrados, a arte **já era upscale de +18% a +45%**:

| espécie | conteúdo original | depois da migração |
| --- | --- | --- |
| `ssm_high_elves` | 392×541 | 566×637 |
| `ssm_knight` | 462×542 | 543×637 |
| `ssm_timbot` | 317×502 | — |

Dar mais pixels a ela seria interpolar mais. Daí a decisão de **preservar a densidade** e deixar a subida para
quando houver arte nova — o que, com o canvas virando constante ajustável, passou a ser trocar um número.

**A faixa recuperável era menor do que se supunha.** O plano falava em recuperar `y = 0..339` (35% da altura,
"até +50%"). A medição mostrou que a câmera captura a partir de `y_canvas ≈ 199`: a faixa realmente invisível é
`0..199`, 20,4%. Cortar em 339 apagaria área que aparece na tela.

## 2. O método que substituiu a estimativa

O plano previa "medir os prints por script, não a olho". Investigando, apareceu algo melhor: **o enquadramento é
declarativo**. Cada contexto de UI é um `containerWindowType` com `size` + `clipping`, contendo um `iconType` com
`position` e `scale`. A janela visível é aritmética.

Isso mudou a economia da medição: em vez de fotografar sete contextos e medir cada um, **122 contextos saem dos
arquivos** e apenas uma âncora precisa do jogo aberto. E a tabela se revalida sozinha a cada patch da Paradox.

Detalhes técnicos, armadilhas e lições de método estão em `docs/rig.md` — é lá que a próxima sessão deve olhar,
não aqui.

## 3. Decisões, e por quê

| decisão | por quê |
| --- | --- |
| infraestrutura agora, ganho depois | a arte nova é que vai colher; forçar ganho hoje seria interpolar upscale |
| `assets/` guarda master, não arte enquadrada | converte "densidade do canvas" de decisão permanente em constante |
| densidade preservada (canvas 980×780) | a arte atual já é upscale; e subir depois ficou barato |
| medir antes de cortar | o corte é o teto permanente da composição futura |
| corte na linha de grade 195 | está 4 px acima do limite medido: remoção pura, sem mover vértice |
| `sl_shared` congelado | duas espécies publicadas não mudam por efeito colateral |
| `migrate-portraits` extinto | trocar de rig virou editar um campo do `portrait.json` |

Uma decisão foi **revista pela medição**: na entrevista escolhemos descer a última linha de vértices até a linha
medida exata, para não perder até 10% do ganho. Como a linha 195 caiu a 4 px do limite, a variante simples
passou a valer mais que a precisa.

## 4. Como cada etapa foi verificada

O trabalho foi organizado para que cada bloco tivesse um critério de aceitação próprio, verificável sem opinião:

- **Pipeline novo, constantes velhas.** Com os masters restaurados e o guia antigo, `bun run portrait` reescreveu
  os 487 DDS e o `git status` do `mod/` ficou **limpo** — saída byte a byte idêntica vinda de um pipeline de
  forma completamente diferente. Isso separou "a forma mudou" de "o valor mudou".
- **Restauração dos masters.** 48 amostras conferidas: soma do canal alfa idêntica ao original e dimensão igual
  ao trim box — perda zero comprovada, não presumida.
- **Modo de enquadramento por espécie.** Não estava gravado em lugar nenhum (era flag de CLI da migração, perdida
  quando ela terminou). Recuperado enquadrando cada master nos dois modos e comparando pixel a pixel com o
  commit anterior: cada espécie casou com exatamente um modo, **zero pixels de diferença**.
- **Codificação da arte de calibração.** Testada contra o compressor real, não contra a teoria: através do
  texconv em BC3 e de volta, 122/122 faixas decodificam certo nos dois eixos, com erro máximo de 4 por canal
  contra tolerância de 12.
- **Âncora in-game.** Ajustada em um contexto e validada em **três previsões que não a alimentaram** (altura da
  região na tela; escala e base visível de um contexto de outra variante de câmera), com erros de 0,4% a 1,1%.
- **Recorte do mesh.** 12 testes: remove exatamente as linhas previstas, nenhum vértice movido, `U` inalterado,
  índices de triângulo válidos, sem faces degeneradas, `aabb` recalculada, esqueleto e locators intactos, saída
  byte-idêntica entre execuções.
- **Resultado final.** Deslocamento horizontal aplicado: **68,6 px médios** (esperado 69), amplitude de 2,5 px
  entre as 16 espécies. A dispersão residual entre espécies ficou **igual à de antes** (9,5 → 9,7 px), provando
  que ela é propriedade da composição de cada arte, não do enquadramento.

## 5. Depois da entrega: âncora na cabeça

Com o enquadramento já corrigido e validado in-game, apareceu um caso que ele não resolvia: os
`ssm_green_elves` têm chifres, e ancorados pelo bounding box os chifres tomavam o topo do guia, empurrando a
cabeça para baixo — o personagem saía menor e mais baixo que os outros elfos. Virou um campo novo no
`portrait.json` (`"ancora": "cabeca"`), aplicado só a essa espécie nesta sessão. O rationale completo do porquê
(a heurística por largura não funciona, por que não é padrão, as candidatas por espécie) foi incorporado a
`docs/rig.md` — não repetido aqui.

## 6. Caminhos descartados (não refazer)

**Transladar o esqueleto no `.mesh`/`.anim`.** Se completa (bind pose + os 4 `.anim`), o skinning aplica
`pose × bind⁻¹` e a diferença permanece → nada muda in-game. Se parcial, a arte sai deslocada e as deformações
puxam as regiões erradas.

**Reapertar a UV em U para recuperar resolução horizontal.** Agora **medido**, não só inferido: `x_canvas = 0`
cai em `x_sprite = 45`, ou seja a câmera captura mais largo que a textura. Os pixels vazios à esquerda da arte
não são textura invisível — são ar dentro do quadro. Apertar a UV ali cortaria o enquadramento.

**Embaralhar os índices da codificação de cor.** Soa protetor (afasta faixas vizinhas no espaço de cor), mas
troca "leu 4, esperava 7" por "leu 323, esperava 3": erro grande, plausível e indetectável. Ver `docs/rig.md`.

**Localizar a calibração nos screenshots por cor.** A tolerância que o BC3 exige faz ~58% dos pixels de uma tela
qualquer decodificarem por acaso.

## 7. Referências

- `docs/rig.md` — anatomia do mesh, derivação do enquadramento, rationale de âncora por cabeça e candidatas por
  espécie (tudo que "ficou em aberto" ao fim desta sessão já foi incorporado lá)
- `docs/pipeline-portraits.md` — pipeline de portraits, "Comandos"
- `scripts/measure-framing/contextos.json` — os 122 contextos, com a janela visível de cada um
- `scripts/measure-framing/ancora.json` — a relação sprite↔canvas, com as validações que a sustentam
- `docs/history/2026-07-23-ssm-shared-rig.md` — por que o `pPlaneShape4` foi escolhido
