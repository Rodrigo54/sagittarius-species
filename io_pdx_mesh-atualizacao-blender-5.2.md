# io_pdx_mesh — atualização para Blender 5.2 / Python 3.13

Documento de trabalho para embasar uma futura **PR ao projeto upstream**
[`ross-g/io_pdx_mesh`](https://github.com/ross-g/io_pdx_mesh). Reúne as
incompatibilidades encontradas ao rodar o addon no Blender 5.2 e as correções que
aplicamos localmente. **Não faz parte do mod Sagittarius Species** — é sobre o addon de
import/export de `.mesh`, ferramenta externa usada no pipeline (edição de UV do
`ssm_shared`, screenshots/renders de viewport).

> Referência histórica interna: `ssm-shared-historico-da-sessao.md`, seção 8.

## Objetivo

O addon (import/export de assets `.mesh`/`.anim`/`.gfx` da engine Clausewitz) não carregava
nem operava no Blender 5.2. A versão publicada mais nova, **0.91.0** (release de 2024-09-23,
que anuncia "Blender 4.2 support"), foi construída para o Blender 4.2 (Python **3.11**) e não
acompanhou a remoção de APIs do Python 3.12+ nem do EEVEE Next. O alvo aqui é o **Blender
5.2 / Python 3.13**.

## Ambiente

| Item | Valor |
|------|-------|
| Blender | 5.2.0, instalado via **Microsoft Store (MSIX)** |
| Python do Blender | 3.13 |
| Versão do addon | **0.91.0** (formato "extensão", `blender_manifest.toml`, `blender_version_min = 4.2.0`) |
| Caminho da instalação (MSIX, virtualizado) | `%LOCALAPPDATA%\Packages\BlenderFoundation.Blender_ppwjx1n5r4v9t\LocalCache\Roaming\Blender Foundation\Blender\5.2\extensions\user_default\io_pdx_mesh\` |
| Config do addon | `%LOCALAPPDATA%\...\LocalCache\Local\io_pdx_mesh\settings.json` |

> Nota sobre a instalação MSIX: a pasta de config **não** fica no `%APPDATA%` literal — é
> redirecionada para dentro de `Packages\...\LocalCache\`. Isso vale para qualquer edição
> manual de addon/extensão no Blender da Store.

Os números de linha abaixo referem-se ao código da **v0.91.0**. Numa PR contra o `main` do
upstream eles podem diferir; o que importa é o trecho.

---

## Correção 1 — `imp` removido no Python 3.12+ (impede o addon de carregar)

**Sintoma:** a extensão nem carrega no Blender 5.2 — `ModuleNotFoundError: No module named
'imp'` no import de topo. O módulo `imp` foi **removido** no Python 3.12 (deprecado desde
3.4); o Blender 5.2 usa Python 3.13.

**Arquivos:** `io_pdx_mesh/__init__.py` e `io_pdx_mesh/maya_ui.py`.

```diff
- from imp import reload
+ from importlib import reload
```

`importlib.reload` é o substituto direto e existe desde o Python 3.4, então a troca é segura
para todas as versões suportadas.

- `__init__.py` é carregado pelo Blender → **crítico**, sem isso o addon não sobe.
- `maya_ui.py` é o lado Maya; o Blender nunca o importa, mas o upstream deve corrigir o
  mesmo `import` lá também por consistência (Maya moderna também roda Python 3.11+).

Aplicamos localmente em `__init__.py`. O `maya_ui.py` ficou como está no nosso setup (não
usamos Maya), mas **entra na PR**.

---

## Correção 2 — `Material.shadow_method` / `Material.blend_method` removidos no EEVEE Next (Blender 4.2+)

**Sintoma:** ao criar material durante o import, `AttributeError` em
`new_shader.shadow_method = "CLIP"`. Os atributos `Material.shadow_method` e
`Material.blend_method` foram **removidos** com o EEVEE Next no Blender 4.2 (transparência/
sombra passaram a ser tratadas por outros mecanismos).

**Arquivo:** `io_pdx_mesh/pdx_blender/blender_import_export.py`, função `create_shader`.

```diff
  new_shader.use_backface_culling = True
- new_shader.shadow_method = "CLIP"
- new_shader.blend_method = "CLIP"
+ # shadow_method/blend_method removidos no Blender 4.2+ (EEVEE Next)
+ if hasattr(new_shader, "shadow_method"):
+     new_shader.shadow_method = "CLIP"
+ if hasattr(new_shader, "blend_method"):
+     new_shader.blend_method = "CLIP"
```

Guardamos **os dois** com `hasattr`. (O patch original interno do nosso setup, na v0.9,
guardava só o `shadow_method` e deixava o `blend_method` cru — só não quebrava porque a
Correção 4 desviava todo o caminho de material.)

**Para a PR:** `hasattr` funciona e é o mínimo. Uma alternativa mais idiomática ao estilo do
projeto é um guard por versão (`if bpy.app.version < (4, 2, 0):`), já que o resto do código
usa checagens desse tipo. Decidir conforme a convenção que os mantenedores preferirem.

---

## Correção 3 — `use_auto_smooth` removido no Blender 4.1+ (já resolvido na v0.91)

**Status: já corrigido no upstream v0.91**, registrado aqui só para completude do mapa.

`Mesh.use_auto_smooth` foi removido no Blender 4.1 (substituído pelo modificador Smooth by
Angle / `normals_split_custom_set_from_vertices`). Na v0.91 o trecho já vem guardado por
`try/except AttributeError`:

```python
new_mesh.normals_split_custom_set_from_vertices(normals)
try:  # Blender < 4.1
    new_mesh.use_auto_smooth = True
    new_mesh.polygons.foreach_set("use_smooth", [True] * len(new_mesh.polygons))
except AttributeError:
    pass
```

`normals_split_custom_set_from_vertices` continua existindo no Blender 5.2, então não precisa
de guard. Nada a fazer aqui.

---

## Correção 4 — sistema de shader/material (`ShaderNodeSeparateRGB` etc.) — **trabalho pendente**

**Não corrigido de fato** — apenas contornado em runtime no nosso uso, e o contorno **não
serve para uma PR**. Fica documentado como o principal item que ainda falta.

**Sintoma:** `create_shader`/`create_material` montam a árvore de nós com tipos de shader
node que mudaram nas versões recentes do Blender — notadamente `ShaderNodeSeparateRGB`, que
foi **renomeado para `ShaderNodeSeparateColor` no Blender 3.3** (e o antigo removido depois),
além de renomes de sockets do Principled BSDF no Blender 4.0
(<https://developer.blender.org/docs/release_notes/4.0/python_api/>).

**Nosso contorno (runtime, fora de arquivo):** monkeypatch de `create_material` para no-op e
aplicação de um material próprio (xadrez / preenchimento translúcido) direto via `bpy`, sem
passar pelo sistema de material do addon. Isso destrava import de mesh, viewport e render,
mas **abandona** a reconstrução real do material PDX.

**Para a PR (correção de verdade):**
- Trocar `ShaderNodeSeparateRGB` → `ShaderNodeSeparateColor` (com guard/fallback por versão
  se ainda quiser suportar Blender < 3.3).
- Revisar nomes de sockets do Principled BSDF alterados no Blender 4.0 (o docstring da
  `create_shader` na v0.91 já cita esse link, mas a implementação não cobre tudo).
- Testar o caminho de material ponta a ponta (o resto das correções acima só cobre carregar
  o addon e importar geometria; material é um bloco à parte).

---

## Resumo das mudanças de arquivo (para a PR)

| # | Arquivo | Mudança | Escopo |
|---|---------|---------|--------|
| 1 | `__init__.py` | `from imp import reload` → `from importlib import reload` | Py 3.12+ |
| 1 | `maya_ui.py` | idem | Py 3.12+ (Maya) |
| 2 | `pdx_blender/blender_import_export.py` (`create_shader`) | guard `hasattr`/versão em `shadow_method` e `blend_method` | Blender 4.2+ |
| 3 | `pdx_blender/blender_import_export.py` | `use_auto_smooth` já guardado por `try/except` | — (já ok) |
| 4 | `pdx_blender/blender_import_export.py` (nós de shader) | `ShaderNodeSeparateRGB` → `ShaderNodeSeparateColor` + sockets do Principled 4.0 | **pendente** |

Com as correções 1 e 2 o addon **carrega e importa geometria** no Blender 5.2. A 3 já vinha
pronta. A 4 é o que resta para a reconstrução de material funcionar sem contorno.

## Sugestões de forma para a PR

- **`blender_version_min`** no `blender_manifest.toml`: o valor atual é `4.2.0`. Com as
  correções, cobrir a faixa que se pretende dar suporte — e testar de fato em 4.2, 4.4/4.5 e
  5.x, já que as APIs quebradas mudaram em pontos diferentes (3.3, 4.0, 4.1, 4.2).
- **Estilo de guard:** o projeto tende a checar `bpy.app.version`; considerar padronizar
  nesse estilo em vez de `hasattr`/`try-except`, para consistência.
- **Issues relacionadas** citadas nas release notes da 0.91: #86 (shader nodes / Blender 4.0),
  #92 (custom normals / Blender 4.1). A PR nova é a continuação natural dessas para
  Blender 4.2+ / Python 3.13.

## Estado local após esta sessão (contexto, não vai para a PR)

- Havia **instalação dupla** no Blender 5.2: addon legado v0.9 em `scripts/addons/`
  (patchado à mão) + extensão v0.91.0 em `extensions/user_default/` (fresca). Migramos para a
  **extensão v0.91.0 patchada** (Correções 1 e 2 aplicadas) e removemos o legado v0.9 e um
  resíduo do Blender 4.1. Backups `.zip` guardados no scratchpad da sessão.
- Instalação válida hoje: **só** `5.2\extensions\user_default\io_pdx_mesh` (v0.91.0).
- Um fork limpo do repositório upstream é o ponto de partida correto para a PR — **não**
  usar a cópia MSIX patchada como base de diff (ela tem só um subconjunto das correções e
  caminhos virtualizados).
