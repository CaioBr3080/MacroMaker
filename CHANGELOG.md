## 0.9.23 - 2026-09-24

- O campo Crítico a partir de nas etapas Ataque e Teste agora aceita uma variável numérica do projeto, com ou sem `@` (por exemplo, CRITICO ou @CRITICO). O valor é resolvido no momento da rolagem.
## 0.9.22 - 2026-09-24

- O Macro Maker saiu da sidebar: a varinha na barra esquerda do canvas abre um gerenciador próprio, redimensionável e minimizável, com árvore de pastas à esquerda e painel de configuração à direita.
- O gerenciador preserva criação, cores, ownership, subpastas, projetos, efeitos persistentes e arrastar-e-soltar, agora sem comprimir ou deslocar a barra lateral do Foundry.
- Nova etapa Aplicar Visage: variações globais podem atingir o executante, alvo principal ou todos os alvos; para um Visage local, selecione antes o token da cena e o editor exibirá apenas as variações dele.
# Changelog

## 0.9.21 - 2026-09-24

- A etapa Invocar token agora pesquisa o ator/token por nome digitado, evitando listas extensas.
- Modos de visão e de animação de luz agora oferecem listas sugeridas pela configuração ativa do Foundry, incluindo tipos como internal burn quando disponíveis.
- Intensidade e velocidade da animação, além dos ajustes de atenuação, brilho, saturação e contraste, receberam sliders com leitura do valor selecionado.
## 0.9.20 - 2026-09-24

- O seletor de tokens do canvas agora permite pesquisar por nome, ignorando maiúsculas e acentos, sem trocar o token controlado pelo GM.
- Nova etapa Modificar token da cena: atua no executante, alvo principal ou todos os alvos e permite alterar nome, aparência, tamanho, opacidade, visão, luz e ação de movimento.
- A etapa atualiza somente o TokenDocument colocado na cena e bloqueia Recursos e dados do Ator, preservando o protótipo.
## 0.9.19 - 2026-09-24

- Etapas desabilitadas continuam totalmente editáveis e podem ser reativadas pelo checkbox. A interface deixou de usar a classe genérica disabled do Foundry, que bloqueava os cliques.
## 0.9.18 - 2026-09-24

- Corrigidas condições de Dado natural após etapas de dano, espera, animação ou som: elas preservam o d20 da última etapa Ataque, em vez de consultar a última rolagem auxiliar.
- Condições Crítico com Valor agora respeitam o limite do d20. Por exemplo, Crítico ≤ 19 exclui um 20 natural; sem Valor, Crítico continua significando qualquer crítico.
## 0.9.17 - 2026-09-24

- Nova etapa Efeito Token Magic FX: aplica presets ou uma lista JSON de filtros ao executante, alvo ou template medido.
- A etapa permite aplicar, atualizar e remover filtros por Filter ID, com substituição opcional dos filtros existentes.
- Token Magic FX é uma integração opcional recomendada: a configuração é preservada sem o módulo, e a execução informa claramente quando ele não estiver ativo.
## 0.9.16 - 2026-09-24

- Corrigida a orientação de animações sem esticar executadas por jogadores: o Sequencer agora recebe as coordenadas do centro do destino, em vez da referência ao Token que pode exigir permissão adicional.

## 0.9.15 - 2026-09-24

- Variáveis do projeto e a etapa Definir variável agora oferecem o tipo Fórmula de rolagem. Exemplos como DANO = 2d6 + FOR e ATAQUE = 1d20 + 5 são expandidos na própria rolagem do Foundry.
- Fórmulas nomeadas podem ser usadas como DANO ou @DANO nos campos de ataque, dano, cura e rolagem genérica; referências numéricas aninhadas também são resolvidas.

## 0.9.14 - 2026-09-24

- Corrigido o comportamento dos modos do Sequencer: escala base e escala ao objeto valem somente sem esticar; Esticar sempre e Esticar somente após distância ignoram ambas as escalas.
- Apontar para o destino permanece disponível para a animação não esticada, permitindo definir tamanho e ajuste de orientação até alcançar a distância escolhida.

## 0.9.13 - 2026-09-24

