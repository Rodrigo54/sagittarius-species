import { gerarTaxonomia } from './gerar';

/** Ponto de entrada de `bun run taxonomy`: regenera `ssm_portrait_sets.txt` e
 * `ssm_portrait_categories.txt` a partir da filiação declarada nos
 * `portrait.json`. Sem argumentos e sem filtro por espécie — os dois arquivos
 * descrevem o mod inteiro (ver `gerarTaxonomia`).
 *
 * `bun run portrait` chama a mesma função no fim da execução, então rodar este
 * comando sozinho só é necessário quando **nada** de textura mudou: alterou
 * `species_classes`/`categories` de uma espécie e quer o registro atualizado
 * sem esperar a conversão de DDS. */
async function main() {
  try {
    const { especies, sets } = await gerarTaxonomia();
    console.log(`Gerado: ${sets} portrait_set(s) a partir de ${especies} espécie(s).`);
  } catch (erro) {
    console.error(erro instanceof Error ? erro.message : String(erro));
    process.exit(1);
  }
}

main();
