import type { PortraitConfig } from '../generate-portraits/types';
import {
  OOP_ABERTURAS_BOCA,
  OOP_ANGULOS_VISTA,
  OOP_CORES_CABELO,
  OOP_CORES_OLHO,
  OOP_CORES_ROUPA,
  OOP_ESTILOS,
  OOP_ESTILOS_CABELO,
  OOP_ETNIAS,
  OOP_FORMAS_BOCA,
  OOP_FORMAS_CORPO,
  OOP_FORMAS_OLHO,
  OOP_GENEROS,
  OOP_POSES_BASE,
  OOP_POSES_MAO,
  OOP_POSES_PERNA,
  OOP_TAMANHOS_BOCA,
  OOP_TIPOS_ROUPA_INFERIOR,
  OOP_TIPOS_ROUPA_SUPERIOR,
  OOP_TIPOS_VISTA,
  type OOPCamposCompostos,
} from './oop-types';

export type GeneroAlvo = 'male' | 'female' | 'flat';

function validarEnum<T extends string>(
  valor: T | undefined,
  opcoes: readonly T[],
  campo: string,
  rotulo: string
): string[] {
  if (valor === undefined) return [];
  if (!opcoes.includes(valor)) {
    return [`${rotulo}: "${campo}" tem valor "${valor}", que não é uma opção válida do node OOP correspondente`];
  }
  return [];
}

/** Confere que todo campo presente (em qualquer seção) é um valor aceito
 * pelo combo real do node OOP correspondente — os arrays em `oop-types.ts`
 * foram extraídos direto do `object_info` do ComfyUI, então isto pega erro de
 * digitação antes de queimar uma geração inteira com um valor que a API
 * rejeitaria (ou pior, aceitaria silenciosamente com outro comportamento). */
function validarCampos(campos: OOPCamposCompostos, rotulo: string): string[] {
  const erros: string[] = [];

  if (campos.person) {
    const { age, body_shape, ethnicity, gender } = campos.person;
    if (age !== undefined && (!Number.isFinite(age) || age <= 0)) {
      erros.push(`${rotulo}: "person.age" precisa ser um número positivo, recebeu ${age}`);
    }
    erros.push(...validarEnum(body_shape, OOP_FORMAS_CORPO, 'person.body_shape', rotulo));
    erros.push(...validarEnum(ethnicity, OOP_ETNIAS, 'person.ethnicity', rotulo));
    erros.push(...validarEnum(gender, OOP_GENEROS, 'person.gender', rotulo));
  }
  if (campos.hair) {
    erros.push(...validarEnum(campos.hair.style, OOP_ESTILOS_CABELO, 'hair.style', rotulo));
    erros.push(...validarEnum(campos.hair.main_color, OOP_CORES_CABELO, 'hair.main_color', rotulo));
    erros.push(...validarEnum(campos.hair.optional_color, OOP_CORES_CABELO, 'hair.optional_color', rotulo));
  }
  if (campos.eyes) {
    erros.push(...validarEnum(campos.eyes.shape, OOP_FORMAS_OLHO, 'eyes.shape', rotulo));
    erros.push(...validarEnum(campos.eyes.color, OOP_CORES_OLHO, 'eyes.color', rotulo));
  }
  if (campos.mouth) {
    erros.push(...validarEnum(campos.mouth.shape, OOP_FORMAS_BOCA, 'mouth.shape', rotulo));
    erros.push(...validarEnum(campos.mouth.size, OOP_TAMANHOS_BOCA, 'mouth.size', rotulo));
    erros.push(...validarEnum(campos.mouth.opening, OOP_ABERTURAS_BOCA, 'mouth.opening', rotulo));
  }
  if (campos.clothing) {
    erros.push(...validarEnum(campos.clothing.upper_type, OOP_TIPOS_ROUPA_SUPERIOR, 'clothing.upper_type', rotulo));
    erros.push(...validarEnum(campos.clothing.lower_type, OOP_TIPOS_ROUPA_INFERIOR, 'clothing.lower_type', rotulo));
    erros.push(...validarEnum(campos.clothing.upper_color, OOP_CORES_ROUPA, 'clothing.upper_color', rotulo));
    erros.push(...validarEnum(campos.clothing.lower_color, OOP_CORES_ROUPA, 'clothing.lower_color', rotulo));
  }
  if (campos.pose) {
    erros.push(...validarEnum(campos.pose.base_pose, OOP_POSES_BASE, 'pose.base_pose', rotulo));
    erros.push(...validarEnum(campos.pose.hand_pose, OOP_POSES_MAO, 'pose.hand_pose', rotulo));
    erros.push(...validarEnum(campos.pose.leg_pose, OOP_POSES_PERNA, 'pose.leg_pose', rotulo));
  }
  if (campos.style) {
    erros.push(...validarEnum(campos.style.base_style, OOP_ESTILOS, 'style.base_style', rotulo));
    erros.push(...validarEnum(campos.style.second_style, OOP_ESTILOS, 'style.second_style', rotulo));
  }
  if (campos.view) {
    erros.push(...validarEnum(campos.view.angle, OOP_ANGULOS_VISTA, 'view.angle', rotulo));
    erros.push(...validarEnum(campos.view.viewType, OOP_TIPOS_VISTA, 'view.viewType', rotulo));
  }

  return erros;
}

