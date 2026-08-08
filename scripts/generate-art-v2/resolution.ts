/** Deriva `width`/`height` a partir de `geracaoArtV2.modelo.aspectRatio`
 * ("W:H" livre, ex.: "2:3", "4:5", "1:1") — decisão tomada durante a
 * entrevista de planejamento: em vez de travar `width`/`height` crus por
 * espécie (como o v1 faz), a v2 só declara a *proporção*, e a resolução
 * efetiva é sempre calculada preservando a contagem de megapixels do
 * quadrado `1024×1024` (o padrão do template oficial do Flux.2 Klein — ver
 * `EmptyFlux2LatentImage`/`Flux2Scheduler` no dump do workflow oficial).
 * Isso mantém o custo de VRAM/tempo de geração parecido não importa a
 * proporção escolhida, e evita uma tabela de resoluções mágicas por
 * proporção (a alternativa descartada na entrevista).
 *
 * As duas dimensões são arredondadas pro múltiplo de 16 mais próximo: o VAE
 * do Flux2 reduz por 8× e o transformer "patchifica" por mais 2×, então uma
 * dimensão que não é múltiplo de 16 quebra ou distorce a geração — mesma
 * exigência que o próprio node `EmptyFlux2LatentImage` impõe
 * (`step: 1` mas os buckets recomendados já vêm em múltiplos de 16). */

const BASE_MEGAPIXELS = 1024 * 1024;
const MULTIPLO = 16;

/** Ausente `aspectRatio` em `modelo` = quadrado, mesmo padrão do template
 * oficial do Flux.2 Klein. */
export const ASPECT_RATIO_PADRAO = '1:1';

const FORMATO_ASPECT_RATIO = /^(\d+):(\d+)$/;

function arredondarParaMultiplo(valor: number, multiplo: number): number {
  return Math.max(multiplo, Math.round(valor / multiplo) * multiplo);
}

export interface Resolucao {
  width: number;
  height: number;
}

/** `aspectRatio` já foi validado pelo schema zod (regex `^\d+:\d+$`) antes
 * de chegar aqui — a validação de formato abaixo é defesa em profundidade
 * (ex.: uso direto em teste/script avulso, sem passar pelo zod), não a
 * primeira linha de defesa contra entrada malformada. */
export function resolverAspectRatio(aspectRatio: string): Resolucao {
  const match = aspectRatio.match(FORMATO_ASPECT_RATIO);
  if (!match) {
    throw new Error(`aspectRatio "${aspectRatio}" não bate com o formato "W:H" (ex.: "2:3", "4:5").`);
  }

  const larguraProporcao = Number(match[1]);
  const alturaProporcao = Number(match[2]);
  if (larguraProporcao <= 0 || alturaProporcao <= 0) {
    throw new Error(`aspectRatio "${aspectRatio}": as duas componentes precisam ser positivas.`);
  }

  // largura × altura = BASE_MEGAPIXELS, com altura/largura = alturaProporcao/larguraProporcao
  // => largura = sqrt(BASE_MEGAPIXELS × larguraProporcao / alturaProporcao)
  const largura = Math.sqrt((BASE_MEGAPIXELS * larguraProporcao) / alturaProporcao);
  const altura = largura * (alturaProporcao / larguraProporcao);

  return {
    width: arredondarParaMultiplo(largura, MULTIPLO),
    height: arredondarParaMultiplo(altura, MULTIPLO),
  };
}
