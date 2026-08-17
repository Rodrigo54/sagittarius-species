// Exemplo de referência (não é um script genérico pra rodar direto) — adapte os
// pools e a lógica pra cada espécie nova, em vez de escrever N blocos de
// variante à mão. É "espaço determinístico": a mesma pergunta ("gera 25
// combinações sem repetir etnia+cabelo+olho") tem resposta mecânica, então
// vira código, não N decisões criativas repetidas manualmente.
//
// Este é o gerador real usado pra `ssm_default` (a espécie humana), preservado
// aqui como modelo de estrutura — troque os arrays de pool pelos que a
// entrevista da skill decidiu pra espécie em questão (podem ser bem
// diferentes: uma espécie de moluscos não tem "hair", uma espécie flat não
// tem "gender" por variante, etc.).
//
// A forma de saída por variante é `{ person, hair, eyes }` — e `torso` quando a
// cor da vestimenta varia por indivíduo (sorteie `primary_color`/
// `secondary_color` como qualquer outro pool). `species` e o texto das seções
// (`template`) vivem em `geracaoArt.base`, uma vez por espécie, então este
// gerador não toca neles: ele produz só os VALORES que o template da base vai
// posicionar no prompt.
//
// Uma cor sorteada aqui precisa estar citada por algum template — a validação
// reprova campo declarado que nenhum template referencia. Se a espécie sorteia
// `torso.secondary_color`, o template da base tem que ter um
// `<torso.secondary_color>` (dentro de colchetes, se nem toda variante o
// receber).
//
// O que este gerador NUNCA emite é `seed`: ela descreve a imagem que está em
// disco, não a receita, e é o `bun run art --seed` quem a grava. Por isso a
// etapa de injeção no fim do arquivo mescla POR ÍNDICE, preservando a `seed`
// de cada variante que já tiver uma — apagá-la não quebra validação nenhuma,
// só faz a próxima execução gerar outra imagem no lugar de uma já aprovada,
// em silêncio.

import { readFile, writeFile } from 'node:fs/promises';

// ---------------------------------------------------------------------------
// Pools: o SUBCONJUNTO temático decidido na entrevista, não o enum. A lista de
// valores válidos está em `scripts/portrait-schema/vocabulario.ts` — confira lá
// antes de escrever qualquer valor (vários enums têm valores compostos, ex.
// `"Short Curly"`/`"Long Wavy"` em ESTILOS_CABELO). Valor fora do enum é erro
// de validação na leitura do arquivo, não um sorteio que "quase funciona".
// ---------------------------------------------------------------------------

const ETNIAS = ['Caucasian', 'African', 'Asian', 'Latino', 'Pacific'] as const; // ou omitir o campo inteiro pra espécie não-humanoide
const ESTILOS_CABELO = ['Short', 'Long', 'Wavy', 'Curly', 'Straight', 'Ponytail', 'Braided', 'Bun', 'Spiky', 'Undercut'] as const; // sem 'Bald' se a espécie não deve ter careca
const CORES_CABELO = ['Black', 'Brown', 'Blonde', 'Red', 'Gray', 'White', 'Silver', 'Copper', 'Charcoal', 'Blue', 'Teal'] as const; // mistura de natural + poucas tingidas
const FORMAS_OLHO = ['Round', 'Almond', 'Hooded', 'Monolid', 'Upturned', 'Downturned', 'Oval'] as const;
const CORES_OLHO = ['Blue', 'Green', 'Brown', 'Hazel', 'Gray', 'Amber', 'Violet'] as const;
const FORMAS_CORPO = ['Slim', 'Athletic', 'Average', 'Curvy', 'Muscular', 'Hourglass'] as const;

// RNG determinístico (xorshift32) — mesma seed sempre produz a mesma
// sequência, então o resultado é reproduzível entre rodadas. Nada a ver com a
// `seed` de geração de imagem: esta aqui sorteia a RECEITA, aquela fixa o
// ruído do sampler.
function rngDeterministico(seedInicial: number) {
  let s = seedInicial >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0xffffffff;
  };
}

