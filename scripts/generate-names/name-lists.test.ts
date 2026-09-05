import { beforeAll, expect, test } from 'bun:test';
import { Jomini } from 'jomini';
import { gerarNameList, type ParsedNameList } from './name-lists';
let parser: Jomini;
beforeAll(async()=>{parser=await Jomini.initialize();});
function item(body: ParsedNameList['body']): ParsedNameList {
  return {name:'Cultura',desc:'Descrição',fileName:'ssm_teste',body,data:{ssm_teste:body},speciesNames:[]};
}
test('textos iguais preservam tokens por caminho, inclusive em arrays',()=>{
  const saida=gerarNameList(parser,item({ fleet_names:{sequential_name:'l10n|Frota %O%'},army_names:{generic:{sequential_name:'l10n|Frota %O%'}},ship_names:{generic:['l10n|Frota %O%']} }),['braz_por']);
  for(const token of ['SSM_TESTE_FLEET_NAMES_SEQUENTIAL_NAME','SSM_TESTE_ARMY_NAMES_GENERIC_SEQUENTIAL_NAME','SSM_TESTE_SHIP_NAMES_GENERIC_0']) {
    expect(saida.txt).toContain(token); expect(saida.localizations.braz_por).toContain(token+':');
  }
});
test('localização escapa aspas, barras e quebras de linha e preserva BOM',()=>{
  const texto='Frota "A"\\B\nSegunda linha';
  const saida=gerarNameList(parser,item({fleet_names:{sequential_name:'l10n|'+texto}}),['braz_por','english']);
  expect(saida.localizations.braz_por.startsWith('\uFEFFl_braz_por:')).toBe(true);
  expect(saida.localizations.english).toContain(JSON.stringify(texto));
  expect(saida.txt).toContain('SSM_TESTE_FLEET_NAMES_SEQUENTIAL_NAME');
});
test('colisões de caminhos normalizados são rejeitadas',()=>{
  expect(()=>gerarNameList(parser,item({a_b:'l10n|um',a:{b:'l10n|dois'}}),['braz_por'])).toThrow('colisão');
});
