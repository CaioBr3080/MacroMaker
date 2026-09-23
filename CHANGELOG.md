# Changelog

## 0.9.3 - 2026-09-23

- Mensagens formatadas preservam espaços repetidos, espaços nas bordas e quebras de linha.
- O nome do usuário pode receber um complemento livre e estilo próprio sem substituir o alias original; frases completas como `Aldine destrói com sua lâmina` são aceitas.
- O complemento do nome e sua formatação são enviados como dados do Macro Maker para continuar funcionando após salvar e reabrir a mensagem.

## 0.9.2 - 2026-09-23

- Campos de geometria e alcance ficam cinza quando não se aplicam ao método escolhido, preservando seus valores.
- Seletor de imagem do Macro com miniaturas e pastas de Macros organizadas pelo caminho completo.
- Atribuição Todos aplica o nível de acesso aos usuários atuais e futuros; escolher Raiz remove a pasta atual.
- Ajuda (?) nos campos, incluindo exemplos de velocidade, fórmulas, unidades e persistência.
- Seção de variáveis com nome, tipo e valor; fórmulas aceitam FOR ou @FOR para uma variável numérica FOR.
- Formatação da mensagem com fonte, tamanho, cor RGB, negrito, itálico, sublinhado, alinhamento e prévia.
- Componentes de dano/cura da mesma etapa são agrupados em uma única rolagem e mensagem, preservando tipos, críticos e resistências individuais, sem rerrolar dados.
- Etapas podem ser minimizadas, movidas pelo número e localizadas pela sequência compacta na lateral.
- Seletor RGB para cores de animação e mensagem, com edição hexadecimal opcional.
- Testes de regressão para os controles do editor, rolagens agrupadas, variáveis e atribuições.

## 0.9.1 - 2026-09-22

- Corrigido o ID da aba para ocupar o placeholder da sidebar do Foundry, evitando conteúdo solto no canvas e deslocamento das outras abas.
- Estilos da navegação interna do editor separados da classe adicionada automaticamente pelo Foundry à aba Macro Maker.
- Contido o layout interno da aba para respeitar a largura e a altura disponíveis.

## 0.2.0 - 2026-09-22

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
- Interface principal migrada para `ApplicationV2` e aba nativa adicionada à sidebar do Foundry V13.
- Fallback no diretório de Macros mantido para acesso ao editor.
- Seleção por token, ponto, círculo, cone, linha e template medido, com cancelamento seguro.
- Filtros de relação, limites de alvo, alcance em unidades da cena e visualização no canvas.
- Etapas distintas de ataque, teste, dano, cura e rolagem genérica.
- Críticos por dado natural ativo, margem, fórmula alternativa e multiplicador.
- Adaptadores extensíveis de sistema para Defesa e resistências, além de confirmação manual de acerto.
- Eventos de execução e etapas associadas a início, alvo, ataque, acerto, erro, crítico, dano e fim.
- Múltiplos componentes tipados de dano/cura e modos de rolagem do Foundry.
- Testes unitários de geometria, targeting, rolagens, eventos e adaptadores; 33 testes no total.

## 0.1.0

- Fundação do módulo para Foundry VTT 13.
- Projetos salvos em flags de Macro.
- Executor sequencial e adaptador do Sequencer.
- Editor JSON inicial e launcher no diretório de Macros.
- Exemplo Sabre Fúngico, schema e testes básicos.
