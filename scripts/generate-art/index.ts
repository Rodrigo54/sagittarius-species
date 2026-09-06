import { Argument, Command, InvalidArgumentError, Option } from 'commander';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PASTA_ASSETS, PASTA_RAIZ } from '../shared/paths';
import { lerConfig } from '../shared/species';
import { aguardarConclusao, baixarImagem, enfileirar, enviarImagemDeReferencia } from './comfyui-client';
import { mesclarCampos } from './merge';
import type { GeneroAlvo, GeracaoArtModelo } from '../portrait-schema';
import { BASE_ART } from './base';
import { gravarSeed } from './persistir-seed';
import { promoverEspecie } from './promote';
import { montarPrompts } from './prompt-builder';
import { resolverSeed, seedDeterministica, type OrigemSeed } from './seed';
import { validarEspecie } from './validacao';
import { montarPrompt, type PromptComfyUI } from './workflow';

/** Entry point do pipeline de geração de arte via IA (Flux.2 Klein Base),
 * lendo `geracaoArt` do `portrait.json` da espécie. */

const PASTA_PORTRAITS_ASSETS = join(PASTA_ASSETS, 'portraits');

/** Staging fora do git (ver `.gitignore`) — `promote.ts` só olha pra
 * `counts.<gênero>` e pros PNGs numerados que encontrar em
 * `<slug>/<gênero>/`. */
const PASTA_STAGING = join(PASTA_RAIZ, '.portraits-generated');

/** Um template por variante — o grafo difere de verdade (node negativo é
 * `CLIPTextEncode` em "base" e `ConditioningZeroOut` em "distilled", ver
 * `workflow.ts`), não é só uma questão de trocar `unet_name`. */
const CAMINHOS_WORKFLOW: Record<'base' | 'distilled', string> = {
  base: join(PASTA_RAIZ, 'scripts/comfyui/ssm_species_portrait_workflow.json'),
  distilled: join(PASTA_RAIZ, 'scripts/comfyui/ssm_species_portrait_workflow_distilled.json'),
};

const GENEROS_VALIDOS: readonly GeneroAlvo[] = ['male', 'female', 'genderless'];

interface Argumentos {
  slug: string;
  genero: GeneroAlvo;
  /** Lista de índices explícitos (`--variante 001,004,007`) — undefined =
   * todas as variantes declaradas. */
  variantes?: string[];
  /** Toda forma de `--seed` é persistida no `portrait.json` da variante
   * depois de gerar: um número fixa aquela seed, `'random'` (a flag sem
   * valor) sorteia uma, e `'default'` apaga a seed gravada, devolvendo a
   * variante à determinística. */
  seed?: number | 'random' | 'default';
  promote: boolean;
  /** Monta e imprime o prompt (positivo + negativo) de cada variante pedida,
   * sem enfileirar nada no ComfyUI — ciclo de debug instantâneo pra
   * inspecionar o texto composto sem gastar GPU. */
  exportPrompt: boolean;
}

/** Acumula os índices de `--variante` de todas as ocorrências da flag,
 * aceitando lista por vírgula em cada uma (`-n 001,004 -n 007`). Repetição em
 * vez de variádico (`<NNN...>`) de propósito: variádico engoliria os
 * posicionais que viessem depois da flag. */
function coletarVariantes(valor: string, acumulado: string[] = []): string[] {
  const itens = valor
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (itens.length === 0) {
    throw new InvalidArgumentError('esperava pelo menos um índice de variante (ex.: 001).');
  }
  for (const item of itens) {
    if (!/^\d+$/.test(item)) {
      throw new InvalidArgumentError(`"${item}" não é um índice numérico de variante.`);
    }
  }
  return [...acumulado, ...itens.map((item) => item.padStart(3, '0'))];
}

