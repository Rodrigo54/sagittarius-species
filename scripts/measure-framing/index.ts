/**
 * Extrai dos `.gui` do Stellaris a janela visível do retrato em cada contexto
 * de UI, e grava a tabela em `contextos.json` para as etapas de medição.
 *
 * Por que isso existe: o corte superior do quadro de retrato era estimado a
 * olho em screenshots ("y≈200 no card de origem, y≈300 no banner"), e esse
 * número define o teto permanente da composição de toda arte futura. Aqui ele
 * deixa de ser estimativa: o enquadramento é declarado nos arquivos do jogo, e
 * a janela sai por aritmética de layout (ver `gui-layout.ts`).
 *
 * A saída ainda está em coordenadas do **sprite do retrato**. Convertê-la para
 * coordenadas do canvas de textura exige uma âncora empírica por variante de
 * câmera — é o papel dos screenshots de calibração, uma etapa depois.
 *
 * Rode de novo quando o jogo receber patch: a tabela se revalida sozinha,
 * sem precisar de novos screenshots.
 *
 *   bun scripts/measure-framing/index.ts [caminho-da-instalacao]
 */

import { Jomini } from 'jomini';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { coletarContextos, montarArvore, type Contexto } from './gui-layout';
import { lerNomesDeRetrato } from './portrait-types';

const __DIRNAME = dirname(fileURLToPath(import.meta.url));

// Caminho local da instalação do Stellaris. Ajuste se sua instalação Steam
// estiver em outra unidade/pasta (mesma convenção de extract-vanilla-keys.ts).
const STELLARIS_PATH = process.argv[2] ?? 'D:/SteamLibrary/steamapps/common/Stellaris';

const DESTINO = join(__DIRNAME, 'contextos.json');

async function main() {
  const pastaInterface = join(STELLARIS_PATH, 'interface');
  const arquivos = (await readdir(pastaInterface)).filter((f) => f.endsWith('.gui')).sort();

  if (arquivos.length === 0) {
    throw new Error(`nenhum .gui em ${pastaInterface} — instalação do Stellaris está nesse caminho?`);
  }

  const nomes = await lerNomesDeRetrato(STELLARIS_PATH);
  const spritesDeRetrato = new Set(nomes);
  console.log(`${nomes.length} portraitType de personagem declarados nos .gfx do jogo`);

  const jomini = await Jomini.initialize();
  const contextos: Contexto[] = [];
  const ilegiveis: string[] = [];

  for (const arquivo of arquivos) {
    const bruto = await readFile(join(pastaInterface, arquivo));
    let objeto: unknown;
    try {
      objeto = jomini.parseText(bruto, { encoding: 'windows1252' });
    } catch (e) {
      ilegiveis.push(`${arquivo}: ${e instanceof Error ? e.message : e}`);
      continue;
    }

    const raiz = (objeto as Record<string, unknown>).guiTypes ?? objeto;
    contextos.push(...coletarContextos(montarArvore(raiz, 'guiTypes'), arquivo, spritesDeRetrato));
  }

  const confiaveis = contextos.filter((c) => c.ressalvas.length === 0);
  const resolvidos = confiaveis.filter((c) => c.janela);
  const semRecorte = confiaveis.filter((c) => c.semRecorte);
  const comRessalva = contextos.filter((c) => c.ressalvas.length > 0);

  await writeFile(DESTINO, `${JSON.stringify({ contextos }, null, 2)}\n`);

  console.log(
    `${arquivos.length} arquivo(s) .gui | ${contextos.length} contexto(s) de retrato | ` +
      `${resolvidos.length} com janela, ${semRecorte.length} sem recorte, ${comRessalva.length} com ressalva`
  );

  if (semRecorte.length > 0) {
    // Consequência direta para o corte do plano: se algum contexto exibe o
    // sprite inteiro, o topo do sprite (y = 0) chega à tela, e é ele — não o
    // clipping de UI — que fixa o limite superior do que a câmera captura.
    console.log(
      `\n### ${semRecorte.length} contexto(s) exibem o sprite INTEIRO (nenhum ancestral recorta)`
    );
    for (const c of semRecorte.slice(0, 6)) {
      console.log(`  ${c.sprite} | ${c.arquivo} :: ${c.caminho.slice(-2).join('/')}`);
    }
    if (semRecorte.length > 6) console.log(`  ... e mais ${semRecorte.length - 6}`);
  }
  if (ilegiveis.length > 0) {
    console.log(`\n${ilegiveis.length} arquivo(s) ilegível(is):`);
    for (const linha of ilegiveis) console.log(`  ${linha}`);
  }

  const porSprite = new Map<string, Contexto[]>();
  for (const c of resolvidos) {
    if (!porSprite.has(c.sprite)) porSprite.set(c.sprite, []);
    porSprite.get(c.sprite)!.push(c);
  }

  for (const [sprite, lista] of [...porSprite].sort((a, b) => b[1].length - a[1].length)) {
    lista.sort((a, b) => a.janela!.y0 - b.janela!.y0);
    console.log(`\n### ${sprite} — ${lista.length} contexto(s) resolvido(s)`);
    console.log('   topo    base  |  esq  dir  | scale | arquivo :: caminho');
    const mostrar = (c: Contexto) =>
      console.log(
        `  ${c.janela!.y0.toFixed(0).padStart(6)}  ${c.janela!.y1.toFixed(0).padStart(6)}  | ` +
          `${c.janela!.x0.toFixed(0).padStart(5)} ${c.janela!.x1.toFixed(0).padStart(5)} | ` +
          `${String(c.scale).padStart(5)} | ${c.arquivo} :: ${c.caminho.slice(-2).join('/')}`
      );
    // Os extremos são o que decide o corte: o topo mais generoso diz até onde
    // o plano pode ser recortado; o mais agressivo, até onde a arte pode subir.
    for (const c of lista.slice(0, 5)) mostrar(c);
    if (lista.length > 8) console.log(`  ${'.'.repeat(20)} (${lista.length - 8} omitido(s))`);
    for (const c of lista.slice(-3)) mostrar(c);
  }

  if (comRessalva.length > 0) {
    console.log(`\n### ${comRessalva.length} contexto(s) com ressalva (fora da tabela até inspeção)`);
    const motivos = new Map<string, number>();
    for (const c of comRessalva) {
      for (const r of c.ressalvas) {
        const chave = r.split('—')[0].trim();
        motivos.set(chave, (motivos.get(chave) ?? 0) + 1);
      }
    }
    for (const [motivo, n] of [...motivos].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${String(n).padStart(3)}x  ${motivo}`);
    }
  }

  console.log(`\nTabela completa: ${DESTINO}`);
}

main();
