import { expect, test } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, isAbsolute } from 'node:path';
import { extrairIdiomas, loadVanillaKeys } from './vanilla';
test('extrai só idiomas com localização e exige braz_por no snapshot', async()=>{
  const root=await mkdtemp(join(tmpdir(),'vanilla-test-'));
  try {
    for(const loc of ['braz_por','english','pasta_vazia']) await mkdir(join(root,'localisation',loc),{recursive:true});
    await writeFile(join(root,'localisation/braz_por/test_l_braz_por.yml'),'l_braz_por:');
    await writeFile(join(root,'localisation/english/test_l_english.yml'),'l_english:');
    expect(await extrairIdiomas(root)).toEqual(['braz_por','english']);
    const arquivo=join(root,'snapshot.json');
    const dados={army:['a'],shipSize:['s'],planetClass:['p'],languages:['english']};
    await writeFile(arquivo,JSON.stringify(dados));
    await expect(loadVanillaKeys(arquivo)).rejects.toThrow('braz_por');
    await writeFile(arquivo,JSON.stringify({...dados,languages:['braz_por','../fora']}));
    await expect(loadVanillaKeys(arquivo)).rejects.toThrow('snapshot inválido');
    await writeFile(arquivo,JSON.stringify({...dados,languages:['braz_por','english']}));
    expect((await loadVanillaKeys(arquivo)).languages).toEqual(['braz_por','english']);
  } finally {
    const rel=relative(tmpdir(),root);if(rel.startsWith('..')||isAbsolute(rel))throw new Error('Destino temporário inválido');
    await rm(root,{recursive:true,force:true});
  }
});
