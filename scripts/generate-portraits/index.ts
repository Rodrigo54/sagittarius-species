import { Command } from 'commander';
import { mkdir, rm } from 'node:fs/promises';
import { relative, dirname, extname } from 'node:path';
import { promoverLote, type ArquivoPreparado } from './promote';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { converter } from '../converter';
import { PASTA_ASSETS, PASTA_MOD, PASTA_RAIZ } from '../shared/paths';
import { derivarTaxonomia, arquivosTaxonomia } from '../generate-taxonomy/gerar';
import { carregarEspecie, listarPastasEspecies } from '../shared/species';
import { prepararEspecie } from './staging';
import { gerarConteudoTxt } from './txt-writer';
import { validarEspecie } from './validation';

const PASTA_PORTRAITS_ASSETS = join(PASTA_ASSETS, 'portraits');
const PASTA_PORTRAITS_MOD = join(PASTA_MOD, 'gfx/models/portraits');
const PASTA_PORTRAIT_TXT = join(PASTA_MOD, 'gfx/portraits/portraits');

/** Onde os PNGs enquadrados ficam antes de virar DDS. Fora do git (ver
 * .gitignore) — é saída derivada, reconstruída a cada execução. */
const PASTA_STAGING = join(PASTA_RAIZ, '.portrait-staging');

let etapa = 'validação';
async function main() {

  // Filtro opcional por linha de comando (ex.: `bun run portrait ssm_elves`)
  // pra iterar rápido numa espécie só — validação, limpeza de órfãos,
  // enquadramento, conversão e regeneração do .txt ficam restritas a ela; as
  // outras espécies não são tocadas.
  const programa = new Command().name('bun run portrait').description('Prepara retratos em staging e promove o lote para o mod.').argument('[especie]', 'Espécie a processar.').parse();
  const filtro: string | undefined = programa.args[0];
  const todosSlugs = await listarPastasEspecies(PASTA_PORTRAITS_ASSETS);
  if (filtro !== undefined && !todosSlugs.includes(filtro)) {
    console.error(`Espécie "${filtro}" não encontrada em assets/portraits/. Disponíveis:`);
    for (const slug of todosSlugs) console.error(` - ${slug}`);
    process.exit(1);
  }
  const slugs = filtro !== undefined ? [filtro] : todosSlugs;

  // carregarEspecie (via lerConfig) já valida a FORMA do portrait.json contra
  // o schema zod e lança exceção se estiver malformado — capturado aqui, não
  // deixado propagar cru, pra não quebrar o padrão "valida tudo, reporta tudo
  // de uma vez" só porque uma espécie entre 18 tem um erro de forma.
  const resultadosCarga = await Promise.all(
    slugs.map(async (slug) => {
      try {
        return { slug, info: await carregarEspecie(PASTA_PORTRAITS_ASSETS, slug), erro: undefined };
      } catch (erro) {
        return { slug, info: undefined, erro: erro instanceof Error ? erro.message : String(erro) };
      }
    })
  );

  const errosDeCarga = resultadosCarga.flatMap((r) => (r.erro !== undefined ? [r.erro] : []));
  const especies = resultadosCarga.flatMap((r) => (r.info !== undefined ? [r.info] : []));

  // Valida o resto (arquivos no disco: contagem de PNGs, geometria, canal
  // alfa) antes de mexer em qualquer arquivo — erro trava a geração sem
  // deixar o mod num estado parcialmente limpo/atualizado. A taxonomia entra
  // aqui pelo mesmo motivo: ela é derivada agora e só escrita no fim, pra que
  // uma filiação inválida (numa espécie qualquer, mesmo fora do filtro) não
  // seja descoberta depois de já ter convertido textura.
  const errosPorEspecie = await Promise.all(especies.map((info) => validarEspecie(info)));
  const taxonomia = await derivarTaxonomia();
  const erros = [...errosDeCarga, ...errosPorEspecie.flat(), ...taxonomia.erros];
  if (erros.length > 0) {
    console.error(
      `${erros.length} erro(s) de validação encontrado(s) — nada foi escrito ou apagado:`
    );
    for (const erro of erros) console.error(` - ${erro}`);
    process.exit(1);
  }

  etapa = 'preparação do staging (mod preservado)';
  const pastaPng = join(PASTA_STAGING, 'png');
  const pastaModStaging = join(PASTA_STAGING, 'mod');
  const pastaDds = join(pastaModStaging, 'gfx/models/portraits');
  const saidas: ArquivoPreparado[] = [];
  const arquivos: string[] = [];
  let enquadrados = 0;
  for (const info of especies) {
    const preparado = await prepararEspecie(info, PASTA_PORTRAITS_ASSETS, pastaPng);
    arquivos.push(...preparado.arquivos);
    enquadrados += preparado.enquadrados;
  }

  // Cada DDS esperado precisa vir desta execução, nunca de um lote anterior.
  for (const png of arquivos) {
    const relativo = relative(pastaPng, png);
    await rm(join(pastaDds, relativo.slice(0, -extname(relativo).length) + '.dds'), { force: true });
  }
  await converter(arquivos, {
    format: 'bc3',
    noMips: true,
    pastaOrigem: pastaPng,
    pastaDestino: pastaDds,
  });

  for (const png of arquivos) {
    const relativo = relative(pastaPng, png);
    const dds = relativo.slice(0, -extname(relativo).length) + '.dds';
    saidas.push({ origem: join(pastaDds, dds), destino: join(PASTA_PORTRAITS_MOD, dds) });
  }
  const textos = [
    ...especies.map(info => ({ caminho: 'gfx/portraits/portraits/' + info.slug + '_portrait.txt', conteudo: gerarConteudoTxt(info.slug, info) })),
    ...arquivosTaxonomia(taxonomia.sets),
  ];
  for (const texto of textos) {
    const origem = join(pastaModStaging, texto.caminho);
    await mkdir(dirname(origem), { recursive: true });
    await writeFile(origem, texto.conteudo);
    saidas.push({ origem, destino: join(PASTA_MOD, texto.caminho) });
  }
  etapa = 'promoção para mod/ (uma falha pode deixar cópias parciais; confira o git diff)';
  await promoverLote(saidas, especies, PASTA_PORTRAITS_MOD, PASTA_PORTRAIT_TXT, filtro);

  console.log(
    filtro !== undefined
      ? `Gerado: só ${filtro} (filtro de linha de comando). ${enquadrados} retrato(s) enquadrado(s).`
      : `Gerado: ${especies.length} espécie(s) de portrait, ${enquadrados} retrato(s) enquadrado(s) a partir de master.`
  );
  console.log(`Registro: ${taxonomia.sets.length} portrait_set(s) a partir de ${taxonomia.especies} espécie(s).`);
}

main().catch(erro => { console.error('Falha na etapa ' + etapa + ': ' + (erro instanceof Error ? erro.message : erro)); process.exitCode = 1; });
