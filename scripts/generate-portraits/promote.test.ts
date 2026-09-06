import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, relative, isAbsolute } from 'node:path';
import { promoverLote } from './promote';
import type { SpeciesInfo } from '../shared/species';
const pastas: string[] = [];
afterEach(async () => { for (const pasta of pastas.splice(0)) {
  const rel = relative(tmpdir(), pasta);
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Pasta temporária fora do destino esperado');
  await rm(pasta, { recursive: true, force: true });
} });
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'portrait-promote-')); pastas.push(root);
  const modelos = join(root, 'mod/models'); const txt = join(root, 'mod/txt');
  async function put(path: string, text = 'original') { await mkdir(dirname(path), {recursive:true}); await writeFile(path,text); return path; }
  const ativo = await put(join(modelos,'ssm_teste/genderless/001.dds'));
  const excedente = await put(join(modelos,'ssm_teste/genderless/002.dds'));
  const genero = await put(join(modelos,'ssm_teste/female/001.dds'));
  const excluido = await put(join(modelos,'ssm_excluido/male/001.dds'));
  const antigoTxt = await put(join(txt,'ssm_excluido_portrait.txt'));
  const rig = await put(join(modelos,'ssm_shared/rig.mesh'));
  const manual = await put(join(modelos,'ssm_excluido/male/manual.dds'));
  const info: SpeciesInfo = { slug:'ssm_teste', pastaAssets:join(root,'assets'),
    config:{ name:'teste', rig:'ssm_shared', counts:{genderless:1}, species_classes:['HUM'],categories:['humanoids'] },
    arquivos:{genderless:['001.png']} };
  const origem = await put(join(root,'staging/ssm_teste_portrait.txt'), 'novo');
  const saidas = [{origem,destino:join(txt,'ssm_teste_portrait.txt')}];
  return {root,modelos,txt,ativo,excedente,genero,excluido,antigoTxt,rig,manual,info,saidas};
}
test('lote filtrado promove só suas saídas e preserva a limpeza global', async () => {
  const f=await fixture();
  await promoverLote(f.saidas,[f.info],f.modelos,f.txt,'ssm_teste');
  expect(await readFile(f.saidas[0].destino,'utf8')).toBe('novo');
  expect(await Bun.file(f.excedente).exists()).toBe(false);
  for(const path of [f.genero,f.excluido,f.antigoTxt,f.rig,f.manual,f.ativo]) expect(await Bun.file(path).exists()).toBe(true);
});
test('lote completo remove espécies e gêneros excluídos, preservando arquivos manuais e rig', async () => {
  const f=await fixture(); await promoverLote(f.saidas,[f.info],f.modelos,f.txt);
  for(const path of [f.excedente,f.genero,f.excluido,f.antigoTxt]) expect(await Bun.file(path).exists()).toBe(false);
  for(const path of [f.ativo,f.rig,f.manual]) expect(await Bun.file(path).exists()).toBe(true);
});
test('saída ausente impede qualquer promoção ou limpeza', async () => {
  const f=await fixture();
  await expect(promoverLote([...f.saidas,{origem:join(f.root,'ausente.dds'),destino:f.ativo}],[f.info],f.modelos,f.txt)).rejects.toThrow();
  expect(await Bun.file(f.saidas[0].destino).exists()).toBe(false);
  expect(await readFile(f.ativo,'utf8')).toBe('original');
  expect(await Bun.file(f.excedente).exists()).toBe(true);
});
test('DDS inválido impede promoção', async () => {
  const f=await fixture();
  await expect(promoverLote([{origem:f.ativo,destino:join(f.root,'saida.dds')}],[f.info],f.modelos,f.txt)).rejects.toThrow('DDS inválido');
});
test('lote com outra espécie é rejeitado antes da cópia', async () => {
  const f=await fixture();
  await expect(promoverLote(f.saidas,[f.info],f.modelos,f.txt,'ssm_outra')).rejects.toThrow('fora do filtro');
  expect(await Bun.file(f.saidas[0].destino).exists()).toBe(false);
});
test('lote filtrado com arquivo de outra espécie é rejeitado mesmo com "especies" correto', async () => {
  const f=await fixture();
  const saidaAlheia = {origem:f.saidas[0].origem, destino:join(f.txt,'ssm_outra_portrait.txt')};
  await expect(promoverLote([...f.saidas,saidaAlheia],[f.info],f.modelos,f.txt,'ssm_teste')).rejects.toThrow('fora do filtro');
  expect(await Bun.file(f.saidas[0].destino).exists()).toBe(false);
  expect(await Bun.file(saidaAlheia.destino).exists()).toBe(false);
});
test('lote filtrado promove arquivo fora de pastaModelos/pastaTxt (registro global de taxonomia)', async () => {
  const f=await fixture();
  const registro = join(f.root,'mod/common/portrait_sets/ssm_portrait_sets.txt');
  await mkdir(dirname(registro), {recursive:true});
  await writeFile(join(f.root,'staging/ssm_portrait_sets.txt'),'registro');
  const saidaGlobal = {origem:join(f.root,'staging/ssm_portrait_sets.txt'), destino:registro};
  await promoverLote([...f.saidas,saidaGlobal],[f.info],f.modelos,f.txt,'ssm_teste');
  expect(await readFile(registro,'utf8')).toBe('registro');
});
