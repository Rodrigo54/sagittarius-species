import sevenBin from '7zip-bin';
import { extractFull } from 'node-7z';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __DIRNAME = dirname(fileURLToPath(import.meta.url));
const PASTA_BIN = join(__DIRNAME, '../bin');

type Ferramenta = {
  nome: string;
  versao: string;
  url: string;
  tipo: 'exe' | '7z';
  /** Nome do executável a localizar dentro do pacote extraído (só usado quando tipo === '7z') */
  executavel?: string;
};

// Versões fixadas manualmente. Atualize aqui (e só aqui) para subir de versão.
const FERRAMENTAS: Ferramenta[] = [
  {
    nome: 'texconv',
    versao: 'may2026',
    url: 'https://github.com/microsoft/DirectXTex/releases/download/may2026/texconv.exe',
    tipo: 'exe',
  },
  {
    nome: 'imagemagick',
    versao: '7.1.2-27',
    url: 'https://github.com/ImageMagick/ImageMagick/releases/download/7.1.2-27/ImageMagick-7.1.2-27-portable-Q16-x64.7z',
    tipo: '7z',
    executavel: 'magick.exe',
  },
];

const caminhoArquivoVersao = (pastaFerramenta: string) => join(pastaFerramenta, '.version');

const lerVersaoInstalada = async (pastaFerramenta: string) => {
  const arquivo = caminhoArquivoVersao(pastaFerramenta);
  if (!existsSync(arquivo)) return null;
  return (await readFile(arquivo, 'utf-8')).trim();
};

const gravarVersaoInstalada = async (pastaFerramenta: string, versao: string) => {
  await writeFile(caminhoArquivoVersao(pastaFerramenta), versao);
};

const baixarArquivo = async (url: string, destino: string) => {
  const resposta = await fetch(url);
  if (!resposta.ok) {
    throw new Error(`Falha ao baixar ${url}: ${resposta.status} ${resposta.statusText}`);
  }
  await writeFile(destino, Buffer.from(await resposta.arrayBuffer()));
};

const encontrarArquivo = async (pasta: string, nomeArquivo: string): Promise<string | null> => {
  const itens = await readdir(pasta, { withFileTypes: true });
  for (const item of itens) {
    const caminho = join(pasta, item.name);
    if (item.isDirectory()) {
      const encontrado = await encontrarArquivo(caminho, nomeArquivo);
      if (encontrado) return encontrado;
    } else if (item.name.toLowerCase() === nomeArquivo.toLowerCase()) {
      return caminho;
    }
  }
  return null;
};

const copiarConteudoPasta = async (origem: string, destino: string) => {
  const itens = await readdir(origem, { withFileTypes: true });
  for (const item of itens) {
    const caminhoOrigem = join(origem, item.name);
    const caminhoDestino = join(destino, item.name);
    if (item.isDirectory()) {
      await mkdir(caminhoDestino, { recursive: true });
      await copiarConteudoPasta(caminhoOrigem, caminhoDestino);
    } else {
      await copyFile(caminhoOrigem, caminhoDestino);
    }
  }
};

const instalarExeUnico = async (ferramenta: Ferramenta, pastaFerramenta: string) => {
  const nomeArquivo = ferramenta.url.split('/').pop()!;
  await baixarArquivo(ferramenta.url, join(pastaFerramenta, nomeArquivo));
};

const instalarPacote7z = async (ferramenta: Ferramenta, pastaFerramenta: string) => {
  const pastaTemp = join(PASTA_BIN, `.tmp-${ferramenta.nome}`);
  await rm(pastaTemp, { recursive: true, force: true });
  await mkdir(pastaTemp, { recursive: true });

  try {
    const nomeArquivo = ferramenta.url.split('/').pop()!;
    const caminhoBaixado = join(pastaTemp, nomeArquivo);
    await baixarArquivo(ferramenta.url, caminhoBaixado);

    const pastaExtraida = join(pastaTemp, 'extraido');
    await mkdir(pastaExtraida, { recursive: true });
    await new Promise<void>((resolve, reject) => {
      const stream = extractFull(caminhoBaixado, pastaExtraida, {
        $bin: sevenBin.path7za,
      });
      stream.on('end', () => resolve());
      stream.on('error', reject);
    });

    const executavel = await encontrarArquivo(pastaExtraida, ferramenta.executavel!);
    if (!executavel) {
      throw new Error(
        `Não encontrei "${ferramenta.executavel}" dentro do pacote extraído de ${ferramenta.nome}`
      );
    }

    await rm(pastaFerramenta, { recursive: true, force: true });
    await mkdir(pastaFerramenta, { recursive: true });
    await copiarConteudoPasta(dirname(executavel), pastaFerramenta);
  } finally {
    await rm(pastaTemp, { recursive: true, force: true });
  }
};

const instalarFerramenta = async (ferramenta: Ferramenta) => {
  const pastaFerramenta = join(PASTA_BIN, ferramenta.nome);
  await mkdir(pastaFerramenta, { recursive: true });

  const versaoAtual = await lerVersaoInstalada(pastaFerramenta);
  if (versaoAtual === ferramenta.versao) {
    console.log(`✓ ${ferramenta.nome} já está na versão ${ferramenta.versao}, pulando`);
    return;
  }

  console.log(`↓ baixando ${ferramenta.nome} ${ferramenta.versao}...`);

  if (ferramenta.tipo === 'exe') {
    await instalarExeUnico(ferramenta, pastaFerramenta);
  } else {
    await instalarPacote7z(ferramenta, pastaFerramenta);
  }

  await gravarVersaoInstalada(pastaFerramenta, ferramenta.versao);
  console.log(`✓ ${ferramenta.nome} ${ferramenta.versao} instalado em bin/${ferramenta.nome}`);
};

const main = async () => {
  await mkdir(PASTA_BIN, { recursive: true });
  for (const ferramenta of FERRAMENTAS) {
    await instalarFerramenta(ferramenta);
  }
};

main();