/** Confere que as chaves de `variantes` são exatamente "001".."NNN",
 * zero-padded a 3 dígitos, sequenciais e sem buracos — mesma convenção (e
 * mesmo raciocínio) de `validarSequencia` em `generate-portraits/validation.ts`,
 * porque o índice da variante é o nome final do PNG depois do `--promote`. */
function validarChavesVariantes(chaves: string[], esperado: number, rotulo: string): string[] {
  const erros: string[] = [];
  const ordenadas = [...chaves].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (ordenadas.length !== esperado) {
    erros.push(
      `${rotulo}: contagem declarada (${esperado}) não bate com o número de variantes (${ordenadas.length})`
    );
    return erros;
  }

  ordenadas.forEach((chave, index) => {
    const esperada = String(index + 1).padStart(3, '0');
    if (chave !== esperada) {
      erros.push(
        `${rotulo}: esperava a variante "${esperada}" na posição ${index}, encontrou "${chave}" — chaves precisam ser sequenciais e zero-padded a 3 dígitos, sem buracos`
      );
    }
  });

  return erros;
}

/** Valida o bloco `geracaoArt` de uma espécie para um gênero-alvo específico
 * — chamada pelo `generate-art` antes de gerar ou promover qualquer imagem.
 * Não faz parte de `validarEspecie` (`generate-portraits/validation.ts`)
 * porque `bun run portrait` não depende de `geracaoArt` em nada: só lê PNGs
 * já existentes. */
export function validarGeracaoArt(config: PortraitConfig, slug: string, genero: GeneroAlvo): string[] {
  const erros: string[] = [];

  if (!config.geracaoArt) {
    return [`${slug}: portrait.json não declara "geracaoArt" — nada a gerar`];
  }

  erros.push(...validarCampos(config.geracaoArt.base, `${slug}: geracaoArt.base`));

  const bloco = config.geracaoArt[genero];
  if (!bloco) {
    erros.push(`${slug}: portrait.json não declara "geracaoArt.${genero}"`);
    return erros;
  }

  erros.push(...validarCampos(bloco, `${slug}: geracaoArt.${genero}`));

  const esperado = config.counts[genero] ?? -1;
  const chaves = Object.keys(bloco.variantes ?? {});
  erros.push(...validarChavesVariantes(chaves, esperado, `${slug}: geracaoArt.${genero}.variantes`));

  for (const [chave, campos] of Object.entries(bloco.variantes ?? {})) {
    erros.push(...validarCampos(campos, `${slug}: geracaoArt.${genero}.variantes.${chave}`));
  }

  return erros;
}
