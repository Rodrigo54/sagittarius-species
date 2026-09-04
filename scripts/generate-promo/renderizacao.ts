/** Carrega HTML no browser de um jeito que `file://` funcione dentro dele.
 *
 * `page.setContent()` carrega o documento como `about:blank` — o
 * Chromium/Edge bloqueia por segurança que um documento nessa origem carregue
 * recursos `file://` (imagens, fontes), e a falha é silenciosa: sem erro JS,
 * a `<img>` simplesmente não aparece. Escrever o HTML num arquivo temporário
 * e navegar até ele via `page.goto('file://...')` dá ao documento a mesma
 * origem `file://` dos recursos que ele referencia, e o carregamento
 * funciona normalmente. */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Page } from 'playwright';
import { PASTA_RAIZ } from '../converter';

const PASTA_STAGING = join(PASTA_RAIZ, '.promo-staging');

export async function renderizarHtml(page: Page, html: string, nomeArquivo: string): Promise<void> {
  await mkdir(PASTA_STAGING, { recursive: true });
  const caminho = join(PASTA_STAGING, nomeArquivo);
  await writeFile(caminho, html, 'utf-8');
  await page.goto(pathToFileURL(caminho).href, { waitUntil: 'load' });
}
