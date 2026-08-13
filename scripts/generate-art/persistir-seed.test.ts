import { describe, expect, test } from 'bun:test';
import { aplicarSeed } from './persistir-seed';

/** Espelha a forma real de um `portrait.json` no que importa aqui: a seed
 * mora fundo (`geracaoArt.<gênero>.variantes.<NNN>.seed`) e convive com
 * chaves irmãs que não podem se mexer de lugar. */
const PORTRAIT_JSON = `{
  "name": "astral",
  "gendered": true,
  "rig": "ssm_shared",
  "counts": {
    "male": 2
  },
  "geracaoArt": {
    "base": {
      "eyes": {
        "color": "Violet"
      }
    },
    "male": {
      "variantes": {
        "001": {
          "person": {
            "age": 30
          },
          "seed": 111
        },
        "002": {
          "person": {
            "age": 40
          }
        }
      }
    }
  }
}
`;

describe('aplicarSeed', () => {
  test('substitui a seed de uma variante que já tinha uma', () => {
    const resultado = JSON.parse(aplicarSeed(PORTRAIT_JSON, 'male', '001', 999));
    expect(resultado.geracaoArt.male.variantes['001'].seed).toBe(999);
  });

  test('insere a seed numa variante que ainda não tinha', () => {
    const resultado = JSON.parse(aplicarSeed(PORTRAIT_JSON, 'male', '002', 777));
    expect(resultado.geracaoArt.male.variantes['002'].seed).toBe(777);
  });

  test('não encosta em nenhum outro campo do arquivo', () => {
    const antes = JSON.parse(PORTRAIT_JSON);
    const depois = JSON.parse(aplicarSeed(PORTRAIT_JSON, 'male', '002', 777));
    delete depois.geracaoArt.male.variantes['002'].seed;
    expect(depois).toEqual(antes);
  });

  test('preserva a ordem original das chaves — sem isso o diff vira o arquivo inteiro', () => {
    const saida = aplicarSeed(PORTRAIT_JSON, 'male', '001', 999);
    expect(Object.keys(JSON.parse(saida))).toEqual(['name', 'gendered', 'rig', 'counts', 'geracaoArt']);
    // A seed nova entra no lugar da antiga, não no fim do bloco da variante.
    expect(Object.keys(JSON.parse(saida).geracaoArt.male.variantes['001'])).toEqual(['person', 'seed']);
  });

  test('mantém o formato dos portrait.json do repo: 2 espaços e newline final', () => {
    const saida = aplicarSeed(PORTRAIT_JSON, 'male', '001', 111);
    // Mesma seed que já estava lá: a saída tem que ser o arquivo de volta,
    // byte a byte. É esse round-trip que garante um diff de uma linha só.
    expect(saida).toBe(PORTRAIT_JSON);
  });

  test('falha alto quando a variante não existe, em vez de criar lixo no arquivo', () => {
    expect(() => aplicarSeed(PORTRAIT_JSON, 'male', '099', 1)).toThrow('geracaoArt.male.variantes.099');
    expect(() => aplicarSeed(PORTRAIT_JSON, 'female', '001', 1)).toThrow('geracaoArt.female.variantes.001');
  });
});
