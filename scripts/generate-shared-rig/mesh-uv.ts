/**
 * Leitor/patch cirúrgico mínimo do formato binário .mesh da Clausewitz Engine
 * ("pdxasset"), o suficiente pra localizar e reescrever só o array `u0` (UV)
 * de cada objeto `mesh`, sem precisar reimplementar um parser/serializer
 * genérico do formato inteiro.
 *
 * Formato (verificado lendo humanoid_01_portrait.mesh com o parser Python de
 * referência do addon io_pdx_mesh, `pdx_data.py`, usado só pra exploração —
 * não é dependência deste script):
 *  - header: 4 bytes "@@b@"
 *  - depois, uma sequência de tokens até o EOF:
 *    - objeto: N bytes '[' (N = profundidade) + nome terminado em zero
 *    - propriedade: '!' + 1 byte (tamanho do nome, sem terminador) + nome +
 *      dado tipado: 1 byte de tipo ('i'|'f'|'s') + int32 LE de contagem +
 *      payload (int32/float32 LE por elemento, ou string p/ tipo 's')
 */

const HEADER = Buffer.from('@@b@', 'latin1');
const BRACKET = '['.charCodeAt(0);
const BANG = '!'.charCodeAt(0);

export interface PropriedadeEncontrada {
  /** Pilha de nomes dos objetos-pai, do mais externo ao mais interno. */
  caminho: string[];
  nome: string;
  tipo: string;
  contagem: number;
  /** Offset, no buffer, do primeiro byte do payload (após tipo+contagem). */
  offsetValor: number;
}

export interface ObjetoEncontrado {
  /** Pilha de nomes dos objetos-pai, do mais externo ao mais interno (sem
   * incluir o próprio objeto). */
  caminho: string[];
  nome: string;
  profundidade: number;
  /** Offset, no buffer, do primeiro byte `[` do token deste objeto — o
   * início do seu subtree no fluxo (as propriedades e filhos vêm em
   * sequência até o próximo objeto de profundidade igual ou menor). */
  offsetInicio: number;
}

function lerNomeObjeto(buf: Buffer, pos: number): { nome: string; profundidade: number; pos: number } {
  let profundidade = 0;
  while (buf[pos] === BRACKET) {
    profundidade++;
    pos++;
  }

  let nome = '';
  while (buf[pos] !== 0) {
    nome += String.fromCharCode(buf[pos]);
    pos++;
  }
  pos++; // pula o zero terminador

  return { nome, profundidade, pos };
}

function tamanhoTipo(tipo: string): number {
  if (tipo === 'i' || tipo === 'f') return 4;
  throw new Error(`tipo de propriedade não suportado por este scanner: "${tipo}"`);
}

interface ResultadoVarredura {
  objetos: ObjetoEncontrado[];
  propriedades: PropriedadeEncontrada[];
}

/** Percorre o fluxo de tokens inteiro uma única vez, registrando tanto os
 * objetos (com o offset de início de cada subtree) quanto as propriedades
 * (com o offset exato do início de cada payload). */
function varrer(buf: Buffer): ResultadoVarredura {
  if (!buf.subarray(0, 4).equals(HEADER)) {
    throw new Error(`header inesperado — não parece um .mesh da Clausewitz Engine: ${buf.subarray(0, 4)}`);
  }

  const objetos: ObjetoEncontrado[] = [];
  const propriedades: PropriedadeEncontrada[] = [];
  const pilha: string[] = [];
  let profundidadeAtual = 0;
  let pos = 4;

  while (pos < buf.length) {
    const marcador = buf[pos];

    if (marcador === BRACKET) {
      const offsetInicio = pos;
      const { nome, profundidade, pos: novoPos } = lerNomeObjeto(buf, pos);
      pos = novoPos;

      if (!(profundidade > profundidadeAtual)) {
        pilha.length = profundidade - 1;
      }
      objetos.push({ caminho: [...pilha], nome, profundidade, offsetInicio });
      pilha.push(nome);
      profundidadeAtual = profundidade;
      continue;
    }

    if (marcador === BANG) {
      pos++; // pula '!'
      const tamanhoNome = buf.readInt8(pos);
      pos++;
      const nome = buf.subarray(pos, pos + tamanhoNome).toString('latin1');
      pos += tamanhoNome;

      const tipo = String.fromCharCode(buf[pos]);
      pos++;
      const contagem = buf.readInt32LE(pos);
      pos += 4;
      const offsetValor = pos;

      if (tipo === 's') {
        // string: contagem é sempre 1; o payload é [int32 tamanho+1][bytes...]
        const tamanhoString = buf.readInt32LE(pos);
        pos += 4 + tamanhoString;
      } else {
        pos += contagem * tamanhoTipo(tipo);
      }

      propriedades.push({ caminho: [...pilha], nome, tipo, contagem, offsetValor });
      continue;
    }

    throw new Error(`token inesperado (0x${marcador.toString(16)}) na posição ${pos}`);
  }

  return { objetos, propriedades };
}

