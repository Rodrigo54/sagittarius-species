import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PASTA_ASSETS, PASTA_MOD, converter } from '../converter';
import { carregarEspecie, listarPastasEspecies } from './discovery';
import { limparOrfaos } from './sync';
import { gerarConteudoTxt } from './txt-writer';
import { validarEspecie } from './validation';

const PASTA_PORTRAITS_ASSETS = join(PASTA_ASSETS, 'portraits');
const PASTA_PORTRAITS_MOD = join(PASTA_MOD, 'gfx/models/portraits');
const PASTA_PORTRAIT_TXT = join(PASTA_MOD, 'gfx/portraits/portraits');

async function main() {
  const slugs = await listarPastasEspecies(PASTA_PORTRAITS_ASSETS);
  const especies = await Promise.all(
    slugs.map((slug) => carregarEspecie(PASTA_PORTRAITS_ASSETS, slug))
  );

  // Valida tudo antes de mexer em qualquer arquivo — erro trava a geração sem
  // deixar o mod num estado parcialmente limpo/atualizado.
  const erros = especies.flatMap((info) => validarEspecie(info));
  if (erros.length > 0) {
    console.error(
      `${erros.length} erro(s) de validação encontrado(s) — nada foi escrito ou apagado:`
    );
    for (const erro of erros) console.error(` - ${erro}`);
    process.exit(1);
  }

  for (const info of especies) {
    const pastaDestinoEspecie = join(PASTA_PORTRAITS_MOD, info.slug);
    await limparOrfaos(info, pastaDestinoEspecie);
  }

  const arquivos = especies.flatMap((info) => [
    ...info.arquivosMale,
    ...info.arquivosFemale,
    ...info.arquivosFlat,
  ]);
  await converter(arquivos, {
    format: 'bc3',
    noMips: true,
    pastaOrigem: PASTA_PORTRAITS_ASSETS,
    pastaDestino: PASTA_PORTRAITS_MOD,
  });

  for (const info of especies) {
    const conteudoTxt = gerarConteudoTxt(info.slug, info);
    await writeFile(join(PASTA_PORTRAIT_TXT, `${info.slug}_portrait.txt`), conteudoTxt);
  }

  console.log(`Gerado: ${especies.length} espécie(s) de portrait.`);
}

main();
