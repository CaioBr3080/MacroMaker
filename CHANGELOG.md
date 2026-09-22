# Changelog

## Não publicado

- Validação e normalização de projetos extraídas para uma classe reutilizável.
- Registro extensível de tipos de etapa exposto em `game.macroMaker.steps`.
- Executor refatorado para usar o registro no lugar de um `switch` fechado.
- Erros de execução agora identificam o número e o rótulo da etapa responsável.
- Testes para validação, preservação de propriedades desconhecidas e registro de etapas.
- Editor visual linear com cartões para os sete tipos de etapa do schema v1.
- Reordenação por botões e arrastar-e-soltar, duplicação, exclusão e ativação de etapas.
- Modo JSON avançado separado, sincronizado com a edição visual.
- Undo/redo local com snapshots independentes.
- Campos visuais de animação, seletor de arquivos e configuração básica de targeting.
- Corrigida a assinatura de persistência do Sequencer para `persist(true, options)`.
- Testes de integração simulada para animação, som e remoção de persistentes.
- Macros criados por jogadores agora concedem OWNER explicitamente ao autor.
- Criação e duplicação normalizam metadados sem alterar o objeto fornecido.

## 0.1.0

- Fundação do módulo para Foundry VTT 13.
- Projetos salvos em flags de Macro.
- Executor sequencial e adaptador do Sequencer.
- Editor JSON inicial e launcher no diretório de Macros.
- Exemplo Sabre Fúngico, schema e testes básicos.
