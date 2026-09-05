import { expect, test } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute } from 'node:path';
import { limparNamesOrfaos } from './sync';
test('remove só saídas de culturas excluídas em todos os idiomas existentes',async()=>{
  const root=await mkdtemp(join(tmpdir(),'names-sync-'));
  try {
    const txt=join(root,'txt'); const l10n=join(root,'localisation');
    await mkdir(txt,{recursive:true});
    for(const nome of ['ssm_atual.txt','ssm_excluida.txt','manual.txt']) await writeFile(join(txt,nome),'conteúdo');
    for(const idioma of ['braz_por','english']) {
      const pasta=join(l10n,idioma,'name_lists');await mkdir(pasta,{recursive:true});
      for(const cultura of ['ssm_atual','ssm_excluida','manual']) await writeFile(join(pasta,cultura+'_l_'+idioma+'.yml'),'conteúdo');
    }
    await limparNamesOrfaos(txt,l10n,['ssm_atual']);
    expect(await Bun.file(join(txt,'ssm_excluida.txt')).exists()).toBe(false);
    expect(await Bun.file(join(txt,'ssm_atual.txt')).exists()).toBe(true);
    expect(await Bun.file(join(txt,'manual.txt')).exists()).toBe(true);
    for(const idioma of ['braz_por','english']) {
      expect(await Bun.file(join(l10n,idioma,'name_lists','ssm_excluida_l_'+idioma+'.yml')).exists()).toBe(false);
      expect(await Bun.file(join(l10n,idioma,'name_lists','manual_l_'+idioma+'.yml')).exists()).toBe(true);
    }
  } finally {
    const rel=relative(tmpdir(),root);if(rel.startsWith('..')||isAbsolute(rel))throw new Error('Destino temporário inválido');
    await rm(root,{recursive:true,force:true});
  }
});
