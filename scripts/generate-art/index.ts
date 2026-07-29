import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PASTA_ASSETS, PASTA_RAIZ } from '../converter';
import { lerConfig } from '../generate-portraits/discovery';
import { aguardarConclusao, baixarImagem, enfileirar, enviarImagemDeReferencia } from './comfyui-client';
import { mesclarCampos } from './merge';
import type { GeracaoArtModelo, OOPCamposCompostos } from './oop-types';
import { promoverEspecie } from './promote';
import { seedDeterministica } from './seed';
import { type GeneroAlvo, validarGeracaoArt } from './validation';
import { montarPrompt, type PromptComfyUI } from './workflow';

const PASTA_PORTRAITS_ASSETS = join(PASTA_ASSETS, 'portraits');

/** Onde as imagens geradas ficam até você revisar e promover — fora do git
 * (ver .gitignore), mesmo espírito do `.portraits-framed/` do pipeline de
 * portraits: saída derivada, não é fonte de verdade até virar asset. */
const PASTA_STAGING = join(PASTA_RAIZ, '.portraits-generated');

const CAMINHO_WORKFLOW = join(PASTA_RAIZ, 'scripts/comfyui/ssm_species_portrait_workflow.json');

const GENEROS_VALIDOS: readonly GeneroAlvo[] = ['male', 'female', 'flat'];

interface Argumentos {
  slug: string;
  genero: GeneroAlvo;
  /** Lista de índices explícitos (`--variante=001,004,007`) — undefined =
   * todas as variantes declaradas. */
  variantes?: string[];
  seed?: number;
  promote: boolean;
}

function parseArgs(argv: string[]): Argumentos {
  const [slug, genero, ...resto] = argv;
  if (!slug || !genero) {
    console.error(
      'Uso: bun run generate-art <slug> <male|female|flat> [--variante=NNN[,NNN,...]] [--seed=N] [--promote]'
    );
    process.exit(1);
  }
  if (!GENEROS_VALIDOS.includes(genero as GeneroAlvo)) {
    console.error(`Gênero "${genero}" inválido — use male, female ou flat.`);
    process.exit(1);
  }

  let variantes: string[] | undefined;
  let seed: number | undefined;
  let promote = false;

  for (const arg of resto) {
    if (arg === '--promote') {
      promote = true;
      continue;
    }
    const casaVariante = arg.match(/^--variante=([\d,]+)$/);
    if (casaVariante) {
      variantes = casaVariante[1]!.split(',').map((n) => n.padStart(3, '0'));
      continue;
    }
    const casaSeed = arg.match(/^--seed=(\d+)$/);
    if (casaSeed) {
      seed = Number(casaSeed[1]);
      continue;
    }
    console.error(`Argumento desconhecido: "${arg}"`);
    process.exit(1);
  }

  if (seed !== undefined && variantes?.length !== 1) {
    console.error(
      '--seed só faz sentido junto com --variante=NNN de uma única variante — sobrescreve a seed determinística dela.'
    );
    process.exit(1);
  }
  if (promote && variantes !== undefined) {
    console.error('--promote não aceita --variante junto — promove sempre o lote inteiro do gênero.');
    process.exit(1);
  }

  return { slug, genero: genero as GeneroAlvo, variantes, seed, promote };
}

async function gerarVariante(
  slug: string,
  genero: GeneroAlvo,
  chave: string,
  campos: OOPCamposCompostos,
  seed: number,
  template: PromptComfyUI,
  pastaDestino: string,
  modelo: GeracaoArtModelo | undefined,
  imagemReferenciaEnviada: string | undefined
): Promise<void> {
  const filenamePrefix = `ssm_${slug.replace(/^ssm_/, '')}_${genero}_${chave}`;
  const prompt = montarPrompt(template, campos, { seed, filenamePrefix, modelo, imagemReferenciaEnviada });

  console.log(`[${slug}/${genero}/${chave}] enfileirando no ComfyUI (seed ${seed})...`);
  const promptId = await enfileirar(prompt);
  const imagem = await aguardarConclusao(promptId);
  const bytes = await baixarImagem(imagem);

  await mkdir(pastaDestino, { recursive: true });
  const destino = join(pastaDestino, `${chave}.png`);
  await writeFile(destino, bytes);
  console.log(`[${slug}/${genero}/${chave}] gravado em staging: ${destino}`);
}

async function main(): Promise<void> {
  const { slug, genero, variantes: variantesPedidas, seed, promote } = parseArgs(process.argv.slice(2));

  const pastaEspecieAssets = join(PASTA_PORTRAITS_ASSETS, slug);
  const config = await lerConfig(pastaEspecieAssets);

  const errosValidacao = validarGeracaoArt(config, slug, genero);
  if (errosValidacao.length > 0) {
    console.error(`${errosValidacao.length} erro(s) de validação — nada foi enfileirado ou promovido:`);
    for (const erro of errosValidacao) console.error(` - ${erro}`);
    process.exit(1);
  }

  const pastaStagingGenero = join(PASTA_STAGING, slug, genero);

  if (promote) {
    const { promovidos } = await promoverEspecie(config, slug, genero, pastaStagingGenero, pastaEspecieAssets);
    console.log(`Promovido: ${promovidos} imagem(ns) de ${slug}/${genero} para assets/portraits/${slug}/...`);
    return;
  }

  const bloco = config.geracaoArt![genero]!;
  const chaves =
    variantesPedidas ?? Object.keys(bloco.variantes).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const inexistentes = chaves.filter((chave) => !bloco.variantes[chave]);
  if (inexistentes.length > 0) {
    console.error(`${inexistentes.join(', ')} não existe(m) em geracaoArt.${genero}.variantes de ${slug}.`);
    process.exit(1);
  }

  const template = JSON.parse(await Bun.file(CAMINHO_WORKFLOW).text()) as PromptComfyUI;
  const modelo = config.geracaoArt!.modelo;

  let imagemReferenciaEnviada: string | undefined;
  if (bloco.referenceImage !== undefined) {
    const caminhoReferencia = join(PASTA_RAIZ, bloco.referenceImage);
    const bytesReferencia = Buffer.from(await Bun.file(caminhoReferencia).arrayBuffer());
    imagemReferenciaEnviada = await enviarImagemDeReferencia(bytesReferencia, `${slug}_${genero}_referencia.png`);
    console.log(`Referência (${genero}) enviada como "${imagemReferenciaEnviada}".`);
  }

  for (const chave of chaves) {
    const camposVariante = bloco.variantes[chave]!;
    const campos = mesclarCampos(config.geracaoArt!.base, bloco, camposVariante);
    const seedFinal = seed ?? seedDeterministica(slug, genero, chave);
    await gerarVariante(slug, genero, chave, campos, seedFinal, template, pastaStagingGenero, modelo, imagemReferenciaEnviada);
  }

  console.log(`Concluído: ${chaves.length} imagem(ns) gerada(s) em ${pastaStagingGenero}`);
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