function escolher<T>(arr: readonly T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length)]!;
}

function gerarVariantes(genero: 'male' | 'female', seedBase: number, quantidade: number, corpoPeso: readonly string[]) {
  const variantes: Record<string, unknown> = {};
  const usados = new Set<string>();
  for (let i = 1; i <= quantidade; i++) {
    const r = rngDeterministico(seedBase + i * 2654435761); // constante Knuth p/ espalhar a seed por índice
    let etnia: string, corCabelo: string, corOlho: string, formaOlho: string, estiloCabelo: string, chave: string;
    do {
      etnia = escolher(ETNIAS, r);
      corCabelo = escolher(CORES_CABELO, r);
      corOlho = escolher(CORES_OLHO, r);
      formaOlho = escolher(FORMAS_OLHO, r);
      estiloCabelo = escolher(ESTILOS_CABELO, r);
      chave = `${etnia}-${corCabelo}-${corOlho}`; // evita repetir a MESMA combinação de identidade visual
    } while (usados.has(chave));
    usados.add(chave);

    const idade = 20 + Math.floor(r() * 10); // ajuste a faixa conforme a entrevista (aqui: 20-29)
    const corpo = escolher(corpoPeso, r);

    variantes[String(i).padStart(3, '0')] = {
      person: { age: idade, ethnicity: etnia, body_shape: corpo },
      hair: { style: estiloCabelo, primary_color: corCabelo },
      eyes: { shape: formaOlho, color: corOlho },
    };
  }
  return variantes;
}

// ---------------------------------------------------------------------------
// Injeção no portrait.json — a metade que costuma ser feita à mão e é onde a
// `seed` se perde. Mescla por índice sobre o que já existe:
//   - variante gerada agora + `seed` que já estava gravada => a seed sobrevive;
//   - variante que este lote não gerou => fica intacta (permite regenerar só o
//     subconjunto que a mudança afeta, sem mexer nos outros 20 indivíduos);
//   - variante nova sem seed anterior => entra sem `seed`, e o pipeline usa o
//     hash determinístico até alguém rodar `--seed`.
// ---------------------------------------------------------------------------

type Variantes = Record<string, Record<string, unknown>>;

async function injetar(caminho: string, novasPorGenero: Record<string, Variantes>): Promise<void> {
  const config = JSON.parse(await readFile(caminho, 'utf8'));

  for (const [genero, novas] of Object.entries(novasPorGenero)) {
    const bloco = config.geracaoArt?.[genero];
    if (!bloco) throw new Error(`geracaoArt.${genero} não existe em ${caminho} — crie o bloco antes de injetar variantes.`);

    const anteriores: Variantes = bloco.variantes ?? {};
    const mescladas: Variantes = { ...anteriores };

    for (const [chave, nova] of Object.entries(novas)) {
      const seed = anteriores[chave]?.seed;
      mescladas[chave] = seed === undefined ? nova : { ...nova, seed };
    }

    // Reordena numericamente: o schema exige "001".."NNN" sequenciais, e um
    // arquivo estável rende diff legível.
    bloco.variantes = Object.fromEntries(
      Object.entries(mescladas).sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    );
  }

  // 2 espaços + newline final: convenção de `.json` no .editorconfig do repo.
  await writeFile(caminho, `${JSON.stringify(config, null, 2)}\n`);
}

const male = gerarVariantes('male', 12345, 25, FORMAS_CORPO.filter((f) => f !== 'Hourglass' && f !== 'Curvy'));
const female = gerarVariantes('female', 98765, 25, FORMAS_CORPO.filter((f) => f !== 'Muscular'));

// O caminho é placeholder de propósito: rodar este arquivo como está falha com
// ENOENT em vez de sobrescrever a espécie que serviu de modelo. Troque pelo
// slug da espécie da vez ao adaptar.
await injetar('assets/portraits/ssm_<especie>/portrait.json', { male, female } as Record<string, Variantes>);
