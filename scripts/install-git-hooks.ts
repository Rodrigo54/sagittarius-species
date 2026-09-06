import { chmod, copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __DIRNAME = dirname(fileURLToPath(import.meta.url));
const PASTA_FONTE = join(__DIRNAME, 'git-hooks');
const PASTA_DESTINO = join(__DIRNAME, '../.git/hooks');

/** Copia os hooks versionados em `scripts/git-hooks/` para `.git/hooks/`.
 *
 * A cópia é hook a hook, e não uma troca de `core.hooksPath`, porque o
 * `.git/hooks/` deste repositório também guarda os hooks do git-lfs
 * (post-checkout, post-commit, post-merge, pre-push): apontar o hooksPath para
 * outra pasta desligaria o LFS em silêncio. */
async function main() {
  const hooks = await readdir(PASTA_FONTE);

  await mkdir(PASTA_DESTINO, { recursive: true });

  for (const hook of hooks) {
    const destino = join(PASTA_DESTINO, hook);
    await copyFile(join(PASTA_FONTE, hook), destino);
    await chmod(destino, 0o755);
    console.log(`✔ ${hook}`);
  }
}

main();
