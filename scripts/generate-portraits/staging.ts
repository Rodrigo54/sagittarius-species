/** Prepara, fora do git, os PNGs exatamente como eles entram no texconv.
 *
 * Existe para dar um único formato de entrada à conversão, apesar de os dois
 * rigs terem contratos de arte diferentes: o `ssm_shared` guarda master nativo
 * e é enquadrado aqui; o `sl_shared` legado guarda arte já enquadrada e é
 * copiada byte a byte (cópia idêntica ⇒ DDS idêntico, então o legado fica
 * imune a esta mudança de pipeline).
 *
 * Efeito colateral útil: a pasta é o enquadramento final em PNG, aberto em
 * qualquer visualizador — é onde se confere a olho o que o jogo vai receber,
 * sem precisar abrir um DDS.
 */

import { copyFile, mkdir, rm } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { enquadrarPng, medirInicioDoCorpo, medirTrims, resolverGuia } from './framing';
import { rigDe, type SpeciesInfo } from './types';

export interface Preparado {
  /** Arquivos prontos pra conversão, na pasta derivada. */
  arquivos: string[];
  /** Quantos foram efetivamente reenquadrados (o resto foi cópia do legado). */
  enquadrados: number;
}

export async function prepararEspecie(
  info: SpeciesInfo,
  pastaAssetsRaiz: string,
  pastaStaging: string
): Promise<Preparado> {
  const origens = [...info.arquivosMale, ...info.arquivosFemale, ...info.arquivosFlat];
  const rig = rigDe(info.config);

  // Recria a pasta da espécie do zero: sem isso, um PNG removido da arte-fonte
  // sobreviveria aqui e seria convertido de novo, ressuscitando um retrato que
  // já não tem origem.
  const pastaEspecieStaging = join(pastaStaging, info.slug);
  await rm(pastaEspecieStaging, { recursive: true, force: true });

  const destinos = new Map<string, string>();
  for (const origem of origens) {
    const destino = join(pastaStaging, relative(pastaAssetsRaiz, origem));
    await mkdir(join(destino, '..'), { recursive: true });
    destinos.set(origem, destino);
  }

  if (!rig.guia) {
    for (const [origem, destino] of destinos) {
      await copyFile(origem, destino);
    }
    return { arquivos: [...destinos.values()], enquadrados: 0 };
  }

  const guia = resolverGuia(rig.canvas, rig.guia);
  const modo = info.config.modo ?? 'largura';
  // A detecção lê os pixels de cada master, então só roda para quem pede.
  const medidas =
    info.config.ancora === 'cabeca'
      ? await medirInicioDoCorpo(await medirTrims(origens))
      : await medirTrims(origens);

  for (const medida of medidas) {
    await enquadrarPng(medida, modo, guia, destinos.get(medida.arquivo)!);
  }

  return { arquivos: [...destinos.values()], enquadrados: medidas.length };
}
