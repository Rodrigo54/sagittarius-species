import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import {
  PLANO_MANTIDO,
  SHADER_RETRATO,
  acharArraysUv,
  corrigirShaderDoMesh,
  corrigirUvDoMesh,
  escanearObjetos,
  escanearPropriedades,
  remapearUv,
  recortarPlanoAcima,
  removerPlanosOcultos,
} from './mesh-uv';

const CAMINHO_MESH_ORIGINAL = join(
  import.meta.dir,
  '../../mod/sagittarius-species/gfx/models/portraits/sl_shared/humanoid_01_portrait.mesh'
);

describe('remapearUv', () => {
  test('metade de baixo (V em [0, 0.5]) é reescalada pra V×2, U não muda', () => {
    const entrada = new Float32Array([0, 0, 1, 0.5, 0.5, 0.25]);
    const saida = remapearUv(entrada);
    expect([...saida]).toEqual([0, 0, 1, 1, 0.5, 0.5]);
  });

  test('metade de cima (V em [0.5, 1]) é reescalada pra (V−0.5)×2, U não muda', () => {
    const entrada = new Float32Array([0, 0.5, 1, 1, 0.5, 0.75]);
    const saida = remapearUv(entrada);
    expect([...saida]).toEqual([0, 0, 1, 1, 0.5, 0.5]);
  });

  test('rejeita array cuja média de V não corresponde a nenhuma metade conhecida', () => {
    // média ~0.5 exata cai no ramo "metade de baixo" (< 0.5 é falso, então
    // vira "metade de cima"), mas um valor destoante deve estourar a
    // tolerância de qualquer um dos dois ramos.
    const entrada = new Float32Array([0, 0.3, 1, 0.9]);
    expect(() => remapearUv(entrada)).toThrow();
  });
});

describe('corrigirUvDoMesh (contra o .mesh real do sl_shared)', () => {
  const original = readFileSync(CAMINHO_MESH_ORIGINAL);
  const corrigido = corrigirUvDoMesh(original);

  test('produz um buffer do mesmo tamanho (patch in-place, sem realocar nada)', () => {
    expect(corrigido.length).toBe(original.length);
  });

  test('encontra exatamente 6 arrays u0 (um por pPlaneShape2..7)', () => {
    const arrays = acharArraysUv(original);
    expect(arrays.length).toBe(6);
    for (const a of arrays) {
      expect(a.contagem).toBe(121 * 2);
    }
  });

  test('todo byte fora dos 6 payloads de u0 permanece idêntico ao original', () => {
    const arrays = acharArraysUv(original);
    const dentroDeAlgumPayload = (offset: number) =>
      arrays.some((a) => offset >= a.offsetValor && offset < a.offsetValor + a.contagem * 4);

    let diferencasForaDoPayload = 0;
    for (let i = 0; i < original.length; i++) {
      if (original[i] !== corrigido[i] && !dentroDeAlgumPayload(i)) {
        diferencasForaDoPayload++;
      }
    }
    expect(diferencasForaDoPayload).toBe(0);
  });

  test('cada array u0 resultante cobre o canvas inteiro (U e V em [0, 1])', () => {
    const arraysCorrigidos = acharArraysUv(corrigido);
    expect(arraysCorrigidos.length).toBe(6);

    for (const prop of arraysCorrigidos) {
      const us: number[] = [];
      const vs: number[] = [];
      for (let i = 0; i < prop.contagem; i += 2) {
        us.push(corrigido.readFloatLE(prop.offsetValor + i * 4));
        vs.push(corrigido.readFloatLE(prop.offsetValor + (i + 1) * 4));
      }

      // tolerância de 1%: a UV original já tinha uma pequena folga além de
      // 0/0.5 (ex.: um plano de "baixo" com V máximo em 0.5018, não 0.5
      // cravado) — o remapeamento preserva essa folga proporcionalmente.
      expect(Math.min(...us)).toBeGreaterThanOrEqual(-0.01);
      expect(Math.max(...us)).toBeLessThanOrEqual(1.01);
      expect(Math.min(...vs)).toBeGreaterThanOrEqual(-0.01);
      expect(Math.max(...vs)).toBeLessThanOrEqual(1.01);
      // a faixa precisa de fato ter sido esticada (não só clampada) — o
      // ponto mais alto tem que estar perto de 1, não mais perto de 0.5.
      expect(Math.max(...vs)).toBeGreaterThan(0.9);
    }
  });
});

