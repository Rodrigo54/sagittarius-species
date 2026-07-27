/**
 * Calcula, a partir dos `.gui` do Stellaris, qual pedaço do retrato cada
 * contexto de UI realmente mostra.
 *
 * A descoberta que torna isso possível: o enquadramento do retrato **não** é
 * uma câmera opaca do engine. Cada contexto é um `containerWindowType` com
 * `size` + `clipping = yes`, contendo um `iconType` que desenha um
 * `portraitType` (`GFX_portrait_character` e variantes) numa `position` e
 * `scale`. A janela visível é aritmética de layout:
 *
 *     topo_visível = (clip.y0 − icone.y) / scale
 *
 * em coordenadas do **sprite do retrato** — as mesmas em que o corte superior
 * do quadro é expresso. O tamanho do sprite não precisa ser conhecido: a
 * janela é relativa a ele.
 *
 * Por que a posição absoluta na tela não entra na conta: o `iconType` é sempre
 * descendente do container que o recorta, então qualquer deslocamento comum
 * aos dois (inclusive os que dependem da resolução de tela) se cancela na
 * diferença. Só deslocamentos *entre* o container de clipping e o ícone
 * importam.
 */

/** Fator de ancoragem (x, y) em [0,1] para cada valor de `orientation`/`origo`.
 * `orientation` ancora a posição do elemento a um ponto do **pai**; `origo`
 * ancora o ponto do **próprio elemento** que cai nessa posição.
 *
 * Os arquivos do jogo trazem 19 grafias distintas, incluindo variações e
 * erros de digitação da própria Paradox (`centerup`, `center_center`,
 * `top_left`). As inequívocas estão mapeadas; as ambíguas ficam de fora de
 * propósito — `top`, `left` e `right` não deixam claro se o outro eixo é
 * borda ou centro, e chutar produziria um número errado com cara de certo. */
const ANCORAS: Record<string, { x: number; y: number }> = {
  upper_left: { x: 0, y: 0 },
  top_left: { x: 0, y: 0 },
  left_up: { x: 0, y: 0 },
  upper_right: { x: 1, y: 0 },
  lower_left: { x: 0, y: 1 },
  lower_right: { x: 1, y: 1 },
  right_down: { x: 1, y: 1 },
  center: { x: 0.5, y: 0.5 },
  center_center: { x: 0.5, y: 0.5 },
  center_middle: { x: 0.5, y: 0.5 },
  center_up: { x: 0.5, y: 0 },
  upper_center: { x: 0.5, y: 0 },
  centerup: { x: 0.5, y: 0 },
  center_down: { x: 0.5, y: 1 },
  center_left: { x: 0, y: 0.5 },
  center_right: { x: 1, y: 0.5 },
};

/** Fallback usado só quando o chamador não passa a lista de sprites de retrato
 * (ver `lerTiposDeRetrato`). Cobre a maioria dos casos, mas **não** os
 * `*_masked` da tela de contatos e do primeiro contato — por isso a lista
 * derivada dos `.gfx` é o caminho preferido. */
export const SPRITE_RETRATO = /^GFX_portrait_character/;