- Animações receberam controles de escala base, orientação automática ao destino e limite de distância para o esticamento.
- Nova opção Apontar para o destino: orienta o asset da origem para o alvo/ponto; o campo de rotação passa a ser o ajuste fino dessa direção.
- Esticar sempre e Esticar somente após distância foram separados. Assim, um projétil pode usar tamanho fixo até a distância escolhida e só então alongar até o alvo.

## 0.9.12 - 2026-09-24

- Textareas de descrição, menu, mensagem e complemento do chat preservam quebras de linha inclusive antes do primeiro e depois do último caractere, sem inserir marcador no texto salvo.
- Escolher alvo no canvas, escolher ponto, círculo, cone e linha bloqueiam temporariamente a interação nativa dos tokens e capturam a sequência completa de pointer/mouse/click; clicar no alvo não troca mais o token controlado do GM.

## 0.9.11 - 2026-09-24

- A aba Macro Maker agora gerencia pastas como uma árvore: criar, renomear, colorir, atribuir acesso, mover pastas e projetos por arrastar-e-soltar e devolver itens à raiz.
- As abas, cartões de etapa e blocos de configuração receberam bordas e variações de tom mais claras para separar melhor as áreas no tema escuro.
- Nova etapa **Asset do Mass Edit**: abre o seletor de presets do Baileywiki Mass Edit e cria o preset no executante, alvo ou ponto, com prévia, grade e ocultação.
- Nova etapa **Invocar token**: o GM define ator, nome, quantidade, disposição, posição e opcionalmente uma variação Visage. Jogadores autorizados executam o macro, enquanto a criação é realizada pelo GM ativo e a configuração da invocação permanece exclusiva do GM.
- Manifesto declara socket e recomenda Baileywiki Mass Edit e Visage; sem eles, apenas as funcionalidades correspondentes mostram uma mensagem clara em vez de afetar o restante do módulo.

## 0.9.10 - 2026-09-23

- O campo simples de Mensagem voltou ao editor, com altura para editar parágrafos.
- Linhas vazias inseridas com Enter, inclusive antes e depois do texto, são preservadas no projeto e no chat.
## 0.9.9 - 2026-09-23

- A árvore de pastas da aba Macro Maker agora permite abrir e fechar cada pasta, lembrando a escolha por usuário.
- O GM cria pastas e subpastas diretamente pela aba, já escolhendo o destino, o jogador (ou todos) e o nível de acesso; a engrenagem continua abrindo a configuração completa da pasta.
## 0.9.8 - 2026-09-23

- A aba lateral do Macro Maker agora organiza projetos em uma árvore de pastas e subpastas visível aos jogadores; o GM cria e configura proprietários/permissões pela própria aba.
- A lista de templates não exibe mais a categoria translúcida abaixo do nome.
- Mensagens de rolagem usam o mesmo bloco de textarea do complemento de nome, com tamanho ajustado e preservação explícita de espaços.

## 0.9.7 - 2026-09-23

- Etapas minimizadas ficam lembradas por Macro após fechar e reabrir o editor.
- O editor cria pastas e subpastas de Macros; o menu de contexto de macros do Macro Maker abre diretamente no editor.
- Seleção no canvas bloqueia o clique de controle durante a escolha, restaura o token executante e mostra prévias de círculo, cone e linha.
- Nova opção para desmarcar alvos ao fim da execução e para anexar no chat a quantidade e os nomes dos alvos atingidos.

## 0.9.6 - 2026-09-23

- O complemento do nome no chat preserva os espaços iniciais, finais e repetidos exatamente como digitados, inclusive ao usar uma frase completa com o alias.
- Cada coluna de um menu pode receber título e padronização visual do rótulo (original, maiúsculas, minúsculas ou iniciais maiúsculas), sem alterar os valores usados nas condições.

## 0.9.5 - 2026-09-23

- Menus reorganizados com seletor de imagem para o menu e para cada opção, coluna explícita por opção e instruções para usar a escolha em condições de ramificação.
- Seletor RGB disponível também no estilo do nome do usuário; ícones de ajuda reposicionados para não cobrir os campos.
- Seleção de tokens no canvas converte clique em alvo e preserva o token atacante controlado pelo mestre.

## 0.9.4 - 2026-09-23

- Salvamento visual sincroniza diretamente as textareas antes de validar, preservando espaços no início, no fim, repetidos e quebras de linha em descrições e mensagens.

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
