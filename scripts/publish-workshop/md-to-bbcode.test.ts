import { describe, expect, test } from 'bun:test';
import { markdownParaBBCode } from './md-to-bbcode';

describe('markdownParaBBCode', () => {
  test('parágrafo simples atravessa sem mudança', () => {
    expect(markdownParaBBCode('Um parágrafo qualquer.')).toBe('Um parágrafo qualquer.');
  });

  test('negrito markdown vira [b]', () => {
    expect(markdownParaBBCode('Isso é **importante** aqui.')).toBe(
      'Isso é [b]importante[/b] aqui.'
    );
  });

  test('itálico markdown (* e _) vira [i]', () => {
    expect(markdownParaBBCode('Isso é *sutil*.')).toBe('Isso é [i]sutil[/i].');
    expect(markdownParaBBCode('Isso é _sutil_.')).toBe('Isso é [i]sutil[/i].');
  });

  test('headings viram [h1]/[h2]/[h3], e níveis maiores são grampeados em [h3]', () => {
    expect(markdownParaBBCode('# Título')).toBe('[h1]Título[/h1]');
    expect(markdownParaBBCode('## Subtítulo')).toBe('[h2]Subtítulo[/h2]');
    expect(markdownParaBBCode('### Nível 3')).toBe('[h3]Nível 3[/h3]');
    expect(markdownParaBBCode('#### Nível 4')).toBe('[h3]Nível 4[/h3]');
  });

  test('lista com marcadores vira [list]/[*]', () => {
    const md = '* Primeiro item\n* Segundo item';
    expect(markdownParaBBCode(md)).toBe('[list]\n[*] Primeiro item\n[*] Segundo item\n[/list]');
  });

  test('link vira [url=href]texto[/url]', () => {
    expect(markdownParaBBCode('[GitHub](https://github.com/exemplo)')).toBe(
      '[url=https://github.com/exemplo]GitHub[/url]'
    );
  });

  test('imagem solta vira [img]src[/img]', () => {
    expect(markdownParaBBCode('![banner](https://exemplo.com/banner.png)')).toBe(
      '[img]https://exemplo.com/banner.png[/img]'
    );
  });

  test('link contendo imagem aninhada (banner clicável) vira [url=][img][/img][/url]', () => {
    const md = '[![banner](https://exemplo.com/banner.png)](https://exemplo.com/repo)';
    expect(markdownParaBBCode(md)).toBe(
      '[url=https://exemplo.com/repo][img]https://exemplo.com/banner.png[/img][/url]'
    );
  });

  test('BBCode literal já presente no source markdown atravessa sem mudança', () => {
    const md = '[b]Humans (augmented realism):[/b] O baseline, com upgrades cibernéticos.';
    expect(markdownParaBBCode(md)).toBe(md);
  });

  test('BBCode literal e negrito markdown coexistem na mesma frase (caso real do description.md)', () => {
    const md = "Estamos lançando **18 espécies únicas**:\n\n[b]Humanos:[/b] O baseline padrão.";
    expect(markdownParaBBCode(md)).toBe(
      'Estamos lançando [b]18 espécies únicas[/b]:\n\n[b]Humanos:[/b] O baseline padrão.'
    );
  });

  test('parágrafos separados por linha em branco viram blocos separados por \\n\\n', () => {
    const md = 'Primeiro parágrafo.\n\nSegundo parágrafo.';
    expect(markdownParaBBCode(md)).toBe('Primeiro parágrafo.\n\nSegundo parágrafo.');
  });

  test('documento misto (heading + parágrafo + lista + link) — caso representativo do change-notes.md', () => {
    const md = [
      '## 1.9.0',
      '',
      'Resumo da versão.',
      '',
      '* Primeira mudança.',
      '* Segunda mudança, com [link](https://exemplo.com).',
    ].join('\n');

    expect(markdownParaBBCode(md)).toBe(
      [
        '[h2]1.9.0[/h2]',
        '',
        'Resumo da versão.',
        '',
        '[list]',
        '[*] Primeira mudança.',
        '[*] Segunda mudança, com [url=https://exemplo.com]link[/url].',
        '[/list]',
      ].join('\n')
    );
  });
});