function parseArgumentos(): Argumentos {
  const programa = new Command()
    .name('bun run art')
    .description(
      'Gera retratos de espécie via IA no ComfyUI local (Flux.2 Klein), a partir da receita "geracaoArt" do portrait.json.'
    )
    .addArgument(new Argument('<slug>', 'Espécie a gerar (nome da pasta em assets/portraits/).'))
    .addArgument(new Argument('<genero>', 'Bloco de gênero do geracaoArt a usar.').choices([...GENEROS_VALIDOS]))
    .option(
      '-n, --variante <NNN>',
      'Variante(s) a gerar; repetível e aceita lista por vírgula. Padrão: todas as declaradas.',
      coletarVariantes
    )
    .addOption(
      new Option(
        '-s, --seed [N]',
        'Fixa a seed da variante: um inteiro fixa aquele valor, "default" volta pra determinística, sem valor sorteia uma. Sempre grava o resultado no portrait.json.'
      ).conflicts('exportPrompt')
    )
    .addOption(
      new Option('-p, --promote', 'Promove o lote do gênero de staging para assets/portraits/<slug>/.').conflicts([
        'variante',
        'exportPrompt',
      ])
    )
    .option('-e, --export-prompt', 'Imprime os prompts sem enfileirar nada no ComfyUI (não gasta GPU).')
    .parse();

  const [slug, genero] = programa.processedArgs as [string, GeneroAlvo];
  // `seed` é `true` quando a flag vem sem valor (a opção declara valor
  // opcional) e string quando vem com.
  const opcoes = programa.opts<{
    variante?: string[];
    seed?: string | true;
    promote?: boolean;
    exportPrompt?: boolean;
  }>();
  const variantes = opcoes.variante;

  // `--seed` sem valor é o pedido de sorteio; "default" é o literal que
  // devolve a variante à seed determinística; com valor, só dígitos servem
  // pro noise_seed.
  let seed: number | 'random' | 'default' | undefined;
  if (opcoes.seed === true) {
    seed = 'random';
  } else if (opcoes.seed !== undefined) {
    const texto = String(opcoes.seed);
    if (texto.toLowerCase() === 'default') {
      seed = 'default';
    } else {
      // `Number.isSafeInteger` além do regex: dígitos demais passariam por
      // "número válido" e chegariam ao ComfyUI já arredondados.
      const numero = Number(texto);
      if (!/^\d+$/.test(texto) || !Number.isSafeInteger(numero)) {
        programa.error(
          `error: --seed aceita um inteiro não-negativo, "default", ou nenhum valor (recebido "${opcoes.seed}").`
        );
      }
      seed = numero;
    }
  }

  // As demais combinações inválidas são declaradas em `.conflicts()` acima;
  // esta depende da quantidade de variantes, não só da presença das flags.
  if (seed !== undefined && variantes?.length !== 1) {
    programa.error(
      'error: --seed só faz sentido junto com --variante de uma única variante — grava a seed dela no portrait.json, e uma seed só descreve uma imagem.'
    );
  }

  return {
    slug,
    genero,
    variantes,
    seed,
    promote: opcoes.promote ?? false,
    exportPrompt: opcoes.exportPrompt ?? false,
  };
}

/** Rótulo de log pra cada origem possível de `resolverSeed` — só cosmético,
 * sem efeito na geração em si. */
const ROTULO_ORIGEM_SEED: Record<OrigemSeed, string> = {
  cli: '--seed',
  aleatoria: 'sorteada',
  padrao: '--seed default',
  config: 'customizada',
  deterministica: 'determinística',
};

async function gerarVariante(
  slug: string,
  genero: GeneroAlvo,
  chave: string,
  prompts: { positive: string; negative: string },
  seed: number,
  origemSeed: OrigemSeed,
  template: PromptComfyUI,
  pastaDestino: string,
  modelo: GeracaoArtModelo | undefined,
  imagensReferenciaEnviadas: string[] | undefined
): Promise<void> {
  const filenamePrefix = `ssm_${slug.replace(/^ssm_/, '')}_${genero}_${chave}`;
  const prompt = montarPrompt(template, prompts, { seed, filenamePrefix, modelo, imagensReferenciaEnviadas });

  console.log(`[${slug}/${genero}/${chave}] enfileirando no ComfyUI (seed ${seed}, ${ROTULO_ORIGEM_SEED[origemSeed]})...`);
  const promptId = await enfileirar(prompt);
  const imagem = await aguardarConclusao(promptId);
  const bytes = await baixarImagem(imagem);

  await mkdir(pastaDestino, { recursive: true });
  const destino = join(pastaDestino, `${chave}.png`);
  await writeFile(destino, bytes);
  console.log(`[${slug}/${genero}/${chave}] gravado em staging: ${destino}`);
}

