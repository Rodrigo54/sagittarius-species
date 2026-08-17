import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { comTimestamp, extrairPrimeiraSecao, gravarTimestamp } from './change-notes';

const EXEMPLO = `# Change Notes

Texto introdutório qualquer, fora de qualquer seção.

## 1.9.0

* Mudança A.
* Mudança B.

## 1.8.0

* Mudança antiga.
`;

describe('extrairPrimeiraSecao', () => {
  test('extrai a seção mais no topo, ignorando as anteriores', () => {
    const secao = extrairPrimeiraSecao(EXEMPLO);
    expect(secao.versao).toBe('1.9.0');
    expect(secao.linhaHeading).toBe('## 1.9.0');
    expect(secao.jaTemTimestamp).toBe(false);
    expect(secao.corpo).toBe('* Mudança A.\n* Mudança B.');
  });

  test('reconhece um heading que já tem timestamp gravado', () => {
    const comData = EXEMPLO.replace('## 1.9.0', '## 1.9.0 — 2026-08-10 15:30');
    const secao = extrairPrimeiraSecao(comData);
    expect(secao.versao).toBe('1.9.0');
    expect(secao.jaTemTimestamp).toBe(true);
    expect(secao.linhaHeading).toBe('## 1.9.0 — 2026-08-10 15:30');
  });

  test('lança erro claro se não houver nenhuma seção "##"', () => {
    expect(() => extrairPrimeiraSecao('# Change Notes\n\nSó um parágrafo, sem seções.')).toThrow(
      /nenhuma seção/
    );
  });

  test('lança erro claro se a seção do topo estiver vazia', () => {
    const vazia = '# Change Notes\n\n## 1.9.0\n\n## 1.8.0\n\n* Mudança antiga.\n';
    expect(() => extrairPrimeiraSecao(vazia)).toThrow(/vazia/);
  });
});

describe('comTimestamp', () => {
  test('anexa "— YYYY-MM-DD HH:mm" quando a seção ainda não tem timestamp', () => {
    const secao = extrairPrimeiraSecao(EXEMPLO);
    const agora = new Date(2026, 7, 10, 15, 30); // mês é 0-indexed: 7 = agosto
    expect(comTimestamp(secao, agora)).toBe('## 1.9.0 — 2026-08-10 15:30');
  });

  test('não mexe na linha se a seção já tem timestamp', () => {
    const comData = EXEMPLO.replace('## 1.9.0', '## 1.9.0 — 2026-01-01 00:00');
    const secao = extrairPrimeiraSecao(comData);
    expect(comTimestamp(secao, new Date(2026, 7, 10, 15, 30))).toBe(
      '## 1.9.0 — 2026-01-01 00:00'
    );
  });
});

describe('gravarTimestamp', () => {
  let pastaTemp: string;

  afterEach(async () => {
    if (pastaTemp) await rm(pastaTemp, { recursive: true, force: true });
  });

  test('reescreve só a linha de heading, preservando o resto do arquivo', async () => {
    pastaTemp = await mkdtemp(join(tmpdir(), 'change-notes-test-'));
    const caminho = join(pastaTemp, 'change-notes.md');

    const secao = extrairPrimeiraSecao(EXEMPLO);
    const novaLinha = comTimestamp(secao, new Date(2026, 7, 10, 15, 30));
    await gravarTimestamp(caminho, EXEMPLO, secao, novaLinha);

    const gravado = await readFile(caminho, 'utf-8');
    expect(gravado).toContain('## 1.9.0 — 2026-08-10 15:30');
    expect(gravado).toContain('## 1.8.0'); // seção antiga intacta
    expect(gravado).toContain('Texto introdutório qualquer'); // intro intacta
  });

  test('não grava nada (nem cria o arquivo) se a seção já tinha timestamp', async () => {
    pastaTemp = await mkdtemp(join(tmpdir(), 'change-notes-test-'));
    const caminho = join(pastaTemp, 'change-notes.md');

    const comData = EXEMPLO.replace('## 1.9.0', '## 1.9.0 — 2026-01-01 00:00');
    const secao = extrairPrimeiraSecao(comData);
    const novaLinha = comTimestamp(secao, new Date(2026, 7, 10, 15, 30));
    await gravarTimestamp(caminho, comData, secao, novaLinha);

    await expect(readFile(caminho, 'utf-8')).rejects.toThrow();
  });
});