export interface Retangulo {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface No {
  tipo: string;
  nome?: string;
  position: { x: number; y: number };
  size?: { largura: number; altura: number };
  clipping: boolean;
  orientation?: string;
  origo?: string;
  scale?: number;
  sprite?: string;
  filhos: No[];
}

export interface Contexto {
  arquivo: string;
  /** Caminho de nomes do topo até o ícone, para achar o bloco no arquivo. */
  caminho: string[];
  /** Qual variante de câmera: `GFX_portrait_character`, `_close_up`, etc. */
  sprite: string;
  scale: number;
  /** Janela visível em coordenadas do sprite do retrato. `null` quando
   * `semRecorte` — não há recorte a expressar. */
  janela: Retangulo | null;
  /** Nenhum ancestral declara `clipping`: o contexto exibe o sprite **inteiro**,
   * sem cortar nada. Não é uma falha de análise — é o caso mais generoso
   * possível, e é ele que prova que o topo do sprite (y = 0) chega à tela. */
  semRecorte: boolean;
  /** Motivos pelos quais este contexto não pôde ser resolvido com confiança.
   * Contexto com ressalva **não** entra na tabela de corte sem inspeção. */
  ressalvas: string[];
}

function numero(v: unknown): number | undefined {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Aceita `{ x, y }` e `{ width, height }` — os `.gui` usam as duas grafias
 * para dimensão, inclusive dentro do mesmo arquivo. */
function lerDimensao(bloco: unknown): { largura: number; altura: number } | undefined {
  if (!bloco || typeof bloco !== 'object') return undefined;
  const b = bloco as Record<string, unknown>;
  const largura = numero(b.width ?? b.x);
  const altura = numero(b.height ?? b.y);
  if (largura === undefined || altura === undefined) return undefined;
  return { largura, altura };
}

function lerPosicao(bloco: unknown): { x: number; y: number } {
  if (!bloco || typeof bloco !== 'object') return { x: 0, y: 0 };
  const b = bloco as Record<string, unknown>;
  return { x: numero(b.x) ?? 0, y: numero(b.y) ?? 0 };
}

/** Acha uma chave ignorando maiúsculas/minúsculas — os `.gui` alternam entre
 * `orientation` e `Orientation`, `alwaysTransparent` e `alwaystransparent`. */
function campo(bloco: Record<string, unknown>, nome: string): unknown {
  const alvo = nome.toLowerCase();
  for (const [k, v] of Object.entries(bloco)) {
    if (k.toLowerCase() === alvo) return v;
  }
  return undefined;
}

const TIPOS_DE_ELEMENTO = new Set([
  'containerWindowType',
  'iconType',
  'buttonType',
  'instantTextBoxType',
  'textBoxType',
  'background',
  'gridBoxType',
  'overlappingElementsBoxType',
  'scrollbarType',
  'listboxType',
  'windowType',
  'checkboxType',
  'editBoxType',
  'smoothListboxType',
  'expandButtonType',
  'positionType',
]);

/** Converte a saída crua do jomini na árvore de elementos de layout. */
export function montarArvore(bloco: unknown, tipo: string): No {
  const b = (bloco && typeof bloco === 'object' ? bloco : {}) as Record<string, unknown>;

  const filhos: No[] = [];
  for (const [chave, valor] of Object.entries(b)) {
    const tipoFilho = [...TIPOS_DE_ELEMENTO].find((t) => t.toLowerCase() === chave.toLowerCase());
    if (!tipoFilho) continue;
    for (const item of Array.isArray(valor) ? valor : [valor]) {
      filhos.push(montarArvore(item, tipoFilho));
    }
  }

  const orientation = campo(b, 'orientation');
  const origo = campo(b, 'origo');
  const sprite = campo(b, 'spriteType') ?? campo(b, 'quadTextureSprite');

  return {
    tipo,
    nome: typeof campo(b, 'name') === 'string' ? (campo(b, 'name') as string) : undefined,
    position: lerPosicao(campo(b, 'position')),
    size: lerDimensao(campo(b, 'size')),
    clipping: campo(b, 'clipping') === true,
    orientation: typeof orientation === 'string' ? orientation.toLowerCase() : undefined,
    origo: typeof origo === 'string' ? origo.toLowerCase() : undefined,
    scale: numero(campo(b, 'scale')),
    sprite: typeof sprite === 'string' ? sprite : undefined,
    filhos,
  };
}

function intersecao(a: Retangulo, b: Retangulo): Retangulo {
  return {
    x0: Math.max(a.x0, b.x0),
    y0: Math.max(a.y0, b.y0),
    x1: Math.min(a.x1, b.x1),
    y1: Math.min(a.y1, b.y1),
  };
}

interface Estado {
  /** Recorte herdado, em coordenadas do **pai** do nó atual. `null` = nenhum
   * ancestral recorta. */
  clip: Retangulo | null;
  caminho: string[];
  /** Tamanho do pai, necessário para resolver `orientation`. */
  tamanhoPai?: { largura: number; altura: number };
  ressalvas: string[];
}

/** Deslocamento do elemento dentro do pai, resolvendo `orientation` (âncora no
 * pai) e `origo` (âncora no próprio elemento). */
function deslocamento(no: No, estado: Estado): { x: number; y: number; ressalvas: string[] } {
  const ressalvas: string[] = [];
  let { x, y } = no.position;

  if (no.orientation) {
    const ancora = ANCORAS[no.orientation];
    if (!ancora) {
      ressalvas.push(
        `orientation "${no.orientation}" é ambígua ou desconhecida — não dá pra derivar a âncora sem chutar`
      );
    } else if (!estado.tamanhoPai) {
      if (ancora.x !== 0 || ancora.y !== 0) {
        ressalvas.push(
          `orientation "${no.orientation}" ancora no tamanho do pai, que não é declarado neste ramo`
        );
      }
    } else {
      x += ancora.x * estado.tamanhoPai.largura;
      y += ancora.y * estado.tamanhoPai.altura;
    }
  }

  if (no.origo) {
    const ancora = ANCORAS[no.origo];
    if (!ancora) {
      ressalvas.push(`origo "${no.origo}" é ambígua ou desconhecida`);
    } else if (ancora.x !== 0 || ancora.y !== 0) {
      if (!no.size) {
        // Num iconType, o tamanho é o do sprite × scale — desconhecido aqui.
        ressalvas.push(
          `origo "${no.origo}" ancora no tamanho do próprio elemento, que não é declarado (num iconType seria o tamanho do sprite)`
        );
      } else {
        x -= ancora.x * no.size.largura;
        y -= ancora.y * no.size.altura;
      }
    }
  }

  return { x, y, ressalvas };
}

/** Percorre a árvore e emite um `Contexto` por ícone que desenha um retrato.
 * `spritesDeRetrato` vem de `lerTiposDeRetrato`; omitir cai no fallback por
 * prefixo, que perde as variantes mascaradas. */
export function coletarContextos(
  raiz: No,
  arquivo: string,
  spritesDeRetrato?: ReadonlySet<string>
): Contexto[] {
  const contextos: Contexto[] = [];
  const ehRetrato = (sprite: string) =>
    spritesDeRetrato ? spritesDeRetrato.has(sprite) : SPRITE_RETRATO.test(sprite);

  function visitar(no: No, estado: Estado) {
    const desloc = deslocamento(no, estado);
    // Deslocamento só entra na conta quando já existe um recorte a transportar:
    // acima do container que recorta, mover o nó move o retrato e a janela
    // juntos, e a diferença — que é o que medimos — não muda. Guardar essas
    // ressalvas descartaria contextos perfeitamente resolvíveis.
    const ressalvas = [...estado.ressalvas, ...(estado.clip ? desloc.ressalvas : [])];
    const caminho = [...estado.caminho, no.nome ?? `<${no.tipo}>`];

    // O recorte herdado passa a ser expresso nas coordenadas deste nó.
    let clip: Retangulo | null = estado.clip
      ? {
          x0: estado.clip.x0 - desloc.x,
          y0: estado.clip.y0 - desloc.y,
          x1: estado.clip.x1 - desloc.x,
          y1: estado.clip.y1 - desloc.y,
        }
      : null;

    if (no.clipping) {
      if (!no.size) {
        ressalvas.push(`"${no.nome ?? no.tipo}" declara clipping sem size — recorte indeterminado`);
      } else {
        const proprio = { x0: 0, y0: 0, x1: no.size.largura, y1: no.size.altura };
        clip = clip ? intersecao(clip, proprio) : proprio;
      }
    }

    if (no.sprite && ehRetrato(no.sprite)) {
      const scale = no.scale ?? 1;
      // A janela vive nas coordenadas do sprite: desconta a posição do ícone
      // dentro do pai e desfaz a escala com que ele é desenhado.
      const janela = estado.clip
        ? {
            x0: (estado.clip.x0 - desloc.x) / scale,
            y0: (estado.clip.y0 - desloc.y) / scale,
            x1: (estado.clip.x1 - desloc.x) / scale,
            y1: (estado.clip.y1 - desloc.y) / scale,
          }
        : null;

      contextos.push({
        arquivo,
        caminho,
        sprite: no.sprite,
        scale,
        janela,
        semRecorte: janela === null,
        ressalvas,
      });
    }

    for (const filho of no.filhos) {
      visitar(filho, {
        clip,
        caminho,
        tamanhoPai: no.size,
        ressalvas,
      });
    }
  }

  visitar(raiz, { clip: null, caminho: [], ressalvas: [] });
  return contextos;
}