/** Percorre o arquivo inteiro e retorna toda propriedade encontrada, com seu
 * caminho de objetos-pai e o offset exato do início do payload — o suficiente
 * pra localizar (sem copiar) qualquer propriedade numérica pra patch depois. */
export function escanearPropriedades(buf: Buffer): PropriedadeEncontrada[] {
  return varrer(buf).propriedades;
}

/** Percorre o arquivo inteiro e retorna todo objeto encontrado, com o offset
 * de início do seu subtree — o suficiente pra excisar objetos inteiros do
 * fluxo de tokens (o formato não tem tabela global de offsets, então remover
 * um intervalo contíguo de bytes de subtree é uma operação fechada). */
export function escanearObjetos(buf: Buffer): ObjetoEncontrado[] {
  return varrer(buf).objetos;
}

/** Acha o array `u0` (UV) de cada objeto `mesh` filho direto de um
 * `pPlaneShapeN`, na ordem em que aparecem no arquivo. */
export function acharArraysUv(buf: Buffer): PropriedadeEncontrada[] {
  return escanearPropriedades(buf).filter((p) => {
    const pai = p.caminho[p.caminho.length - 1];
    const avo = p.caminho[p.caminho.length - 2];
    return p.nome === 'u0' && pai === 'mesh' && avo?.startsWith('pPlaneShape');
  });
}

/** O único plano que permanece no `ssm_shared`. Os outros cinco são
 * removidos por `removerPlanosOcultos` — ver o porquê lá.
 *
 * Por que o 4 (comparação completa dos 6 planos em `docs/rig.md`, seção 2.1):
 * cada plano do relevo 2.5D tem skinning, shader e geometria diferentes — os
 * 6 formam dois conjuntos corpo/cabelo/roupa do sistema vanilla de camadas
 * de retrato.
 *
 * - `pPlaneShape2` (1ª escolha) era a "camada do braço direito": 83% do peso
 *   de skinning na cadeia do braço, e a gesticulação dos `.anim` esticava
 *   arte cheia em até 29% de strain de aresta (a "distorção").
 * - `pPlaneShape6` (2ª escolha, o mais rígido: 6.9% máx) é camada de cabelo
 *   E fica 3–8 unidades fundo com 2.6 de curvatura: renderiza menor na
 *   câmera em perspectiva do jogo, e a borda inferior curlada entrava no
 *   quadro como um "papel curvado" transparente na cintura.
 * - `pPlaneShape4` (atual): camada de **corpo** (shader `PdxMeshPortrait`,
 *   que renderiza arte comum sem patch), praticamente sem curvatura (0.12 —
 *   nenhuma borda curva pra aparecer), quase na origem (−0.5 de
 *   profundidade, render próximo do tamanho do plano 2, comprovado no jogo)
 *   e strain baixo (10.1% máx / 0.3% mediana — 8x melhor que o plano 2). */
export const PLANO_MANTIDO = 'pPlaneShape4';

