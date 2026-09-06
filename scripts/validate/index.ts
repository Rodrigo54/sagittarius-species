import { Command } from 'commander';
import { join } from 'node:path';
import { Jomini } from 'jomini';
import { PASTA_ASSETS, PASTA_RAIZ } from '../shared/paths';
import { carregarEspecie, listarPastasEspecies, type SpeciesInfo } from '../shared/species';
import { loadVanillaKeys } from '../shared/vanilla';
import { validarEspecie } from '../generate-portraits/validation';
import { derivarTaxonomia } from '../generate-taxonomy/gerar';
import { validarEspecie as validarArt } from '../generate-art/validacao';
import { BASE_ART } from '../generate-art/base';
import { carregarConfig, carregarRoomsDisponiveis } from '../generate-promo/discovery';
import { medirRecortes } from '../generate-promo/trim';
import { validarEspecie as validarPromo } from '../generate-promo/validation';
import { validarRooms } from '../generate-rooms/validation';
import {
  detectarCulturasDuplicadas,
  loadNameListFiles,
  readNameList,
  gerarNameList,
  type ParsedNameList,
} from '../generate-names/name-lists';
import { validateNameList } from '../generate-names/validation';
import { resolveSpeciesNames, type SpeciesNameSource } from '../generate-names/species-names';
import { conferirSchemas } from '../check-schemas';

async function main() {
  const programa = new Command().name('bun run validate')
    .description('Valida fontes e referências sem gerar arquivos, abrir navegador ou acessar a GPU.')
    .argument('[especie]', 'Restringe retratos, receitas de arte e promoção; mantém a taxonomia global.').parse();
  const filtro: string | undefined = programa.args[0];
  const pasta = join(PASTA_ASSETS, 'portraits');
  const slugs = await listarPastasEspecies(pasta);
  if (filtro !== undefined && !slugs.includes(filtro)) throw new Error('Espécie não encontrada: ' + filtro);
  const erros: string[] = [];
  async function conferir(rotulo: string, executar: () => Promise<void>) {
    try { await executar(); }
    catch (erro) { erros.push(rotulo + ': ' + (erro instanceof Error ? erro.message : erro)); }
  }
  await conferir('schemas', async () => { erros.push(...await conferirSchemas()); });

  // Carregado uma vez só e reaproveitado pela taxonomia (que precisa da
  // filiação de toda espécie carregada aqui) e pela validação de retratos —
  // evita reabrir o mesmo portrait.json duas vezes por espécie.
  const infos = new Map<string, SpeciesInfo>();
  for (const slug of filtro ? [filtro] : slugs) {
    await conferir(slug, async () => { infos.set(slug, await carregarEspecie(pasta, slug)); });
  }

  await conferir('taxonomia', async () => {
    const configsPreCarregados = new Map([...infos].map(([slug, info]) => [slug, info.config]));
    erros.push(...(await derivarTaxonomia(configsPreCarregados)).erros);
  });

  await conferir('retratos e promoção', async () => {
    const promo = await carregarConfig();
    const rooms = await carregarRoomsDisponiveis();
    if (filtro === undefined) {
      erros.push(...validarRooms(rooms));
      for (const slug of Object.keys(promo)) if (!slugs.includes(slug)) erros.push('Promoção aponta para espécie inexistente: ' + slug);
      await medirRecortes(rooms.arquivos);
    }
    for (const [slug, info] of infos) {
      await conferir(slug, async () => {
        erros.push(...await validarEspecie(info));
        await validarArt(info.config, slug, BASE_ART);
        if (promo[slug]) await validarPromo(info, promo[slug], rooms);
      });
    }
  });
  if (filtro === undefined) await conferir('nomes', async () => {
    const vanilla = await loadVanillaKeys(join(PASTA_RAIZ, 'scripts/vanilla-keys.json'));
    const parser = await Jomini.initialize();
    const itens: ParsedNameList[] = [];
    for (const arquivo of await loadNameListFiles(join(PASTA_ASSETS, 'name_lists'))) {
      await conferir(arquivo, async () => { itens.push(await readNameList(arquivo)); });
    }
    erros.push(...detectarCulturasDuplicadas(itens));
    const sources: SpeciesNameSource[] = [];
    for (const item of itens) {
      await conferir(item.fileName, async () => {
        erros.push(...validateNameList(item.body, vanilla, item.fileName));
        gerarNameList(parser, item, vanilla.languages);
        sources.push({ fileName: item.fileName, entries: item.speciesNames });
      });
    }
    erros.push(...resolveSpeciesNames(sources).errors);
  });
  if (erros.length) throw new Error(erros.length + ' erro(s):\n' + erros.map(e => ' - ' + e).join('\n'));
  console.log('Validação concluída: ' + (filtro ?? 'repositório inteiro') + '. Nenhum arquivo gerado.');
}
main().catch(erro => { console.error(erro instanceof Error ? erro.message : erro); process.exitCode = 1; });
