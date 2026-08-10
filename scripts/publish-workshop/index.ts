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

// Frase fixa que o steamcmd imprime quando o workshop_build_item é commitado com sucesso — é o
// único sinal confiável de sucesso pra esse comando. O código de saída do steamcmd NÃO é: é um bug
// antigo e bem documentado da ferramenta terminar com código não-zero (ex.: 7) mesmo em publishes
// bem-sucedidos. Por isso o exit code só é usado aqui como sinal secundário/diagnóstico.
const REGEX_SUCESSO_STEAMCMD = /Committing update\.\.\.\s*Success\./;

/** Roda o steamcmd repassando stdin pro terminal de verdade (senha/Steam Guard continuam
 * interativos), mas capturando stdout/stderr — encaminhando cada pedaço pro terminal em tempo
 * real (o usuário vê o progresso igual antes) e acumulando pra procurar o sinal de sucesso depois
 * que o processo terminar. */
async function executarSteamcmd(args: string[]): Promise<{ codigoSaida: number; publicado: boolean }> {
  const processo = Bun.spawn([CAMINHO_STEAMCMD, ...args], {
    stdin: 'inherit',
    stdout: 'pipe',
    stderr: 'pipe',
    cwd: PASTA_RAIZ,
  });

  const decoder = new TextDecoder();
  let saidaCompleta = '';

  const encaminhar = async (stream: ReadableStream<Uint8Array>, destino: NodeJS.WriteStream) => {
    for await (const pedaco of stream) {
      const texto = decoder.decode(pedaco, { stream: true });
      saidaCompleta += texto;
      destino.write(texto);
    }
  };

  await Promise.all([
    encaminhar(processo.stdout as ReadableStream<Uint8Array>, process.stdout),
    encaminhar(processo.stderr as ReadableStream<Uint8Array>, process.stderr),
  ]);

  const codigoSaida = await processo.exited;
  return { codigoSaida, publicado: REGEX_SUCESSO_STEAMCMD.test(saidaCompleta) };
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
  // title/description são sempre enviados — todo publish (conteúdo ou metadata-only) mantém a
  // descrição da Steam em sincronia com description.md, não só o modo dedicado.
  const descricaoBbcode = markdownParaBBCode(await readFile(CAMINHO_DESCRIPTION, 'utf-8'));

  let changenoteBbcode: string | undefined;
  let resumoModo: string;
  let gravarChangeNotes: (() => Promise<void>) | null = null;

  if (modoMetadataOnly) {
    resumoModo = [
      'Modo: metadata-only (só título/descrição, sem publicar conteúdo novo)',
      `Título: ${descriptor.name}`,
      '',
      'Descrição (BBCode a ser enviada):',
      descricaoBbcode,
    ].join('\n');
  } else {
    const conteudoChangeNotes = await readFile(CAMINHO_CHANGE_NOTES, 'utf-8');
    const secao = extrairPrimeiraSecao(conteudoChangeNotes);
    const novaLinhaHeading = comTimestamp(secao, new Date());
    changenoteBbcode = markdownParaBBCode(secao.corpo);

    resumoModo = [
      'Modo: publicação de conteúdo (a descrição também é sincronizada com description.md)',
      `Versão do changelog: ${secao.versao}`,
      `Header será gravado como: ${novaLinhaHeading}`,
      '',
      'Changenote (BBCode a ser enviado):',
      changenoteBbcode,
    ].join('\n');

    gravarChangeNotes = () =>
      gravarTimestamp(CAMINHO_CHANGE_NOTES, conteudoChangeNotes, secao, novaLinhaHeading);
  }

  const vdfTexto = montarVdf({
    appid: APPID_STELLARIS,
    publishedFileId: descriptor.remoteFileId,
    contentFolder: PASTA_MOD,
    previewFile: CAMINHO_THUMBNAIL,
    title: descriptor.name,
    description: descricaoBbcode,
    changenote: changenoteBbcode,
  });

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
  const { codigoSaida, publicado } = await executarSteamcmd([
    '+login',
    usuarioSteam,
    '+workshop_build_item',
    CAMINHO_VDF,
    '+quit',
  ]);

  if (!publicado) {
    throw new Error(
      `steamcmd terminou com código de saída ${codigoSaida} e não encontrei "Committing update...Success." na saída — o publish provavelmente falhou de verdade. Confira o log em bin/steamcmd/logs/.`
    );
  }

  if (codigoSaida !== 0) {
    console.log(
      `⚠ steamcmd terminou com código de saída ${codigoSaida}, mas a saída confirma "Committing update...Success." — isso é uma manha conhecida do steamcmd nesse comando, não indica falha.`
    );
  }

  console.log('✓ publicado com sucesso.');
}

main().catch((erro) => {
  console.error(`✗ ${erro instanceof Error ? erro.message : String(erro)}`);
  process.exitCode = 1;
});
