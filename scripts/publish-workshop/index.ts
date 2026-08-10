import { $ } from 'bun';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { comTimestamp, extrairPrimeiraSecao, gravarTimestamp } from './change-notes';
import { parseDescriptorMod } from './descriptor';
import { markdownParaBBCode } from './md-to-bbcode';
import { montarVdf } from './vdf';

const __DIRNAME = dirname(fileURLToPath(import.meta.url));

const PASTA_RAIZ = join(__DIRNAME, '../..');
const PASTA_MOD = join(PASTA_RAIZ, 'mod/sagittarius-species');
const CAMINHO_DESCRIPTOR = join(PASTA_MOD, 'descriptor.mod');
const CAMINHO_THUMBNAIL = join(PASTA_MOD, 'thumbnail.png');
const CAMINHO_CHANGE_NOTES = join(PASTA_RAIZ, 'steam-workshop/change-notes.md');
const CAMINHO_DESCRIPTION = join(PASTA_RAIZ, 'steam-workshop/description.md');
const CAMINHO_STEAMCMD = join(PASTA_RAIZ, 'bin/steamcmd/steamcmd.exe');
const CAMINHO_VDF = join(PASTA_RAIZ, 'bin/steamcmd/publish.vdf');

// Fixo — appid do Stellaris na Steam, não muda.
const APPID_STELLARIS = '281990';

async function confirmar(pergunta: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const resposta = await rl.question(`${pergunta} (digite "sim" para confirmar) `);
    return resposta.trim().toLowerCase() === 'sim';
  } finally {
    rl.close();
  }
}

async function main() {
  if (process.platform !== 'win32') {
    throw new Error('publish-workshop só roda no Windows (depende do steamcmd.exe baixado por "bun run setup").');
  }

  const { values } = parseArgs({
    options: {
      'metadata-only': { type: 'boolean', default: false },
    },
  });
  const modoMetadataOnly = values['metadata-only'] === true;

  if (!existsSync(CAMINHO_STEAMCMD)) {
    throw new Error(`steamcmd não encontrado em ${CAMINHO_STEAMCMD}. Rode "bun run setup" primeiro.`);
  }

  const usuarioSteam = process.env.STEAM_USERNAME;
  if (!usuarioSteam) {
    throw new Error(
      'STEAM_USERNAME não está definida. Copie .env.example para .env na raiz do projeto e preencha o seu usuário Steam.'
    );
  }

  const descriptor = parseDescriptorMod(await readFile(CAMINHO_DESCRIPTOR, 'utf-8'));

  let vdfTexto: string;
  let resumoModo: string;
  let gravarChangeNotes: (() => Promise<void>) | null = null;

  if (modoMetadataOnly) {
    const descricaoBbcode = markdownParaBBCode(await readFile(CAMINHO_DESCRIPTION, 'utf-8'));

    vdfTexto = montarVdf({
      modo: 'metadata',
      appid: APPID_STELLARIS,
      publishedFileId: descriptor.remoteFileId,
      contentFolder: PASTA_MOD,
      previewFile: CAMINHO_THUMBNAIL,
      title: descriptor.name,
      description: descricaoBbcode,
    });

    resumoModo = [
      'Modo: metadata-only (só título/descrição, sem changenote)',
      `Título: ${descriptor.name}`,
      '',
      'Descrição (BBCode a ser enviado):',
      descricaoBbcode,
    ].join('\n');
  } else {
    const conteudoChangeNotes = await readFile(CAMINHO_CHANGE_NOTES, 'utf-8');
    const secao = extrairPrimeiraSecao(conteudoChangeNotes);
    const novaLinhaHeading = comTimestamp(secao, new Date());
    const changenoteBbcode = markdownParaBBCode(secao.corpo);

    vdfTexto = montarVdf({
      modo: 'conteudo',
      appid: APPID_STELLARIS,
      publishedFileId: descriptor.remoteFileId,
      contentFolder: PASTA_MOD,
      previewFile: CAMINHO_THUMBNAIL,
      changenote: changenoteBbcode,
    });

    resumoModo = [
      'Modo: publicação de conteúdo',
      `Versão do changelog: ${secao.versao}`,
      `Header será gravado como: ${novaLinhaHeading}`,
      '',
      'Changenote (BBCode a ser enviado):',
      changenoteBbcode,
    ].join('\n');

    gravarChangeNotes = () =>
      gravarTimestamp(CAMINHO_CHANGE_NOTES, conteudoChangeNotes, secao, novaLinhaHeading);
  }

  console.log('== Resumo do publish no Steam Workshop ==');
  console.log(`Versão do mod (descriptor.mod): ${descriptor.version}`);
  console.log(`publishedfileid: ${descriptor.remoteFileId}`);
  console.log(`contentfolder: ${PASTA_MOD}`);
  console.log('');
  console.log(resumoModo);
  console.log('');
  console.log('Antes de publicar, este comando também roda "bun run copy" pra sincronizar o mod local de teste.');
  console.log('');

  const confirmado = await confirmar('Prosseguir?');
  if (!confirmado) {
    console.log('Cancelado — nada foi publicado, change-notes.md não foi alterado.');
    return;
  }

  console.log('→ sincronizando mod local (bun run copy)...');
  await $`bun run copy`.cwd(PASTA_RAIZ);

  if (gravarChangeNotes) {
    await gravarChangeNotes();
  }

  await writeFile(CAMINHO_VDF, vdfTexto, 'utf-8');

  console.log('→ publicando no Steam Workshop via steamcmd (pode pedir senha / código do Steam Guard)...');
  const processo = Bun.spawn(
    [CAMINHO_STEAMCMD, '+login', usuarioSteam, '+workshop_build_item', CAMINHO_VDF, '+quit'],
    { stdio: ['inherit', 'inherit', 'inherit'], cwd: PASTA_RAIZ }
  );
  const codigoSaida = await processo.exited;
  if (codigoSaida !== 0) {
    throw new Error(`steamcmd terminou com código de saída ${codigoSaida}`);
  }

  console.log('✓ publicado com sucesso.');
}

main().catch((erro) => {
  console.error(`✗ ${erro instanceof Error ? erro.message : String(erro)}`);
  process.exitCode = 1;
});