async function main(): Promise<void> {
  const { slug, genero, variantes: variantesPedidas, seed, promote, exportPrompt } = parseArgumentos();

  const pastaEspecieAssets = join(PASTA_PORTRAITS_ASSETS, slug);
  // A FORMA de portrait.json já foi validada pelo zod dentro de lerConfig —
  // lançou exceção (capturada pelo .catch() no fim deste arquivo) se
  // estivesse malformado. O que resta conferir aqui é específico desta
  // invocação de CLI: o gênero pedido pode legitimamente não existir pra
  // esta espécie (nem toda espécie declara os três).
  const config = await lerConfig(pastaEspecieAssets);
  if (!config.geracaoArt) {
    console.error(`${slug}: portrait.json não declara "geracaoArt" — nada a gerar (bun run art).`);
    process.exit(1);
  }
  if (!config.geracaoArt[genero]) {
    console.error(`${slug}: portrait.json não declara "geracaoArt.${genero}".`);
    process.exit(1);
  }

  const pastaStagingGenero = join(PASTA_STAGING, slug, genero);

  if (promote) {
    const { promovidos, removidos } = await promoverEspecie(config, slug, genero, pastaStagingGenero, pastaEspecieAssets);
    console.log(`Promovido: ${promovidos} imagem(ns) de ${slug}/${genero} para assets/portraits/${slug}/...`);
    if (removidos > 0) {
      console.log(`Removido(s) ${removidos} PNG(s) órfão(s) além de "counts.${genero}" em assets/portraits/${slug}/...`);
    }
    return;
  }

  // Validação cruzada portrait.json × base.json, sobre TODAS as variantes de
  // todos os gêneros — mesmo quando esta invocação vai gerar só uma (`-n`).
  // Não custa GPU e evita descobrir na variante 017 que o lote está quebrado.
  const conferidas = await validarEspecie(config, slug, BASE_ART);
  console.log(`Validado: ${conferidas} variante(s) de ${slug} (todos os gêneros declarados).`);

  const bloco = config.geracaoArt[genero];
  const chaves =
    variantesPedidas ?? Object.keys(bloco.variantes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const inexistentes = chaves.filter((chave) => !bloco.variantes[chave]);
  if (inexistentes.length > 0) {
    console.error(`${inexistentes.join(', ')} não existe(m) em geracaoArt.${genero}.variantes de ${slug}.`);
    process.exit(1);
  }

  if (exportPrompt) {
    // Só monta e imprime o prompt de cada variante — nada de ComfyUI (sem
    // carregar o template, sem enviar referência, sem gastar GPU).
    for (const chave of chaves) {
      const camposVariante = bloco.variantes[chave]!;
      const campos = mesclarCampos(config.geracaoArt.base, bloco, camposVariante);
      const { positive, negative } = montarPrompts(campos, BASE_ART, `${slug}/${genero}/${chave}`);
      console.log(`\n=== ${slug}/${genero}/${chave} ===`);
      console.log(`POSITIVO (${positive.length} chars):\n${positive}`);
      console.log(`NEGATIVO (${negative.length} chars):\n${negative}`);
    }
    return;
  }

  const modelo = config.geracaoArt.modelo;
  const variant = modelo?.variant ?? 'distilled';
  const template = JSON.parse(await Bun.file(CAMINHOS_WORKFLOW[variant]).text()) as PromptComfyUI;
  console.log(`Variante do modelo: ${variant}.`);

  // Cada entrada de referenceImage é um indivíduo/conceito diferente da
  // espécie (não ângulos do mesmo personagem) — todas são enviadas ao
  // ComfyUI uma vez só, fora do loop de variantes, e reaproveitadas pra
  // todas as chaves geradas nesta invocação (uma referência por gênero, não
  // uma por variante).
  const caminhosReferencia = bloco.referenceImage ?? [];
  const imagensReferenciaEnviadas: string[] = [];
  for (const [indice, caminhoRelativo] of caminhosReferencia.entries()) {
    const caminhoReferencia = join(PASTA_RAIZ, caminhoRelativo);
    const bytesReferencia = Buffer.from(await Bun.file(caminhoReferencia).arrayBuffer());
    const nomeEnviado = await enviarImagemDeReferencia(bytesReferencia, `${slug}_${genero}_referencia_${indice + 1}.png`);
    imagensReferenciaEnviadas.push(nomeEnviado);
    console.log(`Referência ${indice + 1}/${caminhosReferencia.length} (${genero}) enviada como "${nomeEnviado}".`);
  }

  for (const chave of chaves) {
    const camposVariante = bloco.variantes[chave]!;
    const campos = mesclarCampos(config.geracaoArt.base, bloco, camposVariante);
    const prompts = montarPrompts(campos, BASE_ART, `${slug}/${genero}/${chave}`);
    const { seed: seedFinal, origem: origemSeed } = resolverSeed(seed, camposVariante.seed, seedDeterministica(slug, genero, chave));
    await gerarVariante(
      slug,
      genero,
      chave,
      prompts,
      seedFinal,
      origemSeed,
      template,
      pastaStagingGenero,
      modelo,
      imagensReferenciaEnviadas.length > 0 ? imagensReferenciaEnviadas : undefined
    );

    // Só depois de o PNG existir em disco: se o ComfyUI falhar no meio (ou o
    // usuário interromper), o portrait.json não é tocado e não sobra seed
    // divergindo da imagem que está lá.
    if (origemSeed === 'padrao') {
      await gravarSeed(pastaEspecieAssets, genero, chave, undefined);
      console.log(`[${slug}/${genero}/${chave}] seed removida do portrait.json → volta à determinística (${seedFinal})`);
    } else if (origemSeed === 'cli' || origemSeed === 'aleatoria') {
      await gravarSeed(pastaEspecieAssets, genero, chave, seedFinal);
      const comoVeio = origemSeed === 'aleatoria' ? 'sorteada' : 'fixada';
      console.log(`[${slug}/${genero}/${chave}] seed ${comoVeio}: ${seedFinal} → gravada em portrait.json`);
    }
  }

  console.log(`Concluído: ${chaves.length} imagem(ns) gerada(s) em ${pastaStagingGenero}`);
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
