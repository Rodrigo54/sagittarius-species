import { $ } from 'bun';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PASTA_ASSETS, PASTA_MOD } from '../converter';
import { carregarEspecie } from '../generate-portraits/discovery';
import type { PortraitConfig, SpeciesInfo } from '../generate-portraits/types';
import { validarEspecie } from '../generate-portraits/validation';
import { MAGICK, type Modo, medirTrims, reenquadrarPng, validarEnquadramento } from './reframe';
import { inserirAposOcorrencias } from './register';

const __DIRNAME = dirname(fileURLToPath(import.meta.url));

const PASTA_PORTRAITS_ASSETS = join(PASTA_ASSETS, 'portraits');
const GENERATE_PORTRAITS = join(__DIRNAME, '../generate-portraits/index.ts');
const ARQUIVOS_REGISTRO = [
  join(PASTA_MOD, 'common/species_classes/ssm_species_classes.txt'),
  join(PASTA_MOD, 'common/portrait_sets/ssm_portrait_sets.txt'),
];

function arquivosDaEspecie(info: SpeciesInfo): string[] {
  return [...info.arquivosMale, ...info.arquivosFemale, ...info.arquivosFlat];
}

/** Copia os PNGs originais + portrait.json pra `assets/portraits/<slugOld>/`,
 * com o rig legado fixado explicitamente — é a espécie de comparação que
 * aparece no jogo ao lado da migrada (remover junto com `ssm_test_rig` na
 * preparação de release). */
async function preservarOriginal(info: SpeciesInfo, slugOld: string) {
  const pastaOld = join(PASTA_PORTRAITS_ASSETS, slugOld);

  for (const arquivo of arquivosDaEspecie(info)) {
    const subpasta = basename(dirname(arquivo)); // "male", "female" ou o slug (flat)
    const destino =
      subpasta === 'male' || subpasta === 'female'
        ? join(pastaOld, subpasta, basename(arquivo))
        : join(pastaOld, basename(arquivo));
    await mkdir(dirname(destino), { recursive: true });
    await copyFile(arquivo, destino);
  }

  const configOld: PortraitConfig = {
    name: slugOld.replace(/^ssm_/, ''),
    gendered: info.config.gendered,
    rig: 'sl_shared',
    counts: info.config.counts,
  };
  await writeFile(
    join(pastaOld, 'portrait.json'),
    `${JSON.stringify(configOld, null, 2)}\n`
  );
}

/** Insere o slug de comparação ao lado de cada ocorrência do original nas
 * listas `portraits` de species_classes/portrait_sets — sem registro a
 * espécie nem aparece no jogo, e a comparação silenciosamente não existe. */
async function registrarEspecieOld(slug: string, slugOld: string) {
  let totalOcorrencias = 0;

  for (const arquivo of ARQUIVOS_REGISTRO) {
    const conteudo = await readFile(arquivo, 'utf-8');
    const resultado = inserirAposOcorrencias(conteudo, slug, slugOld);
    if (resultado.ocorrencias > 0) {
      await writeFile(arquivo, resultado.conteudo);
      console.log(`  ${basename(arquivo)}: ${resultado.ocorrencias} registro(s) de ${slugOld}`);
    } else {
      console.log(`  ${basename(arquivo)}: nada a inserir (já registrado ou sem ocorrência de ${slug})`);
    }
    totalOcorrencias += resultado.ocorrencias;
  }

  return totalOcorrencias;
}

