import { describe, expect, test } from 'bun:test';
import { montarVdf } from './vdf';

describe('montarVdf', () => {
  test('modo conteudo inclui changenote e não inclui title/description', () => {
    const vdf = montarVdf({
      modo: 'conteudo',
      appid: '281990',
      publishedFileId: '3054793206',
      contentFolder: 'D:\\dev\\mod',
      previewFile: 'D:\\dev\\mod\\thumbnail.png',
      changenote: '* Mudança 1\n* Mudança 2',
    });

    expect(vdf).toContain('"appid"\t\t"281990"');
    expect(vdf).toContain('"publishedfileid"\t\t"3054793206"');
    expect(vdf).toContain('"changenote"\t\t"* Mudança 1\n* Mudança 2"');
    expect(vdf).not.toContain('"title"');
    expect(vdf).not.toContain('"description"');
    // Barra invertida do caminho Windows precisa vir duplicada no VDF
    expect(vdf).toContain('"contentfolder"\t\t"D:\\\\dev\\\\mod"');
  });

  test('modo metadata inclui title/description e não inclui changenote', () => {
    const vdf = montarVdf({
      modo: 'metadata',
      appid: '281990',
      publishedFileId: '3054793206',
      contentFolder: 'D:\\dev\\mod',
      previewFile: 'D:\\dev\\mod\\thumbnail.png',
      title: 'Sagittarius Species',
      description: 'Uma descrição [b]qualquer[/b].',
    });

    expect(vdf).toContain('"title"\t\t"Sagittarius Species"');
    expect(vdf).toContain('"description"\t\t"Uma descrição [b]qualquer[/b]."');
    expect(vdf).not.toContain('"changenote"');
  });

  test('escapa aspas duplas dentro do valor', () => {
    const vdf = montarVdf({
      modo: 'conteudo',
      appid: '281990',
      publishedFileId: '1',
      contentFolder: 'C:\\mod',
      previewFile: 'C:\\mod\\thumb.png',
      changenote: 'Texto com "aspas" no meio.',
    });

    expect(vdf).toContain('"changenote"\t\t"Texto com \\"aspas\\" no meio."');
  });

  test('produz um bloco "workshopitem" bem-formado', () => {
    const vdf = montarVdf({
      modo: 'conteudo',
      appid: '281990',
      publishedFileId: '1',
      contentFolder: 'C:\\mod',
      previewFile: 'C:\\mod\\thumb.png',
      changenote: 'x',
    });

    expect(vdf.startsWith('"workshopitem"\n{\n')).toBe(true);
    expect(vdf.trimEnd().endsWith('}')).toBe(true);
  });
});
