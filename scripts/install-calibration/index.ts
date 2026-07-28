/**
 * Instala a arte de calibração no mod local, em todas as espécies do rig
 * `ssm_shared`, e imprime o roteiro de captura.
 *
 * Por que **não** passa pelo `bun run portrait`: o pipeline trata a arte de
 * `assets/` como master e a enquadra (trim → escala para a largura do guia →
 * composição). A calibração precisa do oposto — ocupar o canvas inteiro,
 * pixel a pixel, sem reescala. Então ela é convertida direto para DDS e
 * escrita por cima das texturas do mod.
 *
 * Isso torna a instalação **temporária e destrutiva no `mod/`** por
 * construção, o que é adequado: é instrumento de medição, não conteúdo. Um
 * `bun run portrait` desfaz tudo, regenerando as texturas a partir dos
 * masters.
 *
 * Instalar em **todas** as espécies, e não numa cobaia, elimina a parte cara
 * da captura: qualquer retrato que apareça no jogo vira régua, então não é
 * preciso caçar um império alienígena específico para ver o contexto de
 * diplomacia.
 *
 *   bun scripts/install-calibration/index.ts [--eixo y|x|ambos]
 */

import { $ } from 'bun';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PASTA_ASSETS, PASTA_MOD, PASTA_RAIZ, converter } from '../converter';
import { carregarEspecie, listarPastasEspecies } from '../generate-portraits/discovery';
import { rigDe } from '../generate-portraits/types';

const __DIRNAME = dirname(fileURLToPath(import.meta.url));

const PASTA_PORTRAITS_ASSETS = join(PASTA_ASSETS, 'portraits');
const PASTA_PORTRAITS_MOD = join(PASTA_MOD, 'gfx/models/portraits');
const TEMP = join(PASTA_RAIZ, '.calibracao-tmp');
const CONTEXTOS = join(__DIRNAME, '../measure-framing/contextos.json');

/** Como chegar em cada tela. O que decide o custo da captura não é a lista de
 * contextos — é quantos deles exigem uma partida em andamento. */
const TELAS: Record<string, { onde: string; partida: boolean }> = {
  'frontend.gui': { onde: 'menu principal do jogo (a tela que abre)', partida: false },
  'new_game_setup.gui': { onde: 'Novo Jogo → criação de império', partida: false },
  'select_empire_design.gui': { onde: 'Novo Jogo → lista de impérios salvos', partida: false },
  'species_portrait_picker_view.gui': { onde: 'criação de império → editar espécie → trocar retrato', partida: false },
  'species_mod_window.gui': { onde: 'criação de império → editar espécie', partida: false },
  'empire_view.gui': { onde: 'tela de império (partida)', partida: true },
  'diplomacy_view.gui': { onde: 'contatos / diplomacia (partida)', partida: true },
  'diplomacy_incoming_view.gui': { onde: 'mensagem diplomática recebida (partida)', partida: true },
  'first_contact_view.gui': { onde: 'evento de primeiro contato (partida)', partida: true },
  'galaxy_view.gui': { onde: 'mapa da galáxia → painel de espécie (partida)', partida: true },
  'topbar_species_view.gui': { onde: 'barra superior → espécies (partida)', partida: true },
  'planet_view.gui': { onde: 'planeta → demografia (partida)', partida: true },
  'leader_pool_view.gui': { onde: 'contratação de líderes (partida)', partida: true },
  'paragon_ui_types.gui': { onde: 'conselho / líderes (partida)', partida: true },
  'market_view.gui': { onde: 'mercado galáctico (partida)', partida: true },
  'the_shroud.gui': { onde: 'o Shroud (partida, império psiônico)', partida: true },
  'main.gui': { onde: 'HUD principal (partida)', partida: true },
  'endscreen.gui': { onde: 'tela de fim de jogo', partida: true },
};

interface Contexto {
  arquivo: string;
  caminho: string[];
  sprite: string;
  scale: number;
  janela: { x0: number; y0: number; x1: number; y1: number } | null;
  semRecorte: boolean;
  ressalvas: string[];
}

