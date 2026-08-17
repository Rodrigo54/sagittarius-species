import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PASTA_ASSETS, PASTA_MOD } from '../converter';
import { lerConfig, listarPastasEspecies } from '../generate-portraits/discovery';
import { derivarSets, type Filiacao, type SetDerivado } from './agrupamento';
import { gerarPortraitCategories, gerarPortraitSets } from './txt-writer';

const PASTA_PORTRAITS_ASSETS = join(PASTA_ASSETS, 'portraits');
const ARQUIVO_SETS = join(PASTA_MOD, 'common/portrait_sets/ssm_portrait_sets.txt');
const ARQUIVO_CATEGORIES = join(PASTA_MOD, 'common/portrait_categories/ssm_portrait_categories.txt');

export interface TaxonomiaDerivada {
  sets: SetDerivado[];
  especies: number;
  erros: string[];
}

/** Lê a filiação de **todas** as espécies e deriva os sets, sem escrever nada.
 * Sempre o mod inteiro, mesmo quando quem chamou está trabalhando numa espécie
 * só: os dois arquivos gerados descrevem o mod todo num arquivo cada, então
 * derivar com filtro produziria um registro incompleto. Como é só leitura de
 * JSON, custa milissegundos.
 *
 * Separado da escrita pra que `generate-portraits` possa validar a taxonomia
 * junto das outras validações — antes de converter textura ou apagar `.dds`
 * órfão — e só escrever no fim. */
export async function derivarTaxonomia(): Promise<TaxonomiaDerivada> {
  const slugs = await listarPastasEspecies(PASTA_PORTRAITS_ASSETS);

  const carregadas = await Promise.all(
    slugs.map(async (slug) => {
      try {
        const config = await lerConfig(join(PASTA_PORTRAITS_ASSETS, slug));
        const filiacao: Filiacao = {
          slug,
          species_classes: config.species_classes,
          categories: config.categories,
        };
        return { filiacao, erro: undefined };
      } catch (erro) {
        return { filiacao: undefined, erro: erro instanceof Error ? erro.message : String(erro) };
      }
    })
  );

  const errosDeCarga = carregadas.flatMap((r) => (r.erro !== undefined ? [r.erro] : []));
  const especies = carregadas.flatMap((r) => (r.filiacao !== undefined ? [r.filiacao] : []));
  const { sets, erros: errosDeDerivacao } = derivarSets(especies);

  return { sets, especies: especies.length, erros: [...errosDeCarga, ...errosDeDerivacao] };
}

/** Regenera do zero os dois arquivos de `common/` que registram os retratos do
 * mod. Recebe os sets já derivados — quem chama decide quando validar. */
export async function escreverTaxonomia(sets: SetDerivado[]): Promise<void> {
  await writeFile(ARQUIVO_SETS, gerarPortraitSets(sets));
  await writeFile(ARQUIVO_CATEGORIES, gerarPortraitCategories(sets));
}

/** Deriva e escreve numa tacada, travando se houver erro — o fluxo de quem só
 * quer o registro atualizado (`bun run taxonomy`). */
export async function gerarTaxonomia(): Promise<{ especies: number; sets: number }> {
  const { sets, especies, erros } = await derivarTaxonomia();
  if (erros.length > 0) {
    throw new Error(
      [`${erros.length} erro(s) de taxonomia — nada foi escrito:`, ...erros.map((erro) => ` - ${erro}`)].join('\n')
    );
  }

  await escreverTaxonomia(sets);
  return { especies, sets: sets.length };
}
