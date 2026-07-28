/**
 * One-shot: restaura a arte-fonte das espécies do rig `ssm_shared` ao estado
 * pré-migração, trimada no bounding box de conteúdo.
 *
 * Por quê: `scripts/migrate-portraits/` reenquadrava os PNGs de
 * `assets/portraits/` **in place** — a arte publicada hoje é o resultado de um
 * resize (de +18% a +45% de upscale sobre a fonte), e o original só sobrevive
 * no git. Com o enquadramento passando a ser derivado no `generate-portraits`,
 * `assets/` volta a guardar arte nativa, e o canvas deixa de ser uma decisão
 * permanente.
 *
 * O trim é `-trim +repage` sem fuzz: remove apenas pixels 100% transparentes,
 * preservando o halo de alpha 1..7 que a IA deixa em volta da arte (é ele que
 * o enquadramento enxerga como conteúdo). Perda zero.
 *
 * Rodar com: bun scripts/restore-masters/index.ts
 */

import { $ } from 'bun';
import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __DIRNAME = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(__DIRNAME, '../..');
const MAGICK = join(RAIZ, 'bin/imagemagick/magick.exe');
const TEMP = join(RAIZ, '.restore-masters-tmp');

/** Commit em que cada espécie foi migrada para o `ssm_shared`. O estado
 * pré-migração é o pai desse commit — e é seguro usá-lo como fonte porque
 * nenhuma das 16 teve a arte tocada depois da própria migração (conferido com
 * `git log <commit>..HEAD -- assets/portraits/<slug>/`, zero commits em todas).
 *
 * `ssm_mermaids` e `ssm_astral` não estão aqui de propósito: foram revertidas
 * para o `sl_shared` na preparação da 1.8.0 e seguem congeladas. */
const MIGRACOES: Record<string, string> = {
  ssm_avians: 'c151d8c',
  ssm_cyborg: '3e76d2b',
  ssm_default: '8ddc7bf',
  ssm_elves: '0fd5319',
  ssm_gamba: '427bdeb',
  ssm_green_elves: '2cf8c84',
  ssm_green_order: 'e9df081',
  ssm_hastur: '29647b4',
  ssm_high_elves: '5a0d839',
  ssm_knight: 'e07a4f6',
  ssm_mercenary: 'b450006',
  ssm_necron: '2440f0f',
  ssm_new_order: '9ce69b2',
  ssm_octopus: 'ec0433a',
  ssm_timbot: '8f5ccd5',
  ssm_vargrosianos: '8a6c755',
};

/** Canvas do rig `sl_shared`, que toda arte pré-migração usava. Serve de
 * sanidade: se um arquivo extraído não tiver essa dimensão, o commit mapeado
 * está errado (ou a arte já era outra coisa) e a restauração precisa parar. */
const CANVAS_PRE_MIGRACAO = { largura: 825, altura: 1650 } as const;

interface Arquivo {
  /** Caminho relativo à raiz do repo, como o git o conhece. */
  caminhoGit: string;
  /** Caminho absoluto no disco. */
  destino: string;
  /** Onde o extraído fica até a validação terminar. */
  temporario: string;
}

interface Especie {
  slug: string;
  commitPreMigracao: string;
  arquivos: Arquivo[];
}

function lerDimensoesPng(buf: Buffer): { largura: number; altura: number } {
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) {
    throw new Error('não é um PNG');
  }
  return { largura: buf.readUInt32BE(16), altura: buf.readUInt32BE(20) };
}

/** Lista os PNGs da espécie como eles existiam antes da migração. Usa a árvore
 * do git (não o disco) porque é ela a fonte da restauração — se a contagem
 * divergir da atual, é sinal de que a migração mexeu na composição da espécie
 * e o caso precisa de olho humano antes de sobrescrever qualquer coisa. */
async function listarNoGit(slug: string, commit: string): Promise<string[]> {
  const saida = await $`git ls-tree -r --name-only ${commit} -- assets/portraits/${slug}/`
    .cwd(RAIZ)
    .text();
  return saida
    .trim()
    .split('\n')
    .filter((linha) => linha.endsWith('.png'))
    .sort();
}

async function listarNoDisco(slug: string): Promise<string[]> {
  const saida = await $`git ls-files assets/portraits/${slug}/`.cwd(RAIZ).text();
  return saida
    .trim()
    .split('\n')
    .filter((linha) => linha.endsWith('.png'))
    .sort();
}