async function main() {
  const argEixo = process.argv.indexOf('--eixo');
  const eixo = argEixo >= 0 ? process.argv[argEixo + 1] : 'ambos';
  if (!['y', 'x', 'ambos'].includes(eixo)) {
    throw new Error(`--eixo aceita y, x ou ambos (recebido "${eixo}")`);
  }

  for (const e of ['y', 'x']) {
    const png = join(PASTA_PORTRAITS_ASSETS, `ssm_shared_calibracao_${e}.png`);
    if (!existsSync(png)) {
      throw new Error(`${png} não existe — rode antes: bun scripts/generate-calibration/index.ts`);
    }
  }

  // DDS pelo mesmo caminho de conversão do pipeline (BC3, sem mipmaps), para
  // que a textura instalada sofra exatamente a compressão que a de verdade
  // sofre — a margem da codificação de cor foi dimensionada contra ela.
  await rm(TEMP, { recursive: true, force: true });
  await mkdir(TEMP, { recursive: true });
  await converter(
    ['y', 'x'].map((e) => join(PASTA_PORTRAITS_ASSETS, `ssm_shared_calibracao_${e}.png`)),
    { format: 'bc3', noMips: true, pastaOrigem: PASTA_PORTRAITS_ASSETS, pastaDestino: TEMP }
  );

  const ddsPorEixo = {
    y: join(TEMP, 'ssm_shared_calibracao_y.dds'),
    x: join(TEMP, 'ssm_shared_calibracao_x.dds'),
  };

  const slugs = await listarPastasEspecies(PASTA_PORTRAITS_ASSETS);
  const especies = await Promise.all(
    slugs.map((slug) => carregarEspecie(PASTA_PORTRAITS_ASSETS, slug))
  );
  const alvos = especies.filter((info) => rigDe(info.config).guia);

  let instalados = 0;
  for (const info of alvos) {
    const pastaEspecie = join(PASTA_PORTRAITS_MOD, info.slug);
    const grupos = info.config.gendered
      ? [
          { sub: 'male', n: info.arquivosMale.length },
          { sub: 'female', n: info.arquivosFemale.length },
        ]
      : [{ sub: '', n: info.arquivosFlat.length }];

    for (const grupo of grupos) {
      for (let i = 1; i <= grupo.n; i++) {
        // Alternando os eixos entre slots vizinhos, qualquer contexto que
        // sorteie um retrato tende a mostrar os dois ao longo da sessão.
        const desteSlot = eixo === 'ambos' ? (i % 2 === 1 ? 'y' : 'x') : (eixo as 'y' | 'x');
        const destino = join(pastaEspecie, grupo.sub, `${String(i).padStart(3, '0')}.dds`);
        if (!existsSync(destino)) continue;
        await copyFile(ddsPorEixo[desteSlot], destino);
        instalados++;
      }
    }
  }

  await rm(TEMP, { recursive: true, force: true });

  console.log(
    `\n${instalados} textura(s) substituída(s) em ${alvos.length} espécie(s) — eixo: ${eixo}` +
      (eixo === 'ambos' ? ' (slots ímpares = Y, pares = X)' : '')
  );
  console.log('\nPróximo: bun run copy   (sem isso o jogo carrega a versão antiga)');
  console.log('Reverter:  bun run portrait && bun run copy');

  if (!existsSync(CONTEXTOS)) {
    console.log(`\n(${CONTEXTOS} não existe — rode bun scripts/measure-framing/index.ts para o roteiro)`);
    return;
  }

  const { contextos } = JSON.parse(await readFile(CONTEXTOS, 'utf-8')) as { contextos: Contexto[] };
  const confiaveis = contextos.filter((c) => c.ressalvas.length === 0);

  const chave = (c: Contexto) => `${c.arquivo}|${c.caminho.slice(-2).join('/')}|${c.sprite}`;
  const unicos = new Map<string, Contexto>();
  for (const c of confiaveis) if (!unicos.has(chave(c))) unicos.set(chave(c), c);

  const semRecorte = [...unicos.values()].filter((c) => c.semRecorte);
  const comJanela = [...unicos.values()].filter((c) => c.janela);

  console.log('\n' + '='.repeat(78));
  console.log('ROTEIRO DE CAPTURA');
  console.log('='.repeat(78));
  console.log(
    '\nSalve cada print como ARQUIVO em disco, resolução nativa, sem redimensionar\n' +
      'nem recortar. Anote qual tela é cada arquivo.\n'
  );

  console.log('--- PRIORIDADE 1: âncora (exibem o sprite INTEIRO) ---');
  console.log('Estes respondem a pergunta central: onde o topo do sprite cai no canvas.');
  console.log('Um basta por variante de câmera; os demais são conferência.\n');
  const p1 = semRecorte
    .filter((c) => TELAS[c.arquivo] && !TELAS[c.arquivo].partida)
    .sort((a, b) => a.sprite.localeCompare(b.sprite));
  for (const c of p1) {
    console.log(`  [ ] ${c.sprite}`);
    console.log(`      ${TELAS[c.arquivo].onde}  (${c.arquivo})`);
  }
  const p1Partida = semRecorte.filter((c) => TELAS[c.arquivo]?.partida);
  if (p1Partida.length > 0) {
    console.log('\n  Os mesmos, mas exigindo partida em andamento:');
    for (const c of p1Partida) {
      console.log(`  [ ] ${c.sprite} — ${TELAS[c.arquivo].onde}`);
    }
  }

  console.log('\n--- PRIORIDADE 2: validação do modelo (janela já calculada) ---');
  console.log('Não entram no ajuste: servem para conferir se a previsão bate.');
  console.log('Escolhidos por terem escalas bem diferentes entre si.\n');
  const p2 = comJanela
    .filter((c) => TELAS[c.arquivo])
    .sort((a, b) => a.scale - b.scale)
    .filter((_, i, arr) => i === 0 || i === Math.floor(arr.length / 2) || i === arr.length - 1);
  for (const c of p2) {
    console.log(`  [ ] escala ${c.scale} | topo previsto ${c.janela!.y0.toFixed(0)} (sprite)`);
    console.log(`      ${TELAS[c.arquivo].onde}  (${c.arquivo} :: ${c.caminho.slice(-1)[0]})`);
  }

  console.log('\n--- O que olhar nos prints ---');
  console.log('  • faixas horizontais = calibração do eixo Y; verticais = eixo X');
  console.log('  • os cantos são coloridos: vermelho=sup.esq, verde=sup.dir,');
  console.log('    azul=inf.esq, magenta=inf.dir — a ausência de um diz que aquele');
  console.log('    lado foi cortado, e a presença dos quatro diz que nada foi cortado');
  console.log('  • pips brancos marcam de 100 em 100 px do canvas\n');
}

main();