/** Remove do `.mesh` todo subtree `pPlaneShapeN` exceto `PLANO_MANTIDO`.
 *
 * Por quê: os 6 planos do rig são superfícies curvas distintas empilhadas em
 * profundidade (relevo 2.5D), cada uma exibindo o retrato inteiro. Com a UV
 * corrigida pra usar o canvas todo (`corrigirUvDoMesh`), arte que preenche o
 * canvas revela as 6 camadas como um "fantasma"/gêmeo atrás do personagem —
 * a única correção livre de fantasma em qualquer ângulo é manter um único
 * plano (ver `docs/history/2026-07-23-ssm-shared-rig.md`). Remover a geometria de
 * vez (em vez de degenerar os triângulos, a técnica anterior) mantém o mesh
 * importável no Blender — o importador do `io_pdx_mesh` crasha com faces
 * degeneradas, e a validação visual via Blender é pré-requisito da
 * investigação da distorção de animação.
 *
 * A excisão é fechada no formato: o arquivo é um fluxo de tokens sem tabela
 * global de offsets, cada `pPlaneShapeN` é um subtree autocontido (mesh +
 * esqueleto próprio, sem referência cruzada entre planos), e os `locator` no
 * fim não apontam pra nenhum plano — então remover os bytes de um subtree
 * inteiro preserva a validade de todo o resto. */
export function removerPlanosOcultos(original: Buffer): Buffer {
  const objetos = escanearObjetos(original);
  const planos = objetos.filter((o) => o.nome.startsWith('pPlaneShape') && o.caminho[o.caminho.length - 1] === 'object');

  if (planos.length !== 6) {
    throw new Error(`esperava exatamente 6 objetos pPlaneShapeN sob object, encontrou ${planos.length}`);
  }
  const mantidos = planos.filter((o) => o.nome === PLANO_MANTIDO);
  if (mantidos.length !== 1) {
    throw new Error(`esperava exatamente 1 plano mantido (${PLANO_MANTIDO}), encontrou ${mantidos.length}`);
  }

  // Fim do subtree de cada plano removido = início do próximo objeto de
  // profundidade igual ou menor (irmão ou raiz seguinte), ou EOF.
  const intervalos = planos
    .filter((o) => o.nome !== PLANO_MANTIDO)
    .map((plano) => {
      const indice = objetos.indexOf(plano);
      let fim = original.length;
      for (let i = indice + 1; i < objetos.length; i++) {
        if (objetos[i].profundidade <= plano.profundidade) {
          fim = objetos[i].offsetInicio;
          break;
        }
      }
      return { inicio: plano.offsetInicio, fim };
    })
    .sort((a, b) => a.inicio - b.inicio);

  const partes: Buffer[] = [];
  let cursor = 0;
  for (const { inicio, fim } of intervalos) {
    if (inicio < cursor) {
      throw new Error('intervalos de remoção sobrepostos — bug no cálculo de subtree');
    }
    partes.push(original.subarray(cursor, inicio));
    cursor = fim;
  }
  partes.push(original.subarray(cursor));

  const resultado = Buffer.concat(partes);

  // Sanidade: o resultado precisa continuar parseável e conter exatamente o
  // plano mantido (a varredura estoura se a excisão corromper o fluxo).
  const restantes = escanearObjetos(resultado).filter((o) => o.nome.startsWith('pPlaneShape'));
  if (restantes.length !== 1 || restantes[0].nome !== PLANO_MANTIDO) {
    throw new Error(`após a remoção, esperava só ${PLANO_MANTIDO} no mesh, encontrou: ${restantes.map((o) => o.nome).join(', ')}`);
  }

  return resultado;
}

/** O shader que renderiza a arte do retrato de fato. Os 6 planos do rig
 * original formam dois conjuntos completos do sistema vanilla de camadas de
 * retrato — corpo/cabelo/roupa lendo a metade de baixo do canvas
 * (`pPlaneShape2`/`3`/`7`) e corpo/roupa/cabelo lendo a de cima
 * (`4`/`5`/`6`) — e só os planos de corpo usam `PdxMeshPortrait`; os de
 * cabelo (`PdxMeshPortraitHair`) e roupa (`PdxMeshPortraitClothes`) usam
 * shaders que esperam máscara de tintura/seleção de roupa e **não renderizam
 * arte comum** (in-game o plano aparece 100% transparente). */
export const SHADER_RETRATO = 'PdxMeshPortrait';

