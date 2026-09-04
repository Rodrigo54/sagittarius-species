# Pipeline de imagens promocionais: criação e iteração do pódio

Registro de 2026-09-03. O estado atual está em `docs/pipeline-promo.md`; aqui fica o porquê e os caminhos
descartados.

## O gatilho

A galeria do Steam Workshop dependia só de screenshots manuais da UI (`steam-workshop/pictures/screenshot__*.jpg`)
— nenhuma imagem combinava a arte das espécies (retratos) com os fundos temáticos (`assets/city_sets/`) num
formato de divulgação de fato. `/questione-me` conduziu a entrevista que fixou o formato (painel de texto +
degradê à esquerda, personagens recortados à direita sobre um fundo de cidade) e a decisão de que o fundo por
espécie **não é gerado por IA neste pipeline** — reaproveita o que `assets/city_sets/` já tem, mantendo a regra
do projeto de que enfileirar geração de IA é sempre decisão do Rodrigo, nunca do Claude por conta própria.

## De 4 personagens pra 3

A primeira versão compunha uma cascata de **4** personagens. Depois de gerar as 19 espécies, ficou claro que
o formato de 4 tinha dois problemas persistentes: a escala entre colocações precisava de ajuste fino por
espécie o tempo todo (a proporção do recorte varia demais entre variantes pra uma escala global servir todas
sem sobra/corte), e com 4 corpos disputando a mesma zona horizontal, cada personagem saía pequeno demais pra
carregar a composição.

A decisão foi reduzir pra **3**, no formato de pódio olímpico (prata-ouro-bronze, esquerda-centro-direita) — 3
formas visuais mais legíveis, cada uma maior, com o 1º lugar centralizado como foco. Junto, `variantes` no
`species-promo.json` deixou de ter seleção automática e virou **sempre obrigatório e explícito**: com só 3
PNGs valendo por espécie (contra 4 antes), deixar a escolha ao acaso de um hash teria efeito visual grande
demais pra não ser uma decisão deliberada por espécie.

O override `escalas` (por colocação, no JSON) sobreviveu à migração — o problema que ele resolve (proporção de
recorte variando por espécie) independe de serem 3 ou 4 posições no pódio.

## Bugs do ImageMagick, ambos silenciosos

Dois bugs apareceram na mesma leva de testes, e nenhum dos dois falhava com erro — o resultado só saía errado:

1. **`-gravity` vazando por `( ... )`.** O crop centralizado do fundo usava `-gravity center` dentro de um
   grupo; como `-gravity` é um "setting" do ImageMagick, não escopado pelos parênteses, esse `center` seguia
   valendo pros `-geometry +x+y -composite` seguintes (degradê e os 3 personagens), que esperavam offset a
   partir do canto superior esquerdo. Sintoma: só 2 dos personagens apareciam, cortados/fora de escala. Corrigido
   resetando `-gravity NorthWest` explicitamente logo após o bloco do fundo.
2. **Caminho Windows corrompido em `-font`/`caption:@arquivo`.** Os dois passam pelo parser de texto do
   ImageMagick, que trata `\x` como início de escape e engole a barra — `path.join`, no Windows, produz
   caminhos com `\`. O aviso (`unable to read font ...`) ia pro stderr sem interromper a composição, que
   silenciosamente caía pra fonte padrão do sistema — sintoma reportado como "as fontes não foram aplicadas".
   Corrigido normalizando `\` → `/` (`paraArgumentoDeTexto()`) em todo caminho que alimenta esses dois
   argumentos — caminhos de imagem para composição não precisam do mesmo tratamento.

## Layout do eixo X: de olho pra uma grade de 12 colunas

A primeira geometria horizontal (largura do painel, zona dos personagens, centro de cada colocação) foi
calibrada **a olho**, sem fórmula — números como `centroXFracaoDaZona: 0.15` vieram de tentativa visual, não de
cálculo. Isso funcionou, mas tornou cada ajuste (mover um personagem, redimensionar o painel) outra rodada de
tentativa e erro sem garantia de que a proporção resultante fizesse sentido como grade.

A pedido explícito, o layout foi refeito sobre uma **grade de 12 colunas** (160px cada): 4 colunas pro painel
de texto, 6 pra zona dos personagens (2 colunas por retrato, 3 encaixes iguais), e as 2 colunas restantes como
respiro/margem. A posição exata de cada encaixe passou a ser **calculada** (`centroDoEncaixe()` em
`layout.ts`, fração `(2i+1)/6`) em vez de cravada — o mesmo princípio de "não faça de cabeça o que pode ser
script" aplicado à geometria da imagem. As 2 colunas sobrando passaram por duas posições até fixar: primeiro
uma em cada lateral como margem, depois — por ficar grande demais à esquerda — movidas pra servir de respiro
único entre o painel de texto (que passou a encostar na borda esquerda) e a zona dos personagens.

## Personagens flutuando: mesma regra do pipeline de portraits

A geometria vertical inicial deixava `MARGEM_INFERIOR_PERSONAGEM = 15`px de gap entre os pés do personagem e o
rodapé do canvas. Numa arte de corpo inteiro sem chão desenhado por baixo, esse gap lia como o personagem
flutuando acima do vazio — reportado depois de gerar as 19 espécies com o layout novo. A correção foi remover o
gap e alinhar a regra à que `scripts/generate-portraits/framing.ts` já usa pros retratos do jogo: a arte sempre
alcança a borda inferior do canvas, sem folga (o comentário daquele arquivo já usa literalmente "nunca
flutuando" pra essa mesma exigência). Os 3 personagens do pódio continuam de pé na mesma linha — agora
exatamente o rodapé do canvas, não uma linha alguns pixels acima dele.