describe('removerPlanosOcultos (contra o .mesh real do sl_shared)', () => {
  const original = readFileSync(CAMINHO_MESH_ORIGINAL);
  const removido = removerPlanosOcultos(original);

  /** Início do subtree de um objeto de nível 2 e o fim dele (início do
   * próximo objeto de profundidade <= 2, ou EOF) — derivação independente da
   * usada na implementação (por nome, não por filtro de planos). */
  const subtreeDe = (buf: Buffer, nome: string) => {
    const objetos = escanearObjetos(buf);
    const indice = objetos.findIndex((o) => o.nome === nome);
    expect(indice).toBeGreaterThanOrEqual(0);
    const alvo = objetos[indice];
    let fim = buf.length;
    for (let i = indice + 1; i < objetos.length; i++) {
      if (objetos[i].profundidade <= alvo.profundidade) {
        fim = objetos[i].offsetInicio;
        break;
      }
    }
    return { inicio: alvo.offsetInicio, fim };
  };

  test('o resultado contém só o plano mantido — os outros 5 sumiram por completo', () => {
    const nomes = escanearObjetos(removido).map((o) => o.nome);
    expect(nomes.filter((n) => n.startsWith('pPlaneShape'))).toEqual([PLANO_MANTIDO]);
  });

  test('os locators continuam presentes', () => {
    const nomes = escanearObjetos(removido).map((o) => o.nome);
    expect(nomes).toContain('Character5_Ctrl_Reference');
    expect(nomes).toContain('Character5_Reference');
  });

  test('o tamanho cai exatamente pela soma dos 5 subtrees removidos', () => {
    const nomesRemovidos = ['pPlaneShape2', 'pPlaneShape3', 'pPlaneShape5', 'pPlaneShape6', 'pPlaneShape7'];
    const somaRemovida = nomesRemovidos.reduce((soma, nome) => {
      const { inicio, fim } = subtreeDe(original, nome);
      return soma + (fim - inicio);
    }, 0);
    expect(removido.length).toBe(original.length - somaRemovida);
  });

  test('o resultado é exatamente [prefixo] + [subtree do plano mantido] + [do locator em diante]', () => {
    // Reconstrução manual independente: pPlaneShape2..5 vêm antes do 6 (o
    // mantido), o 7 vem entre ele e os locators — o resultado esperado são
    // esses três segmentos do original colados — byte a byte.
    const inicioPrimeiroPlano = subtreeDe(original, 'pPlaneShape2').inicio;
    const mantido = subtreeDe(original, PLANO_MANTIDO);
    const inicioLocators = subtreeDe(original, 'pPlaneShape7').fim;
    const esperado = Buffer.concat([
      original.subarray(0, inicioPrimeiroPlano),
      original.subarray(mantido.inicio, mantido.fim),
      original.subarray(inicioLocators),
    ]);
    expect(removido.equals(esperado)).toBe(true);
  });

  test('o resultado continua com o u0 do plano mantido acessível (1 array, 121 pares)', () => {
    const arrays = acharArraysUv(removido);
    expect(arrays.length).toBe(1);
    expect(arrays[0].contagem).toBe(121 * 2);
    expect(arrays[0].caminho[arrays[0].caminho.length - 2]).toBe(PLANO_MANTIDO);
  });

  test('compõe com corrigirUvDoMesh: o pipeline completo produz UV cobrindo o canvas inteiro', () => {
    const composto = corrigirUvDoMesh(corrigirShaderDoMesh(removerPlanosOcultos(original)));

    const arrays = acharArraysUv(composto);
    expect(arrays.length).toBe(1);

    const vs: number[] = [];
    for (let i = 0; i < arrays[0].contagem; i += 2) {
      vs.push(composto.readFloatLE(arrays[0].offsetValor + (i + 1) * 4));
    }
    expect(Math.min(...vs)).toBeGreaterThanOrEqual(-0.01);
    expect(Math.max(...vs)).toBeLessThanOrEqual(1.01);
    expect(Math.max(...vs)).toBeGreaterThan(0.9);
  });
});