/** Garante que o shader do material do plano mantido é `PdxMeshPortrait`.
 *
 * Com o `pPlaneShape4` (camada de corpo) mantido, isso já é verdade e a
 * função é um no-op — mas fica no pipeline como guarda: quando o plano
 * mantido era o `pPlaneShape6` (camada de cabelo, shader
 * `PdxMeshPortraitHair`), a ausência deste patch fazia o retrato aparecer
 * in-game como um quadro vazio (só canal alfa), apesar de renderizar
 * normalmente no Blender (que ignora o shader da Clausewitz). Quando o
 * patch é necessário, a string muda de tamanho, então é uma emenda de
 * buffer, não in-place — operação fechada no formato pelo mesmo motivo da
 * excisão de `removerPlanosOcultos`. */
export function corrigirShaderDoMesh(original: Buffer): Buffer {
  const shaders = escanearPropriedades(original).filter(
    (p) => p.nome === 'shader' && p.tipo === 's' && p.caminho.includes(PLANO_MANTIDO)
  );
  if (shaders.length !== 1) {
    throw new Error(`esperava exatamente 1 propriedade shader no ${PLANO_MANTIDO}, encontrou ${shaders.length}`);
  }
  const prop = shaders[0];
  const tamanhoAtual = original.readInt32LE(prop.offsetValor);
  const atual = original.subarray(prop.offsetValor + 4, prop.offsetValor + 4 + tamanhoAtual - 1).toString('latin1');
  if (atual === SHADER_RETRATO) {
    return Buffer.from(original);
  }

  const novoPayload = Buffer.alloc(4 + SHADER_RETRATO.length + 1);
  novoPayload.writeInt32LE(SHADER_RETRATO.length + 1, 0);
  novoPayload.write(SHADER_RETRATO, 4, 'latin1');

  const resultado = Buffer.concat([
    original.subarray(0, prop.offsetValor),
    novoPayload,
    original.subarray(prop.offsetValor + 4 + tamanhoAtual),
  ]);

  // Sanidade: reparse e o shader do plano mantido precisa ser o esperado.
  const conferencia = escanearPropriedades(resultado).filter(
    (p) => p.nome === 'shader' && p.tipo === 's' && p.caminho.includes(PLANO_MANTIDO)
  );
  const tamanhoNovo = resultado.readInt32LE(conferencia[0].offsetValor);
  const valorNovo = resultado
    .subarray(conferencia[0].offsetValor + 4, conferencia[0].offsetValor + 4 + tamanhoNovo - 1)
    .toString('latin1');
  if (conferencia.length !== 1 || valorNovo !== SHADER_RETRATO) {
    throw new Error('patch de shader corrompeu o fluxo de tokens — reparse não bate');
  }

  return resultado;
}

/** Substitui o payload de várias propriedades de uma vez, permitindo que a
 * **contagem mude**.
 *
 * Os outros patches deste módulo ou preservam o tamanho (UV) ou removem
 * subtrees inteiros (planos ocultos). Recortar o plano é o primeiro que
 * encurta arrays, e por isso precisa reescrever também o int32 de contagem que
 * antecede cada payload. Continua sendo uma operação fechada no formato pelo
 * mesmo motivo dos demais: o arquivo é um fluxo de tokens, sem tabela global
 * de offsets que precisasse ser corrigida depois. */
function reescreverPropriedades(
  original: Buffer,
  substituicoes: { prop: PropriedadeEncontrada; valores: ArrayLike<number> }[]
): Buffer {
  const ordenadas = [...substituicoes].sort((a, b) => a.prop.offsetValor - b.prop.offsetValor);

  const partes: Buffer[] = [];
  let cursor = 0;

  for (const { prop, valores } of ordenadas) {
    if (prop.tipo !== 'f' && prop.tipo !== 'i') {
      throw new Error(`só arrays numéricos podem ser reescritos (${prop.nome} é '${prop.tipo}')`);
    }
    const inicioContagem = prop.offsetValor - 4;
    const fimPayload = prop.offsetValor + prop.contagem * 4;
    if (inicioContagem < cursor) {
      throw new Error('substituições sobrepostas — bug no cálculo de offsets');
    }

    partes.push(original.subarray(cursor, inicioContagem));

    const bloco = Buffer.alloc(4 + valores.length * 4);
    bloco.writeInt32LE(valores.length, 0);
    for (let i = 0; i < valores.length; i++) {
      if (prop.tipo === 'f') bloco.writeFloatLE(valores[i], 4 + i * 4);
      else bloco.writeInt32LE(valores[i], 4 + i * 4);
    }
    partes.push(bloco);

    cursor = fimPayload;
  }

  partes.push(original.subarray(cursor));
  return Buffer.concat(partes);
}

