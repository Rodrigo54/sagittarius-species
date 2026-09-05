import { describe, expect, test } from 'bun:test';
import { montarVdf } from './vdf';

const BASE = {
  modo: 'conteudo' as const,
  changenote: '',
  appid: '281990',
  publishedFileId: '3054793206',
  contentFolder: 'D:\\dev\\mod',
  previewFile: 'D:\\dev\\mod\\thumbnail.png',
  title: 'Sagittarius Species',
  description: 'Uma descrição [b]qualquer[/b].',
};

describe('montarVdf', () => {
  test('title/description sempre presentes, mesmo sem changenote', () => {
    const vdf = montarVdf(BASE);

    expect(vdf).toContain('"appid"\t\t"281990"');
    expect(vdf).toContain('"publishedfileid"\t\t"3054793206"');
    expect(vdf).toContain('"title"\t\t"Sagittarius Species"');
    expect(vdf).toContain('"description"\t\t"Uma descrição [b]qualquer[/b]."');
    expect(vdf).toContain('"changenote"');
    // Caminho Windows vai literal: o parser do steamcmd não processa escapes
    expect(vdf).toContain('"contentfolder"\t\t"D:\\dev\\mod"');
  });

  test('changenote entra quando fornecido, junto com title/description', () => {
    const vdf = montarVdf({ ...BASE, changenote: '* Mudança 1\n* Mudança 2' });

    expect(vdf).toContain('"title"\t\t"Sagittarius Species"');
    expect(vdf).toContain('"description"\t\t"Uma descrição [b]qualquer[/b]."');
    expect(vdf).toContain('"changenote"\t\t"* Mudança 1\n* Mudança 2"');
  });

  test('troca as aspas duplas do valor por aspas tipográficas', () => {
    const vdf = montarVdf({ ...BASE, changenote: 'Texto com "aspas" no meio.' });
    expect(vdf).toContain('"changenote"\t\t"Texto com “aspas” no meio."');
  });

  test('produz um bloco "workshopitem" bem-formado', () => {
    const vdf = montarVdf(BASE);
    expect(vdf.startsWith('"workshopitem"\n{\n')).toBe(true);
    expect(vdf.trimEnd().endsWith('}')).toBe(true);
  });
});

test('metadata envia thumbnail sem conteúdo ou changenote', () => {
  const vdf = montarVdf({ modo: 'metadata', appid: BASE.appid, publishedFileId: BASE.publishedFileId,
    previewFile: BASE.previewFile, title: BASE.title, description: BASE.description });
  expect(vdf).toContain('"previewfile"');
  expect(vdf).toContain('"title"');
  expect(vdf).toContain('"description"');
  expect(vdf).not.toContain('"contentfolder"');
  expect(vdf).not.toContain('"changenote"');
});
