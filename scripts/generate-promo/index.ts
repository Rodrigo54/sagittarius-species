import { readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { montarImagem } from './composicao';
import { carregarConfig, carregarRoomsDisponiveis, carregarVariantesDisponiveis } from './discovery';
import { selecionarFundo, selecionarVariantes } from './selecao';
import { caminhoSaida, PASTA_PROMO_ASSETS } from './types';

async function main() {
  const config = await carregarConfig();
  const todosSlugs = Object.keys(config);

  // Filtro opcional por linha de comando (ex.: `bun run promo ssm_elves`) pra
  // iterar rápido numa espécie só — as outras não são tocadas, nem para
  // limpeza de órfãos.
  const filtro = process.argv[2];
  if (filtro !== undefined && !todosSlugs.includes(filtro)) {
    console.error(`Espécie "${filtro}" não encontrada em species-promo.json. Disponíveis:`);
    for (const slug of todosSlugs) console.error(` - ${slug}`);
    process.exit(1);
  }
  const slugs = filtro !== undefined ? [filtro] : todosSlugs;

  const rooms = await carregarRoomsDisponiveis();

  // Resolve tudo (variantes + fundo, automático ou por override) antes de
  // compor qualquer imagem — erro em uma espécie trava a geração inteira, em
  // vez de deixar assets/promo/ com imagens novas e antigas misturadas.
  const resolvidos = await Promise.all(
    slugs.map(async (slug) => {
      try {
        const especie = config[slug];
        const info = await carregarVariantesDisponiveis(slug);
        const variantes = selecionarVariantes(info, especie.variantes);
        const fundo = selecionarFundo(slug, rooms, especie.fundo);
        return { slug, especie, variantes, fundo, erro: undefined as string | undefined };
      } catch (erro) {
        return {
          slug,
          especie: undefined,
          variantes: undefined,
          fundo: undefined,
          erro: erro instanceof Error ? erro.message : String(erro),
        };
      }
    })
  );

  const erros = resolvidos.flatMap((r) => (r.erro !== undefined ? [r.erro] : []));
  if (erros.length > 0) {
    console.error(`${erros.length} erro(s) encontrado(s) — nenhuma imagem foi gerada:`);
    for (const erro of erros) console.error(` - ${erro}`);
    process.exit(1);
  }

  for (const r of resolvidos) {
    // Inalcançável na prática (qualquer falha já teria virado erro acima),
    // só aqui pra o TypeScript estreitar os três campos juntos.
    if (r.especie === undefined || r.variantes === undefined || r.fundo === undefined) continue;
    await montarImagem(r.slug, r.especie, r.variantes, r.fundo, caminhoSaida(r.slug));
  }

  if (filtro === undefined) {
    await limparOrfaos(todosSlugs);
  }

  console.log(
    filtro !== undefined
      ? `Gerado: só ${filtro} (filtro de linha de comando).`
      : `Gerado: ${slugs.length} imagem(ns) de divulgação em assets/promo/.`
  );
}

/** Apaga `assets/promo/ssm_*.png` cuja espécie saiu de `species-promo.json` —
 * mesma lógica de limpeza de órfãos que `generate-portraits`/`generate-rooms`
 * aplicam do lado do `mod/`, aqui aplicada à própria saída em `assets/`. */
async function limparOrfaos(slugsValidos: string[]) {
  const itens = await readdir(PASTA_PROMO_ASSETS);
  const validos = new Set(slugsValidos.map((slug) => `${slug}.png`));
  for (const item of itens) {
    if (item.endsWith('.png') && item.startsWith('ssm_') && !validos.has(item)) {
      await unlink(join(PASTA_PROMO_ASSETS, item));
      console.log(`Removido órfão: assets/promo/${item}`);
    }
  }
}

main();
