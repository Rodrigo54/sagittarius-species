import { open } from 'node:fs/promises';
import { basename } from 'node:path';
import { generosDe, quantidadeDe } from '../portrait-schema';
import { pad } from '../utils';
import { medirInicioDoCorpo, medirTrims, resolverGuia, validarEnquadramento } from './framing';
import { rigDe } from './types';
import { type SpeciesInfo } from '../shared/species';

/** Confere que os arquivos são exatamente "001.png".."NNN.png", zero-padded a 3
 * dígitos, sequenciais e sem buracos — é a convenção que a lista
 * character_textures gerada assume ao numerar as texturas. */
function validarSequencia(
  arquivos: string[],
  esperado: number,
  rotulo: string,
  slug: string
): string[] {
  const erros: string[] = [];

  if (arquivos.length !== esperado) {
    erros.push(
      `${slug}: contagem declarada (${esperado}) para "${rotulo}" não bate com os PNGs encontrados (${arquivos.length})`
    );
    return erros;
  }

  arquivos.forEach((arquivo, index) => {
    const nomeEsperado = `${pad(index + 1)}.png`;
    if (basename(arquivo) !== nomeEsperado) {
      erros.push(
        `${slug}: esperava "${nomeEsperado}" na posição ${index} de "${rotulo}", encontrou "${basename(arquivo)}" — numeração precisa ser sequencial e zero-padded a 3 dígitos, sem buracos`
      );
    }
  });

  return erros;
}

/** Lê só o cabeçalho IHDR do PNG (24 bytes) pra pegar largura/altura e o tipo
 * de cor, sem carregar o arquivo inteiro. */
async function lerCabecalhoPng(
  caminho: string
): Promise<{ largura: number; altura: number; tipoCor: number }> {
  const handle = await open(caminho, 'r');
  try {
    const buffer = Buffer.alloc(26);
    await handle.read(buffer, 0, 26, 0);
    return {
      largura: buffer.readUInt32BE(16),
      altura: buffer.readUInt32BE(20),
      tipoCor: buffer.readUInt8(25),
    };
  } finally {
    await handle.close();
  }
}

/** Contrato legado (`sl_shared`): o PNG em `assets/` já vem enquadrado e é
 * usado como está, então precisa bater exatamente com o canvas do rig — sem
 * isso, uma espécie pintada com o template errado só apareceria deformada
 * in-game. */
async function validarCanvasExato(
  arquivos: string[],
  info: SpeciesInfo,
  rotulo: string
): Promise<string[]> {
  const { canvas } = rigDe(info.config);
  const erros: string[] = [];

  for (const arquivo of arquivos) {
    const { largura, altura } = await lerCabecalhoPng(arquivo);
    if (largura !== canvas.largura || altura !== canvas.altura) {
      erros.push(
        `${info.slug}: "${basename(arquivo)}" (${rotulo}) tem ${largura}x${altura}, esperado ${canvas.largura}x${canvas.altura} para o rig "${info.config.rig ?? 'sl_shared'}"`
      );
    }
  }

  return erros;
}

/** Tipos de cor do PNG que carregam canal alfa (4 = cinza+alfa, 6 = RGBA).
 * Master sem alfa não tem como ser enquadrado: o trim não teria o que
 * recortar e a arte entraria no canvas com fundo opaco. */
const TIPOS_COR_COM_ALFA = new Set([4, 6]);

/** Contrato de master (`ssm_shared`): a arte é nativa, de qualquer resolução,
 * e o enquadramento é derivado — então o que se valida é se ela tem alfa e se
 * a geometria calculada cabe no canvas. */
async function validarMaster(
  arquivos: string[],
  info: SpeciesInfo,
  rotulo: string
): Promise<string[]> {
  const rig = rigDe(info.config);
  if (!rig.guia) return [];

  const erros: string[] = [];

  for (const arquivo of arquivos) {
    const { tipoCor } = await lerCabecalhoPng(arquivo);
    if (!TIPOS_COR_COM_ALFA.has(tipoCor)) {
      erros.push(
        `${info.slug}: "${basename(arquivo)}" (${rotulo}) não tem canal alfa (tipo de cor PNG ${tipoCor}) — master precisa de fundo transparente pro enquadramento recortar`
      );
    }
  }

  if (erros.length > 0) return erros;

  // Mesmas medidas que o staging vai usar — inclusive a âncora, sem a qual a
  // validação julgaria uma geometria diferente da que será composta.
  const trims = await medirTrims(arquivos);
  const medidas = info.config.ancora === 'cabeca' ? await medirInicioDoCorpo(trims) : trims;
  const guia = resolverGuia(rig.canvas, rig.guia);
  return validarEnquadramento(medidas, info.config.modo ?? 'largura', guia, info.slug);
}

export async function validarEspecie(info: SpeciesInfo): Promise<string[]> {
  const { slug, config } = info;
  const erros: string[] = [];

  const nomeEsperado = slug.replace(/^ssm_/, '');
  if (config.name !== nomeEsperado) {
    erros.push(
      `${slug}: campo "name" do portrait.json ("${config.name}") não bate com o nome da pasta ("${nomeEsperado}")`
    );
  }

  for (const campo of ['modo', 'ancora'] as const) {
    if (config[campo] !== undefined && rigDe(config).guia === undefined) {
      erros.push(
        `${slug}: portrait.json declara "${campo}": "${config[campo]}", mas o rig "${config.rig ?? 'sl_shared'}" usa arte já enquadrada — não há enquadramento a derivar`
      );
    }
  }

  for (const genero of generosDe(config.counts)) {
    erros.push(...validarSequencia(info.arquivos[genero]!, quantidadeDe(config.counts, genero)!, genero, slug));
  }

  // só confere a arte se a sequência já bateu — evita erro de dimensão
  // confuso/redundante quando o problema real é contagem/numeração.
  if (erros.length === 0) {
    const validar = rigDe(config).guia ? validarMaster : validarCanvasExato;
    for (const genero of generosDe(config.counts)) {
      erros.push(...(await validar(info.arquivos[genero]!, info, genero)));
    }
  }

  return erros;
}
