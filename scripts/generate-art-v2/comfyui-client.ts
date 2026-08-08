import type { PromptComfyUI } from './workflow';

/** Duplicado de `scripts/generate-art/comfyui-client.ts` — decisão tomada na
 * entrevista de planejamento da v2: fala com a API REST do ComfyUI, não sabe
 * nada de SDXL/Flux, então é motor-agnóstico. Duplicado (não importado) por
 * `generate-art-v2/` continuar autocontida mesmo se `scripts/generate-art/`
 * (v1) for apagada no futuro — mesmo espírito do padrão "cada pipeline vive
 * na sua pasta" que o resto do repositório já segue. Se este arquivo for
 * ajustado aqui, considere se o irmão do v1 precisa do mesmo ajuste. */

/** Endereço da instância local do ComfyUI. Sem variável de ambiente hoje
 * porque só existe uma instância local em uso (StabilityMatrix) — mesmo
 * espírito do caminho hardcoded no topo de `measure-framing/index.ts`. */
const BASE_URL = 'http://127.0.0.1:8188';

interface RespostaEnfileiramento {
  prompt_id: string;
  number: number;
  node_errors: Record<string, unknown>;
}

export async function enfileirar(prompt: PromptComfyUI): Promise<string> {
  const resp = await fetch(`${BASE_URL}/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, client_id: crypto.randomUUID() }),
  });

  if (!resp.ok) {
    const corpo = await resp.text();
    throw new Error(`ComfyUI recusou o prompt (HTTP ${resp.status}): ${corpo}`);
  }

  const dados = (await resp.json()) as RespostaEnfileiramento;
  if (dados.node_errors && Object.keys(dados.node_errors).length > 0) {
    throw new Error(`ComfyUI reportou erro de validação de node: ${JSON.stringify(dados.node_errors)}`);
  }
  return dados.prompt_id;
}

export interface ImagemGerada {
  filename: string;
  subfolder: string;
  type: string;
}

interface EntradaHistorico {
  status?: { status_str: string; completed: boolean; messages: unknown[] };
  outputs?: Record<string, { images?: ImagemGerada[] }>;
}

/** Faz polling em `/history/{id}` até o prompt terminar (sucesso ou erro).
 * Sem endpoint de "espera bloqueante" na API do ComfyUI — polling é o jeito
 * documentado de acompanhar a fila. */
export async function aguardarConclusao(promptId: string, timeoutMs = 300_000): Promise<ImagemGerada> {
  const inicio = Date.now();

  while (Date.now() - inicio < timeoutMs) {
    const resp = await fetch(`${BASE_URL}/history/${promptId}`);
    if (!resp.ok) throw new Error(`Falha ao consultar histórico do prompt ${promptId}: HTTP ${resp.status}`);

    const historico = (await resp.json()) as Record<string, EntradaHistorico>;
    const entrada = historico[promptId];

    if (entrada?.status) {
      if (entrada.status.status_str === 'error') {
        throw new Error(`ComfyUI falhou ao gerar o prompt ${promptId}: ${JSON.stringify(entrada.status.messages)}`);
      }
      if (entrada.status.completed) {
        const imagens = Object.values(entrada.outputs ?? {}).flatMap((saida) => saida.images ?? []);
        const imagem = imagens[0];
        if (!imagem) throw new Error(`Prompt ${promptId} concluiu sem nenhuma imagem de saída`);
        return imagem;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error(`Timeout (${timeoutMs}ms) esperando o ComfyUI concluir o prompt ${promptId}`);
}

/** Busca os bytes da imagem gerada via `/view` — o script escreve esses
 * bytes direto no staging (`.portraits-generated/`), sem depender do
 * `output/` do ComfyUI como local final: aquela pasta é só um cache
 * temporário do próprio ComfyUI, fora do repositório e fora do nosso
 * controle de nomenclatura. */
export async function baixarImagem(imagem: ImagemGerada): Promise<Buffer> {
  const params = new URLSearchParams({
    filename: imagem.filename,
    subfolder: imagem.subfolder,
    type: imagem.type,
  });
  const resp = await fetch(`${BASE_URL}/view?${params}`);
  if (!resp.ok) throw new Error(`Falha ao baixar "${imagem.filename}" do ComfyUI: HTTP ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

interface RespostaUpload {
  name: string;
  subfolder: string;
  type: string;
}

/** Envia um arquivo local (ex.: referência de conceito visual) pro `input/`
 * do ComfyUI via `/upload/image`, em vez de assumir o caminho de instalação
 * no disco — mesma ideia de não hardcodar a pasta do ComfyUI uma segunda vez
 * além do `BASE_URL`. Devolve o nome final que o `LoadImage` deve
 * referenciar (o ComfyUI pode renomear em caso de colisão). */
export async function enviarImagemDeReferencia(bytes: Buffer, nomeArquivo: string): Promise<string> {
  const form = new FormData();
  form.append('image', new Blob([new Uint8Array(bytes)]), nomeArquivo);
  form.append('overwrite', 'true');

  const resp = await fetch(`${BASE_URL}/upload/image`, { method: 'POST', body: form });
  if (!resp.ok) throw new Error(`Falha ao enviar "${nomeArquivo}" pro ComfyUI: HTTP ${resp.status}`);

  const dados = (await resp.json()) as RespostaUpload;
  return dados.name;
}
