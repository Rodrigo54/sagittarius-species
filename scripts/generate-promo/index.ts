// O projeto compila sem lib DOM (scripts/tsconfig.json — código Bun
// server-side); esta referência traz `document` só pro corpo da função que o
// Playwright serializa e roda dentro do browser (`page.evaluate`).
/// <reference lib="dom" />

import { readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { calibrar } from './calibracao';
import { montarImagem } from './composicao';
import { carregarConfig, carregarRoomsDisponiveis, carregarVariantesDisponiveis } from './discovery';
import { CANVAS } from './layout';
import { renderizarHtml } from './renderizacao';
import { selecionarFundo, selecionarVariantes } from './selecao';
import { paginaDeCalibracaoHtml } from './template';
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

  // `channel: 'msedge'` usa o Edge já instalado no Windows em vez de baixar
  // um Chromium próprio do Playwright — este pipeline não precisa de um
  // browser vendorizado em `bin/`, só de renderizar HTML/CSS local.
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: CANVAS.largura, height: CANVAS.altura } });

    // Calibração de font-size roda contra o config INTEIRO, nunca só o
    // filtro — o tamanho do texto é global entre as 19 espécies, pra manter
    // a identidade visual consistente entre execuções filtradas e completas.
    await renderizarHtml(page, paginaDeCalibracaoHtml(), 'calibracao.html');
    await page.evaluate(() => document.fonts.ready);
    const fontes = await calibrar(page, config, 'PromoTitulo', 'PromoCorpo');

    for (const r of resolvidos) {
      // Inalcançável na prática (qualquer falha já teria virado erro acima),
      // só aqui pra o TypeScript estreitar os três campos juntos.
      if (r.especie === undefined || r.variantes === undefined || r.fundo === undefined) continue;
      await montarImagem(page, r.slug, r.especie, r.variantes, r.fundo, caminhoSaida(r.slug), fontes);
    }
  } finally {
    await browser.close();
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

/** Apaga `assets/promo/ssm_*.jpg` cuja espécie saiu de `species-promo.json` —
 * mesma lógica de limpeza de órfãos que `generate-portraits`/`generate-rooms`
 * aplicam do lado do `mod/`, aqui aplicada à própria saída em `assets/`.
 * Também varre `.png`: a saída era PNG antes da migração pra JPEG (Steam
 * rejeitava o tamanho), então qualquer `ssm_*.png` remanescente de uma
 * execução anterior é órfão por definição — nenhuma espécie gera mais PNG. */
async function limparOrfaos(slugsValidos: string[]) {
  const itens = await readdir(PASTA_PROMO_ASSETS);
  const validos = new Set(slugsValidos.map((slug) => `${slug}.jpg`));
  for (const item of itens) {
    const eOrfao =
      item.startsWith('ssm_') && (item.endsWith('.png') || (item.endsWith('.jpg') && !validos.has(item)));
    if (eOrfao) {
      await unlink(join(PASTA_PROMO_ASSETS, item));
      console.log(`Removido órfão: assets/promo/${item}`);
    }
  }
}

main();
