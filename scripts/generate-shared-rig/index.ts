import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  corrigirShaderDoMesh,
  corrigirUvDoMesh,
  recortarPlanoAcima,
  removerPlanosOcultos,
} from './mesh-uv';
import { ANIMATIONS_ASSET, ENTITIES_ASSET, MESHES_GFX } from './templates';

const PASTA_MOD_PORTRAITS = join(import.meta.dir, '../../mod/sagittarius-species/gfx/models/portraits');
const PASTA_SL_SHARED = join(PASTA_MOD_PORTRAITS, 'sl_shared');
const PASTA_SSM_SHARED = join(PASTA_MOD_PORTRAITS, 'ssm_shared');

const NOME_MESH = 'humanoid_01_portrait.mesh';
const ARQUIVOS_ANIM = [
  'humanoid_01_portrait_happy.anim',
  'humanoid_01_portrait_happy_2.anim',
  'humanoid_01_portrait_sad.anim',
  'humanoid_01_portrait_sad_2.anim',
];

/**
 * Deriva `ssm_shared/` a partir de `sl_shared/`: mesmo mesh e mesmas
 * animações do rig original do Stellar Legion Mod, com três correções no
 * mesh (`sl_shared/` nunca é modificado, as 15+ espécies publicadas
 * continuam usando ele exatamente como está):
 *
 * 1. `removerPlanosOcultos` — só o `pPlaneShape4` (camada de corpo, quase
 *    plana e estável na animação — ver `PLANO_MANTIDO` em `mesh-uv.ts`)
 *    permanece no mesh; os outros 5 subtrees são removidos do binário.
 *    Sem isso, a UV unificada faz as 6 camadas de profundidade do rig
 *    exibirem o retrato inteiro ao mesmo tempo, criando um "fantasma"/gêmeo
 *    atrás do personagem — ver `ssm-shared-historico-da-sessao.md` pro
 *    relato completo (o que foi tentado antes, por que falhou, e por que a
 *    remoção estrutural venceu a degeneração de triângulos: o importador do
 *    Blender crasha com faces degeneradas, e validação visual no Blender é
 *    pré-requisito da investigação da distorção de animação).
 * 2. `corrigirShaderDoMesh` — guarda que assegura o shader de corpo
 *    (`PdxMeshPortrait`) no plano mantido; no-op pro `pPlaneShape4` (que já
 *    é camada de corpo), essencial se o plano mantido voltar a ser uma
 *    camada de cabelo/roupa (shaders que não renderizam arte comum —
 *    in-game aparece um quadro vazio).
 * 3. `corrigirUvDoMesh` — a UV do plano restante passa a usar o canvas
 *    inteiro em vez de metade (ver `future-plans.md` e `portraits.md`).
 * 4. `recortarPlanoAcima` — remove as linhas de vértices do topo do plano que
 *    a câmera de retrato nunca captura. Medição in-game (ver
 *    `scripts/measure-framing/ancora.json`) situa o topo do sprite em
 *    `y_canvas ≈ 199`, então a faixa acima disso consome pixels de textura sem
 *    nunca chegar à tela. Cortando a geometria, o mesmo canvas passa a cobrir
 *    só o que aparece — +25% de densidade vertical, sem mudar o enquadramento.
 *
 * Regenerável a qualquer momento a partir da fonte (`sl_shared/` + as
 * transformações), não é uma migração de disparo único.
 */
async function main() {
  const caminhoMeshOrigem = join(PASTA_SL_SHARED, NOME_MESH);
  if (!existsSync(caminhoMeshOrigem)) {
    console.error(`Não encontrado: ${caminhoMeshOrigem}`);
    process.exit(1);
  }
  for (const anim of ARQUIVOS_ANIM) {
    const caminho = join(PASTA_SL_SHARED, anim);
    if (!existsSync(caminho)) {
      console.error(`Não encontrado: ${caminho}`);
      process.exit(1);
    }
  }

  const meshOriginal = await readFile(caminhoMeshOrigem);
  const meshCorrigido = recortarPlanoAcima(
    corrigirUvDoMesh(corrigirShaderDoMesh(removerPlanosOcultos(meshOriginal)))
  );

  await mkdir(PASTA_SSM_SHARED, { recursive: true });

  await writeFile(join(PASTA_SSM_SHARED, NOME_MESH), meshCorrigido);
  for (const anim of ARQUIVOS_ANIM) {
    await copyFile(join(PASTA_SL_SHARED, anim), join(PASTA_SSM_SHARED, anim));
  }
  await writeFile(join(PASTA_SSM_SHARED, '_humanoid_portrait_entities.asset'), ENTITIES_ASSET);
  await writeFile(join(PASTA_SSM_SHARED, '_humanoid_portrait_meshes.gfx'), MESHES_GFX);
  await writeFile(join(PASTA_SSM_SHARED, '_humanoid_portrait_animations.asset'), ANIMATIONS_ASSET);

  console.log(`Gerado: ${PASTA_SSM_SHARED}`);
}

main();