async function main() {
  const slug = process.argv[2];
  if (slug === undefined) {
    console.error('Uso: bun scripts/migrate-portraits/index.ts ssm_<especie> [--altura]');
    console.error('Migra uma espécie do rig sl_shared (825x1650) pro ssm_shared (980x976),');
    console.error('preservando o original como ssm_old_<especie> pra comparação in-game.');
    console.error('');
    console.error('--altura: override pra composições atipicamente largas (ombros largos,');
    console.error('capuz) — escala pela altura mínima em vez da largura do guia, garantindo');
    console.error('que a base sempre toque a borda do canvas mesmo que a largura resultante');
    console.error('ultrapasse o guia (nunca o canvas). Padrão: escala pela largura do guia.');
    process.exit(1);
  }

  const modo: Modo = process.argv.includes('--altura') ? 'altura' : 'largura';

  if (slug.startsWith('ssm_old_')) {
    console.error(`"${slug}" é uma cópia de comparação — migre a espécie original.`);
    process.exit(1);
  }

  if (!existsSync(join(PASTA_PORTRAITS_ASSETS, slug))) {
    console.error(`Espécie "${slug}" não encontrada em assets/portraits/.`);
    process.exit(1);
  }

  if (!existsSync(MAGICK)) {
    console.error(`ImageMagick não encontrado em bin/imagemagick/ — rode "bun run setup".`);
    process.exit(1);
  }

  const info = await carregarEspecie(PASTA_PORTRAITS_ASSETS, slug);
  const slugOld = `ssm_old_${slug.replace(/^ssm_/, '')}`;
  const erros: string[] = [];

  if (info.config.rig === 'ssm_shared') {
    erros.push(`${slug}: já declara rig "ssm_shared" — nada a migrar.`);
  }

  if (existsSync(join(PASTA_PORTRAITS_ASSETS, slugOld))) {
    erros.push(
      `${slug}: "${slugOld}" já existe — espécie já migrada. Pra refazer a migração, restaure o estado pré-migração pelo git e rode de novo.`
    );
  }

  if (erros.length === 0) {
    // Validação estrutural do pipeline (sequência, counts, dimensões 825x1650
    // do rig sl_shared) — os mesmos erros que travariam o `bun run portrait`.
    erros.push(...(await validarEspecie(info)));
  }

  // Mede o trim de cada PNG uma única vez (sem escrever nada) — reaproveitado
  // pela validação e, se tudo passar, pela composição real, pra nunca
  // recalcular a geometria duas vezes com resultados divergentes. Só roda
  // depois da validação estrutural passar (senão mediria arquivo inconsistente
  // com o portrait.json, produzindo erro confuso em vez do real).
  const medidas =
    erros.length === 0 ? await medirTrims(arquivosDaEspecie(info)) : [];

  if (erros.length === 0) {
    erros.push(...validarEnquadramento(medidas, modo, slug));
  }

  if (erros.length > 0) {
    console.error(
      `${erros.length} erro(s) de validação — nada foi escrito ou apagado:`
    );
    for (const erro of erros) console.error(` - ${erro}`);
    process.exit(1);
  }

  console.log(`Preservando original em assets/portraits/${slugOld}/ ...`);
  await preservarOriginal(info, slugOld);

  console.log(
    `Reenquadrando ${medidas.length} PNG(s) de ${slug} in place (modo: ${modo}) ...`
  );
  for (const medida of medidas) {
    await reenquadrarPng(medida, modo);
  }

  const configNovo: PortraitConfig = {
    name: info.config.name,
    gendered: info.config.gendered,
    rig: 'ssm_shared',
    counts: info.config.counts,
  };
  await writeFile(
    join(info.pastaAssets, 'portrait.json'),
    `${JSON.stringify(configNovo, null, 2)}\n`
  );

  console.log(`Registrando ${slugOld} em species_classes/portrait_sets ...`);
  const ocorrencias = await registrarEspecieOld(slug, slugOld);
  if (ocorrencias === 0) {
    console.warn(
      `  aviso: nenhuma inserção feita — confira manualmente se ${slugOld} está registrado.`
    );
  }

  console.log('Sincronizando o mod (generate-portraits) ...');
  await $`bun ${GENERATE_PORTRAITS} ${slug}`;
  await $`bun ${GENERATE_PORTRAITS} ${slugOld}`;

  console.log(
    `Migração concluída: ${slug} agora usa o rig ssm_shared; o visual antigo está em ${slugOld} pra comparação in-game (remover na preparação de release).`
  );
}

main();