/** Onde a lâmina cai, em fração da altura do canvas.
 *
 * Vem de medição in-game, não de estimativa (ver
 * `scripts/measure-framing/ancora.json`): o topo do sprite de retrato cai em
 * `y_canvas ≈ 199`, então a faixa `0..199` do canvas — 20,4% da altura — não
 * chega à tela em nenhum dos 122 contextos de UI do jogo.
 *
 * O valor usado é 195, e não 199, porque as linhas de vértice do plano caem em
 * `y_canvas` 2, 97, **195**, 293… A linha 195 está 4 px acima do limite
 * medido, o que torna o recorte uma **remoção pura de duas linhas**: nenhum
 * vértice precisa ser reposicionado, nenhuma UV precisa ser interpolada. Os
 * 4 px abandonados não pagam a complexidade que reposicionar custaria. */
export const V_DE_CORTE = 195 / 976;

/** Tolerância ao classificar vértices por linha da grade: os V de uma mesma
 * linha não são bit a bit idênticos no arquivo original. */
const TOLERANCIA_LINHA = 0.02;

/** Remove do plano mantido as linhas de vértices acima de `vDeCorte`, e
 * reescala a UV do que sobra para voltar a cobrir 0..1.
 *
 * Por que isso recupera resolução: a faixa removida nunca é exibida, mas
 * continua consumindo pixels da textura. Cortando a geometria, o mesmo canvas
 * passa a cobrir menos plano — ou, mantida a densidade, o canvas encolhe sem
 * perder nada. O enquadramento in-game não muda: remover geometria que estava
 * fora do quadro não move o que está dentro dele.
 *
 * Precisa mexer em tudo que é indexado por vértice (`p`, `n`, `ta`, `u0`, e os
 * pesos de skinning), reindexar os triângulos e recalcular a `aabb`. Não gera
 * faces degeneradas — elas quebram o importador do `io_pdx_mesh`, e validação
 * visual no Blender é parte do fluxo. */