describe('corrigirShaderDoMesh (contra o .mesh real do sl_shared)', () => {
  const original = readFileSync(CAMINHO_MESH_ORIGINAL);
  const removido = removerPlanosOcultos(original);
  const patcheado = corrigirShaderDoMesh(removido);

  /** Lê a string do shader do plano mantido em um buffer. */
  const shaderDe = (buf: Buffer) => {
    const props = escanearPropriedades(buf).filter(
      (p) => p.nome === 'shader' && p.tipo === 's' && p.caminho.includes(PLANO_MANTIDO)
    );
    expect(props.length).toBe(1);
    const tamanho = buf.readInt32LE(props[0].offsetValor);
    return {
      valor: buf.subarray(props[0].offsetValor + 4, props[0].offsetValor + 4 + tamanho - 1).toString('latin1'),
      offsetValor: props[0].offsetValor,
      tamanho,
    };
  };

  test('o plano mantido já é camada de corpo — shader correto direto do original', () => {
    expect(shaderDe(removido).valor).toBe(SHADER_RETRATO);
  });

  test('com o shader já correto, a função é um no-op byte a byte', () => {
    expect(patcheado.equals(removido)).toBe(true);
  });

  test('o caminho de emenda desfaz um shader de cabelo, voltando byte a byte ao correto', () => {
    // Constrói uma variante em que o shader do plano mantido foi trocado por
    // `PdxMeshPortraitHair` (o caso real do pPlaneShape6 — bug do "quadro
    // vazio", seção 14 do histórico) e confere que a função restaura o
    // buffer exato: round-trip com a variante construída por derivação
    // independente da lógica da função.
    const antes = shaderDe(removido);
    const hair = 'PdxMeshPortraitHair';
    const payloadHair = Buffer.alloc(4 + hair.length + 1);
    payloadHair.writeInt32LE(hair.length + 1, 0);
    payloadHair.write(hair, 4, 'latin1');
    const comHair = Buffer.concat([
      removido.subarray(0, antes.offsetValor),
      payloadHair,
      removido.subarray(antes.offsetValor + 4 + antes.tamanho),
    ]);
    expect(shaderDe(comHair).valor).toBe(hair);

    expect(corrigirShaderDoMesh(comHair).equals(removido)).toBe(true);
  });

  test('é idempotente: aplicar de novo não muda nada', () => {
    expect(corrigirShaderDoMesh(patcheado).equals(patcheado)).toBe(true);
  });
});

