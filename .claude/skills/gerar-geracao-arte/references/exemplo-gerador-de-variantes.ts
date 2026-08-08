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
// A forma de saída por variante (`{ person, hair, eyes }`) não mudou entre o
// schema antigo (OOP) e o atual (scripts/portrait-schema/) — só campos como
// `tipo`/`torso`/`extra_prompt` mudaram de forma, e esses normalmente vivem
// em `geracaoArt.base` (uma vez por espécie), não por indivíduo, então este
// gerador não precisa tocar neles.

const ETNIAS = ['Caucasian', 'African', 'Asian', 'Latino', 'Pacific'] as const; // ou só ['Alien'] pra espécie não-humana
const ESTILOS_CABELO = ['Short', 'Long', 'Wavy', 'Curly', 'Straight', 'Ponytail', 'Braided', 'Bun', 'Spiky', 'Undercut'] as const; // sem 'Bald' se a espécie não deve ter careca
const CORES_CABELO = ['Black', 'Brown', 'Blonde', 'Red', 'Gray', 'White', 'Silver', 'Copper', 'Charcoal', 'Blue', 'Teal'] as const; // mistura de natural + poucas tingidas
const FORMAS_OLHO = ['Round', 'Almond', 'Hooded', 'Monolid', 'Upturned', 'Downturned', 'Oval'] as const;
const CORES_OLHO = ['Blue', 'Green', 'Brown', 'Hazel', 'Gray', 'Amber', 'Violet'] as const;
const FORMAS_CORPO = ['Slim', 'Athletic', 'Average', 'Curvy', 'Muscular', 'Hourglass'] as const;

// RNG determinístico (xorshift32) — mesma seed sempre produz a mesma
// sequência, então o resultado é reproduzível entre rodadas.
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
      hair: { style: estiloCabelo, main_color: corCabelo },
      eyes: { shape: formaOlho, color: corOlho },
    };
  }
  return variantes;
}

const male = gerarVariantes('male', 12345, 25, FORMAS_CORPO.filter((f) => f !== 'Hourglass' && f !== 'Curvy'));
const female = gerarVariantes('female', 98765, 25, FORMAS_CORPO.filter((f) => f !== 'Muscular'));

console.log(JSON.stringify({ male, female }, null, 2));
