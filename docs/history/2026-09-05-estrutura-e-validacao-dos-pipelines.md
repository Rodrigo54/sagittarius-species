# Estrutura e validação dos pipelines — 2026-09-05

A revisão dos scripts apontou dependências entre pipelines para responsabilidades compartilhadas, descoberta de
idiomas a partir das pastas de saída, identificação de tokens pelo texto e limpeza incompleta de conteúdo excluído.
Rodrigo aprovou a implementação após uma entrevista de escopo.

## Decisões

- Extraímos caminhos, catálogo e vocabulário para `scripts/shared/`, mantendo os pontos de entrada e regras por pipeline.
- Rodrigo pediu idiomas extraídos da instalação do Stellaris, persistidos no próprio `vanilla-keys.json`.
  A instalação foi configurada em `.env` por `STELLARIS_PATH`; o gerador de nomes não precisa acessar o jogo.
- Tokens de localização passaram a usar o caminho da propriedade, com escaping dos valores e composição em memória.
- O modo metadata-only foi definido como título, descrição e thumbnail, sem conteúdo, changenote ou cópia local.
- A proposta inicial de recuperação automática foi descartada: o mod é versionado e o Git cobre a recuperação.
  Rodrigo propôs staging semelhante ao de art. A solução aprovada substitui `.portraits-framed` por
  `.portrait-staging`, prepara PNGs/DDS/scripts e promove automaticamente após conferir o lote. Não há rollback
  automático da cópia final. Falhas de preparação preservam o mod.
- A limpeza global de retratos foi limitada à execução sem espécie. Execuções filtradas mantêm somente a limpeza
  local dos gêneros declarados. Nomes remove saídas de culturas excluídas após gerar o conjunto com sucesso.
- Adicionamos verificação de tipos, testes, consistência dos JSON Schemas e validação das fontes sem geração ou GPU.

As pastas de saída não são removidas recursivamente durante a limpeza global: só arquivos nos padrões dos geradores
são apagados, preservando rigs e arquivos manuais. A documentação atual dos contratos fica em
`docs/estrutura-scripts.md` e nos documentos específicos de cada pipeline.