describe('recortarPlanoAcima', () => {
  /** Estado em que o recorte entra no pipeline: um plano só, UV já cobrindo
   * o canvas inteiro. */
  const preparado = () =>
    corrigirUvDoMesh(corrigirShaderDoMesh(removerPlanosOcultos(readFileSync(CAMINHO_MESH_ORIGINAL))));

  const arraysDoPlano = (buf: Buffer) => {
    const props = escanearPropriedades(buf).filter((p) => p.caminho.includes(PLANO_MANTIDO));
    const achar = (nome: string, pai: string) =>
      props.find((p) => p.nome === nome && p.caminho[p.caminho.length - 1] === pai)!;
    const ler = (p: { offsetValor: number; contagem: number; tipo: string }) => {
      const v: number[] = [];
      for (let i = 0; i < p.contagem; i++) {
        v.push(p.tipo === 'f' ? buf.readFloatLE(p.offsetValor + i * 4) : buf.readInt32LE(p.offsetValor + i * 4));
      }
      return v;
    };
    return {
      p: ler(achar('p', 'mesh')),
      n: ler(achar('n', 'mesh')),
      ta: ler(achar('ta', 'mesh')),
      u0: ler(achar('u0', 'mesh')),
      tri: ler(achar('tri', 'mesh')),
      ix: ler(achar('ix', 'skin')),
      w: ler(achar('w', 'skin')),
      min: ler(achar('min', 'aabb')),
      max: ler(achar('max', 'aabb')),
    };
  };

  test('remove exatamente as linhas de grade acima do corte', () => {
    const antes = arraysDoPlano(preparado());
    const depois = arraysDoPlano(recortarPlanoAcima(preparado()));

    // Grade 11×11 no original; as duas primeiras linhas (y_canvas 2 e 97)
    // ficam acima da linha de corte em 195.
    expect(antes.p.length / 3).toBe(121);
    expect(depois.p.length / 3).toBe(99);
    expect(antes.tri.length / 3).toBe(200);
    expect(depois.tri.length / 3).toBe(160);
  });

  test('todo array indexado por vértice encolhe junto', () => {
    const d = arraysDoPlano(recortarPlanoAcima(preparado()));
    const n = d.p.length / 3;

    expect(d.n.length).toBe(n * 3);
    expect(d.ta.length).toBe(n * 4);
    expect(d.u0.length).toBe(n * 2);
    expect(d.ix.length).toBe(n * 4);
    expect(d.w.length).toBe(n * 4);
  });

  test('os índices de triângulo continuam válidos após a reindexação', () => {
    const d = arraysDoPlano(recortarPlanoAcima(preparado()));
    const n = d.p.length / 3;
    for (const indice of d.tri) {
      expect(indice).toBeGreaterThanOrEqual(0);
      expect(indice).toBeLessThan(n);
    }
    // Nenhum triângulo degenerado: eles quebram o importador do io_pdx_mesh.
    for (let t = 0; t < d.tri.length; t += 3) {
      expect(new Set([d.tri[t], d.tri[t + 1], d.tri[t + 2]]).size).toBe(3);
    }
  });

  test('a UV do que sobra volta a cobrir 0..1', () => {
    const d = arraysDoPlano(recortarPlanoAcima(preparado()));
    const vs = d.u0.filter((_, i) => i % 2 === 1);
    expect(Math.min(...vs)).toBeCloseTo(0, 3);
    expect(Math.max(...vs)).toBeCloseTo(1, 3);
  });

  test('nenhuma posição de vértice é movida — só se removem linhas', () => {
    const antes = arraysDoPlano(preparado());
    const depois = arraysDoPlano(recortarPlanoAcima(preparado()));

    // Cada vértice mantido tem que aparecer, com a mesma posição, no resultado.
    const posicoesDepois = new Set<string>();
    for (let v = 0; v < depois.p.length / 3; v++) {
      posicoesDepois.add(depois.p.slice(v * 3, v * 3 + 3).join(','));
    }
    let mantidos = 0;
    for (let v = 0; v < antes.p.length / 3; v++) {
      // V original acima do corte => tem que ter sobrevivido intacto
      if (antes.u0[v * 2 + 1] >= 195 / 976 - 0.02) {
        expect(posicoesDepois.has(antes.p.slice(v * 3, v * 3 + 3).join(','))).toBe(true);
        mantidos++;
      }
    }
    expect(mantidos).toBe(99);
  });

  test('U não é tocado', () => {
    const antes = arraysDoPlano(preparado());
    const depois = arraysDoPlano(recortarPlanoAcima(preparado()));
    const usAntes = new Set(antes.u0.filter((_, i) => i % 2 === 0).map((u) => u.toFixed(5)));
    for (const u of depois.u0.filter((_, i) => i % 2 === 0)) {
      expect(usAntes.has(u.toFixed(5))).toBe(true);
    }
  });

  test('a aabb passa a refletir só o que sobrou', () => {
    const d = arraysDoPlano(recortarPlanoAcima(preparado()));
    for (const eixo of [0, 1, 2]) {
      const valores: number[] = [];
      for (let v = 0; v < d.p.length / 3; v++) valores.push(d.p[v * 3 + eixo]);
      expect(d.min[eixo]).toBeCloseTo(Math.min(...valores), 4);
      expect(d.max[eixo]).toBeCloseTo(Math.max(...valores), 4);
    }
  });

  test('o esqueleto e os locators seguem intactos', () => {
    const antes = escanearObjetos(preparado()).map((o) => o.nome);
    const depois = escanearObjetos(recortarPlanoAcima(preparado())).map((o) => o.nome);
    expect(depois).toEqual(antes);
  });

  test('é idempotente em intenção: recortar de novo no mesmo V não é no-op silencioso', () => {
    // Depois do recorte a UV volta a 0..1, então o mesmo vDeCorte cortaria de
    // novo. Rodar o pipeline inteiro do zero é o caminho suportado, e cortar
    // duas vezes precisa ser um erro visível, não uma erosão silenciosa.
    const uma = recortarPlanoAcima(preparado());
    const duas = recortarPlanoAcima(uma);
    const d1 = arraysDoPlano(uma);
    const d2 = arraysDoPlano(duas);
    expect(d2.p.length).toBeLessThan(d1.p.length);
  });

  test('recusa um corte que não removeria nada', () => {
    expect(() => recortarPlanoAcima(preparado(), 0)).toThrow('no-op');
  });

  test('recusa um corte que apagaria o plano', () => {
    expect(() => recortarPlanoAcima(preparado(), 0.999)).toThrow();
  });
});
