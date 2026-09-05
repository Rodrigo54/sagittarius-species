/**
 * Diagnostica, por espécie, **onde a silhueta da arte fica sólida** — ou seja,
 * quanto há de estrutura fina e esparsa (chifre, antena, penacho, ponta de
 * cabelo) acima da cabeça.
 *
 * Serve para decidir quais espécies se beneficiam de `"ancora": "cabeca"` no
 * `portrait.json`: ancorando pelo bounding box, esse ornamento encosta no topo
 * do guia e empurra o personagem para baixo, deixando-o menor que o das outras
 * espécies.
 *
 * A decisão **não** é automática, e não deve ser: nem toda estrutura fina é
 * sacrificável. Em algumas espécies ela é a característica — tentáculos, por
 * exemplo —, e empurrá-la para a faixa de corte é o mesmo erro que fez
 * `ssm_mermaids` ser revertida quando a cauda saiu do quadro. Este script diz
 * onde olhar; quem decide é quem olha.
 *
 *   bun scripts/measure-framing/densidade-da-arte.ts
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PASTA_ASSETS } from '../shared/paths';
import { carregarEspecie, listarPastasEspecies } from '../shared/species';
import { detectarInicioDoCorpo } from '../generate-portraits/framing';
import { rigDe } from '../generate-portraits/types';
import { decodificarPng } from '../png';

/** Acima disto, a espécie tem estrutura fina o bastante para que ancorar pelo
 * bounding box mude visivelmente o tamanho do personagem no quadro. É um
 * limiar de triagem, não de decisão. */
const SUSPEITO = 0.12;

const PASTA_PORTRAITS = join(PASTA_ASSETS, 'portraits');

async function main() {
  const linhas: { slug: string; n: number; mediana: number; min: number; max: number; ancora?: string }[] = [];

  for (const slug of await listarPastasEspecies(PASTA_PORTRAITS)) {
    const info = await carregarEspecie(PASTA_PORTRAITS, slug);
    if (!rigDe(info.config).guia) continue; // rig legado não deriva enquadramento

    const arquivos = Object.values(info.arquivos).flat();
    const valores: number[] = [];
    for (const arquivo of arquivos) {
      valores.push(detectarInicioDoCorpo(decodificarPng(await readFile(arquivo))));
    }
    valores.sort((a, b) => a - b);

    linhas.push({
      slug,
      n: valores.length,
      mediana: valores[Math.floor(valores.length / 2)],
      min: valores[0],
      max: valores[valores.length - 1],
      ancora: info.config.ancora,
    });
  }

  linhas.sort((a, b) => b.mediana - a.mediana);

  console.log('Onde a silhueta fica sólida, em % da altura do conteúdo.');
  console.log('Valor alto = há estrutura fina acima da cabeça.\n');
  console.log('espécie              |  n | mediana |  mín |  máx | âncora');
  console.log('---------------------|----|---------|------|------|-------');

  for (const l of linhas) {
    const pct = (v: number) => (v * 100).toFixed(1).padStart(5);
    const marca = l.ancora === 'cabeca' ? 'cabeca' : l.mediana > SUSPEITO ? '  <-- candidata' : '';
    console.log(
      `${l.slug.padEnd(20)} | ${String(l.n).padStart(2)} | ${pct(l.mediana)}   | ${pct(l.min)}| ${pct(l.max)}| ${marca}`
    );
  }

  const candidatas = linhas.filter((l) => l.mediana > SUSPEITO && l.ancora !== 'cabeca');
  console.log(
    `\n${candidatas.length} candidata(s) sem âncora declarada. Antes de mudar qualquer uma,` +
      `\ncompare o antes e o depois em .portraits-framed/ — a estrutura fina pode ser` +
      `\na característica da espécie, e aí o lugar dela não é na faixa de corte.`
  );

  // A dispersão dentro da espécie é o argumento contra um offset fixo: quando
  // min e max estão longe, variantes têm ornamentos de tamanhos diferentes e só
  // a detecção por imagem alinha as cabeças entre si.
  const dispersas = linhas.filter((l) => l.max - l.min > 0.1);
  if (dispersas.length > 0) {
    console.log(
      `\n${dispersas.length} espécie(s) com variação interna > 10 pontos ` +
        `(${dispersas.map((l) => l.slug.replace('ssm_', '')).join(', ')}):`
    );
    console.log('  nelas, um recuo fixo por espécie desalinharia as variantes entre si.');
  }
}

if (import.meta.main) main();
