# Estrutura e verificação dos scripts

Os pontos de entrada executáveis ficam em cada pasta de pipeline, com Commander para argumentos e ajuda.
Regras específicas permanecem junto do pipeline. `scripts/shared/` contém responsabilidades com consumidores reais:

- `paths.ts`: raízes do repositório, ImageMagick e resolução de `STELLARIS_PATH` do `.env`.
- `species.ts`: descoberta de espécies, leitura validada de `portrait.json` e inventário dos PNGs por gênero.
- `stellaris.ts`: classes, categorias e suas relações, compartilhadas pelos schemas e pela taxonomia.
- `vanilla.ts`: extração de idiomas e leitura validada do snapshot de chaves e idiomas.
- `files.ts`: listagem e remoção de arquivos regulares reconhecidos como saídas dos geradores.

`scripts/utils.ts` reúne numeração e listagem; `converter.ts` converte texturas no destino recebido.
O conversor não define caminhos para os outros pipelines. O enquadramento permanece em `generate-portraits/`.

## Configuração da instalação

Defina `STELLARIS_PATH` no `.env`, conforme `.env.example`. A extração de chaves e a medição de enquadramento
aceitam uma pasta posicional para substituir esse valor em uma execução. Outros pipelines não exigem essa variável.
`bun run extract-vanilla` atualiza `scripts/vanilla-keys.json` com chaves e idiomas reais do jogo instalado.
A extração exige arquivos de localização por idioma e a presença de `braz_por`.

## Comandos de verificação

| Comando | Verificação |
| --- | --- |
| `bun run check` | TypeScript sem emissão |
| `bun test` ou `bun run test` | Testes de lógica e arquivos temporários |
| `bun run check:schemas` | JSON Schemas versionados equivalentes aos schemas Zod e suas descrições |
| `bun run validate` | Schemas, taxonomia, retratos, receitas, referências de arte, promoção, rooms e nomes |
| `bun run validate ssm_astral` | Retratos, receita e promoção dessa espécie; schemas e taxonomia globais |

A validação não escreve arquivos, renderiza páginas, chama ComfyUI ou acessa a GPU. Ela lê imagens e executa
medições com ImageMagick para verificar geometria e referências, sem carregar imagens na conversa.
O modo filtrado não valida culturas ou todos os rooms; verifica os fundos necessários à promoção da espécie.
A conferência dos JSON Schemas apenas reporta divergências e aponta o comando para regenerar cada arquivo.

A validação visual no Stellaris ou da composição promocional é feita pelo Rodrigo. Os testes não substituem
essa conferência visual. Publicação no Workshop continua sendo uma operação separada com confirmação explícita.