export function recortarPlanoAcima(original: Buffer, vDeCorte = V_DE_CORTE): Buffer {
  const props = escanearPropriedades(original);

  const doPlano = (nome: string, pai: string): PropriedadeEncontrada => {
    const achadas = props.filter(
      (p) =>
        p.nome === nome &&
        p.caminho[p.caminho.length - 1] === pai &&
        p.caminho.includes(PLANO_MANTIDO)
    );
    if (achadas.length !== 1) {
      throw new Error(`esperava 1 propriedade "${nome}" sob "${pai}" no ${PLANO_MANTIDO}, achou ${achadas.length}`);
    }
    return achadas[0];
  };

  const ler = (prop: PropriedadeEncontrada): number[] => {
    const saida: number[] = [];
    for (let i = 0; i < prop.contagem; i++) {
      saida.push(
        prop.tipo === 'f'
          ? original.readFloatLE(prop.offsetValor + i * 4)
          : original.readInt32LE(prop.offsetValor + i * 4)
      );
    }
    return saida;
  };

  const propP = doPlano('p', 'mesh');
  const propN = doPlano('n', 'mesh');
  const propTa = doPlano('ta', 'mesh');
  const propU0 = doPlano('u0', 'mesh');
  const propTri = doPlano('tri', 'mesh');
  const propBones = doPlano('bones', 'skin');
  const propIx = doPlano('ix', 'skin');
  const propW = doPlano('w', 'skin');
  const propMin = doPlano('min', 'aabb');
  const propMax = doPlano('max', 'aabb');

  const p = ler(propP);
  const n = ler(propN);
  const ta = ler(propTa);
  const u0 = ler(propU0);
  const tri = ler(propTri);
  const ix = ler(propIx);
  const w = ler(propW);

  const nVertices = p.length / 3;
  if (!Number.isInteger(nVertices)) throw new Error(`array "p" com ${p.length} floats não é múltiplo de 3`);
  if (u0.length !== nVertices * 2) throw new Error(`"u0" tem ${u0.length} floats para ${nVertices} vértices`);
  if (n.length !== nVertices * 3) throw new Error(`"n" tem ${n.length} floats para ${nVertices} vértices`);
  if (ta.length !== nVertices * 4) throw new Error(`"ta" tem ${ta.length} floats para ${nVertices} vértices`);

  const influencias = ix.length / nVertices;
  if (!Number.isInteger(influencias) || w.length !== ix.length) {
    throw new Error(`skin inconsistente: ${ix.length} índices e ${w.length} pesos para ${nVertices} vértices`);
  }
  const bones = ler(propBones)[0];

  // Mantém quem está na linha de corte ou abaixo dela. A tolerância existe
  // porque os V de uma mesma linha não são bit a bit iguais no original.
  const manter: boolean[] = [];
  for (let v = 0; v < nVertices; v++) {
    manter.push(u0[v * 2 + 1] >= vDeCorte - TOLERANCIA_LINHA);
  }

  const novoIndice = new Map<number, number>();
  for (let v = 0; v < nVertices; v++) {
    if (manter[v]) novoIndice.set(v, novoIndice.size);
  }
  const nNovos = novoIndice.size;
  if (nNovos === nVertices) {
    throw new Error(`vDeCorte ${vDeCorte} não remove vértice nenhum — o corte seria um no-op`);
  }
  if (nNovos < 3) throw new Error(`vDeCorte ${vDeCorte} deixaria só ${nNovos} vértice(s)`);

  // A UV do que sobra volta a cobrir 0..1. Usa o V mínimo real dos vértices
  // mantidos (e não o vDeCorte teórico), para que a linha de corte caia
  // exatamente em V=0 mesmo com a variação bit a bit dentro da linha.
  let vMin = Infinity;
  for (let v = 0; v < nVertices; v++) if (manter[v]) vMin = Math.min(vMin, u0[v * 2 + 1]);
  const escala = 1 / (1 - vMin);

  const novoP: number[] = [];
  const novoN: number[] = [];
  const novoTa: number[] = [];
  const novoU0: number[] = [];
  const novoIx: number[] = [];
  const novoW: number[] = [];

  for (let v = 0; v < nVertices; v++) {
    if (!manter[v]) continue;
    novoP.push(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]);
    novoN.push(n[v * 3], n[v * 3 + 1], n[v * 3 + 2]);
    novoTa.push(ta[v * 4], ta[v * 4 + 1], ta[v * 4 + 2], ta[v * 4 + 3]);
    novoU0.push(u0[v * 2], (u0[v * 2 + 1] - vMin) * escala);
    for (let k = 0; k < influencias; k++) {
      novoIx.push(ix[v * influencias + k]);
      novoW.push(w[v * influencias + k]);
    }
  }

  // Um triângulo só sobrevive inteiro: descartar parcialmente criaria buraco
  // ou face degenerada.
  const novoTri: number[] = [];
  for (let t = 0; t < tri.length; t += 3) {
    const a = novoIndice.get(tri[t]);
    const b = novoIndice.get(tri[t + 1]);
    const c = novoIndice.get(tri[t + 2]);
    if (a === undefined || b === undefined || c === undefined) continue;
    novoTri.push(a, b, c);
  }
  if (novoTri.length === 0) throw new Error('o recorte não deixou nenhum triângulo');

  const eixos = [0, 1, 2].map((eixo) => {
    const valores: number[] = [];
    for (let v = 0; v < nNovos; v++) valores.push(novoP[v * 3 + eixo]);
    return { min: Math.min(...valores), max: Math.max(...valores) };
  });

  const resultado = reescreverPropriedades(original, [
    { prop: propP, valores: novoP },
    { prop: propN, valores: novoN },
    { prop: propTa, valores: novoTa },
    { prop: propU0, valores: novoU0 },
    { prop: propTri, valores: novoTri },
    { prop: propMin, valores: eixos.map((e) => e.min) },
    { prop: propMax, valores: eixos.map((e) => e.max) },
    { prop: propIx, valores: novoIx },
    { prop: propW, valores: novoW },
  ]);

  // Sanidade: o fluxo tem que continuar parseável, com as contagens coerentes
  // entre si — uma emenda errada corromperia tudo a partir dali em silêncio.
  const conferencia = escanearPropriedades(resultado).filter((x) =>
    x.caminho.includes(PLANO_MANTIDO)
  );
  const contagem = (nome: string, pai: string) =>
    conferencia.find((x) => x.nome === nome && x.caminho[x.caminho.length - 1] === pai)?.contagem;

  if (
    contagem('p', 'mesh') !== nNovos * 3 ||
    contagem('n', 'mesh') !== nNovos * 3 ||
    contagem('ta', 'mesh') !== nNovos * 4 ||
    contagem('u0', 'mesh') !== nNovos * 2 ||
    contagem('tri', 'mesh') !== novoTri.length ||
    contagem('ix', 'skin') !== nNovos * influencias ||
    contagem('w', 'skin') !== nNovos * influencias
  ) {
    throw new Error('após o recorte, as contagens não batem — a emenda corrompeu o fluxo');
  }
  const bonesDepois = conferencia.find(
    (x) => x.nome === 'bones' && x.caminho[x.caminho.length - 1] === 'skin'
  );
  if (!bonesDepois || resultado.readInt32LE(bonesDepois.offsetValor) !== bones) {
    throw new Error('a contagem de ossos por vértice mudou, o que não deveria acontecer');
  }

  return resultado;
}