async function main() {
  if (!existsSync(MAGICK)) {
    throw new Error(`ImageMagick não encontrado em ${MAGICK} — rode "bun run setup"`);
  }

  const sujo = (await $`git status --porcelain assets/portraits/`.cwd(RAIZ).text()).trim();
  if (sujo) {
    throw new Error(
      `assets/portraits/ tem mudanças não commitadas — a restauração sobrescreve arquivos e o git é a rede de segurança:\n${sujo}`
    );
  }

  await rm(TEMP, { recursive: true, force: true });

  // ---- Fase 1: extrair tudo e validar, sem escrever no lugar definitivo ----
  const especies: Especie[] = [];
  const erros: string[] = [];
  const relatorio: string[] = [];

  for (const [slug, commitMigracao] of Object.entries(MIGRACOES)) {
    const commitPreMigracao = `${commitMigracao}^`;
    const noGit = await listarNoGit(slug, commitPreMigracao);
    const noDisco = await listarNoDisco(slug);

    if (noGit.length === 0) {
      erros.push(`${slug}: nenhum PNG encontrado em ${commitPreMigracao} — commit mapeado está errado?`);
      continue;
    }
    if (noGit.length !== noDisco.length) {
      erros.push(
        `${slug}: ${noGit.length} PNG(s) antes da migração vs. ${noDisco.length} hoje — a migração mudou a composição da espécie, precisa de análise manual`
      );
      continue;
    }
    const faltando = noGit.filter((c) => !noDisco.includes(c));
    if (faltando.length > 0) {
      erros.push(`${slug}: arquivo(s) que existiam antes e não existem hoje: ${faltando.join(', ')}`);
      continue;
    }

    const arquivos: Arquivo[] = [];
    let menorTrim = Infinity;
    let maiorTrim = 0;

    for (const caminhoGit of noGit) {
      const temporario = join(TEMP, caminhoGit);
      await mkdir(dirname(temporario), { recursive: true });

      const conteudo = Buffer.from(
        await $`git show ${commitPreMigracao}:${caminhoGit}`.cwd(RAIZ).arrayBuffer()
      );

      let dim: { largura: number; altura: number };
      try {
        dim = lerDimensoesPng(conteudo);
      } catch (e) {
        erros.push(`${caminhoGit}: extraído de ${commitPreMigracao} não é um PNG válido (${e})`);
        continue;
      }
      if (dim.largura !== CANVAS_PRE_MIGRACAO.largura || dim.altura !== CANVAS_PRE_MIGRACAO.altura) {
        erros.push(
          `${caminhoGit}: ${dim.largura}x${dim.altura} em ${commitPreMigracao}, esperado ${CANVAS_PRE_MIGRACAO.largura}x${CANVAS_PRE_MIGRACAO.altura} (canvas do sl_shared)`
        );
        continue;
      }

      await writeFile(temporario, conteudo);
      arquivos.push({ caminhoGit, destino: join(RAIZ, caminhoGit), temporario });
    }

    // Trim box do lote inteiro numa invocação só, pro relatório e pra garantir
    // que nenhuma arte é 100% transparente (trim de canvas vazio é erro).
    if (arquivos.length > 0) {
      const caminhos = arquivos.map((a) => a.temporario);
      const saida = await $`${MAGICK} identify -format ${'%@\n'} ${caminhos}`.text();
      const linhas = saida.trim().split('\n');
      if (linhas.length !== caminhos.length) {
        erros.push(`${slug}: identify devolveu ${linhas.length} medida(s) para ${caminhos.length} arquivo(s)`);
      } else {
        linhas.forEach((linha, i) => {
          const m = linha.trim().match(/^(\d+)x(\d+)[+-]\d+[+-]\d+$/);
          if (!m) {
            erros.push(`${arquivos[i].caminhoGit}: trim box ilegível ("${linha}")`);
            return;
          }
          const larg = Number(m[1]);
          const alt = Number(m[2]);
          if (larg === 0 || alt === 0) {
            erros.push(`${arquivos[i].caminhoGit}: conteúdo vazio (canvas 100% transparente)`);
          }
          menorTrim = Math.min(menorTrim, larg);
          maiorTrim = Math.max(maiorTrim, larg);
        });
      }
    }

    especies.push({ slug, commitPreMigracao, arquivos });
    relatorio.push(
      `  ${slug.padEnd(18)} ${String(arquivos.length).padStart(3)} PNG  ` +
        `825x1650 -> largura de conteúdo ${menorTrim}..${maiorTrim}`
    );
  }

  if (erros.length > 0) {
    await rm(TEMP, { recursive: true, force: true });
    console.error(`\n${erros.length} erro(s) — nada foi escrito:\n`);
    for (const erro of erros) console.error(`  - ${erro}`);
    process.exit(1);
  }

  // ---- Fase 2: trim e gravação no lugar definitivo ----
  let total = 0;
  for (const especie of especies) {
    for (const arquivo of especie.arquivos) {
      await $`${MAGICK} ${arquivo.temporario} -trim +repage ${`PNG32:${arquivo.destino}`}`.quiet();
      total++;
    }
  }

  await rm(TEMP, { recursive: true, force: true });

  console.log(`\n${total} master(s) restaurado(s) em ${especies.length} espécie(s):\n`);
  for (const linha of relatorio) console.log(linha);
}

main();
