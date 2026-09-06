import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { PortraitConfig } from '../portrait-schema';
import { PASTA_ASSETS, PASTA_MOD } from '../shared/paths';
import { lerConfig, listarPastasEspecies } from '../shared/species';
import { derivarSets, type Filiacao, type SetDerivado } from './agrupamento';
import { gerarPortraitCategories, gerarPortraitSets } from './txt-writer';

const PASTA_PORTRAITS_ASSETS = join(PASTA_ASSETS, 'portraits');

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
 * órfão — e só escrever no fim.
 *
 * `configsPreCarregados` deixa quem já leu `portrait.json` de outra forma
 * (ex.: `bun run validate`, que carrega `SpeciesInfo` completo pra validar
 * retratos) reaproveitar o config em vez de reabrir o arquivo. */
export async function derivarTaxonomia(
  configsPreCarregados?: ReadonlyMap<string, PortraitConfig>
): Promise<TaxonomiaDerivada> {
  const slugs = await listarPastasEspecies(PASTA_PORTRAITS_ASSETS);

  const carregadas = await Promise.all(
    slugs.map(async (slug) => {
      try {
        const config = configsPreCarregados?.get(slug) ?? (await lerConfig(join(PASTA_PORTRAITS_ASSETS, slug)));
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
  for (const arquivo of arquivosTaxonomia(sets)) {
    const caminho = join(PASTA_MOD, arquivo.caminho);
    await mkdir(dirname(caminho), { recursive: true });
    await writeFile(caminho, arquivo.conteudo);
  }
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

export function arquivosTaxonomia(sets: SetDerivado[]) {
  return [
    { caminho: 'common/portrait_sets/ssm_portrait_sets.txt', conteudo: gerarPortraitSets(sets) },
    { caminho: 'common/portrait_categories/ssm_portrait_categories.txt', conteudo: gerarPortraitCategories(sets) },
  ];
}