/** Reescala o V de cada par (U, V) de um array de UV plano [u0,v0,u1,v1,...]:
 * planos que hoje usam a metade de baixo (V em [0, 0.5]) passam a usar o
 * canvas inteiro (V×2); os que usam a metade de cima (V em [0.5, 1]) também
 * passam a usar o canvas inteiro ((V−0.5)×2). U não muda (já é 0–1 nos seis). */
export function remapearUv(valores: Float32Array): Float32Array {
  const vs: number[] = [];
  for (let i = 1; i < valores.length; i += 2) vs.push(valores[i]);
  const media = vs.reduce((a, b) => a + b, 0) / vs.length;
  const usaMetadeDeBaixo = media < 0.5;

  const tolerancia = 0.02;
  for (const v of vs) {
    if (usaMetadeDeBaixo && v > 0.5 + tolerancia) {
      throw new Error(`array de UV supostamente na metade de baixo tem V=${v}, fora do esperado`);
    }
    if (!usaMetadeDeBaixo && v < 0.5 - tolerancia) {
      throw new Error(`array de UV supostamente na metade de cima tem V=${v}, fora do esperado`);
    }
  }

  const resultado = new Float32Array(valores.length);
  for (let i = 0; i < valores.length; i += 2) {
    const u = valores[i];
    const v = valores[i + 1];
    resultado[i] = u;
    resultado[i + 1] = usaMetadeDeBaixo ? v * 2 : (v - 0.5) * 2;
  }
  return resultado;
}

/** Aplica `remapearUv` a cada um dos arrays `u0` encontrados no `.mesh`,
 * devolvendo um buffer novo (não modifica `original`). Como a contagem de
 * floats não muda, o patch é in-place: todo o resto do arquivo permanece
 * byte a byte idêntico ao original. */
export function corrigirUvDoMesh(original: Buffer): Buffer {
  const arraysUv = acharArraysUv(original);
  if (arraysUv.length === 0) {
    throw new Error('nenhum array u0 encontrado sob object.pPlaneShapeN.mesh — o .mesh mudou de formato?');
  }

  const resultado = Buffer.from(original);

  for (const prop of arraysUv) {
    if (prop.tipo !== 'f') {
      throw new Error(`esperava u0 do tipo float ('f'), encontrou '${prop.tipo}'`);
    }

    const valoresOriginais = new Float32Array(prop.contagem);
    for (let i = 0; i < prop.contagem; i++) {
      valoresOriginais[i] = original.readFloatLE(prop.offsetValor + i * 4);
    }

    const valoresNovos = remapearUv(valoresOriginais);

    for (let i = 0; i < prop.contagem; i++) {
      resultado.writeFloatLE(valoresNovos[i], prop.offsetValor + i * 4);
    }
  }

  return resultado;
}
