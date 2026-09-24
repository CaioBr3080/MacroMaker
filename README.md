# Macro Maker

Base funcional de um construtor visual de automações para Foundry VTT, com foco em Sequencer, JB2A, rolagens, condições, som e efeitos persistentes.

## Estado atual

Esta versão `0.9.27` entrega a base do MVP até importação, compartilhamento e migrações. Ela já oferece:

- botão próprio **Macro Maker** na barra esquerda do canvas, abrindo uma janela redimensionável de gerenciamento;
- árvore de pastas e subpastas recolhível na janela do Macro Maker; o GM cria, renomeia, colore, atribui acesso e move projetos ou subpastas por arrastar-e-soltar sem sair dela;
- editor migrado para `ApplicationV2` e Handlebars;
- criação e edição de projetos por cartões visuais, com modo JSON avançado separado;
- cada projeto salvo como um Macro normal do Foundry;
- fonte do projeto preservada em `flags.macro-maker.project`;
- comando compilado pequeno, chamando `game.macroMaker.executeMacro(uuid)`;
- alvos marcados com `T`, seleção interativa de tokens com busca digitável por nome, ponto, círculo, cone, linha e template medido;
- filtros de aliado/inimigo, mínimo, máximo, alcance e visualização do alcance no canvas;
- etapas separadas de ataque, teste, dano, cura, rolagem genérica, animação, som, espera, menu, remoção de persistente, asset configurado do Baileywiki Mass Edit, invocação de token com busca por nome, efeitos do Token Magic FX, aplicação de Visage global ou local e modificação segura do token da cena;
- validação e normalização centralizadas antes de salvar ou executar;
- registro público e extensível de tipos de etapa em `game.macroMaker.steps`;
- adição, duplicação, exclusão, ativação e reordenação de etapas;
- undo/redo local durante a sessão de edição;
- crítico por dados naturais ativos, margem, fórmula alternativa ou multiplicador;
- defesa numérica, confirmação manual de acerto e registro extensível de adaptadores de sistema;
- componentes de dano/cura tipados, resistência via adaptador e quatro modos de visibilidade de rolagem;
- eventos `onStart`, `onTarget`, `onAttack`, `onHit`, `onMiss`, `onCritical`, `onDamage` e `onEnd`;
- grupos de condições `AND`, `OR` e `NOT`, com crítico, acerto, distância, rolagens, dano, dado natural, HP, itens, efeitos, tags, quantidade de alvos e variáveis;
- ramificações visuais `então/senão`, mutações temporárias de etapas e explicação da última execução;
- menus simples ou em cartões, seleção única/múltipla, padrões, cancelamento configurável, títulos/descrições/colunas estilizados e grade responsiva sem textos comprimidos;
- variáveis locais com operações de atribuição, soma, subtração, multiplicação, lista e alternância; variáveis também podem guardar fórmulas de rolagem reutilizáveis do Foundry;
- IDs estáveis por projeto/etapa, políticas de duplicação, duração, vínculo por UUID e remoção de persistentes por escopo;
- painel de persistentes ativos para o GM, inclusive efeitos órfãos, e limpeza ao excluir token/cena;
- pastas, ownership por usuário, OWNER/OBSERVER/NONE, atribuição a usuários offline, hotbar, campos bloqueados e exclusão confirmada;
- galeria pesquisável com nove templates iniciais e templates personalizados do mundo;
- importação com validação, preview e correção de caminhos, além de exportação JSON versionada;
- duplicação com novos IDs internos e referências reescritas;
- schema 2, migração preguiçosa de projetos v1, backup e migração em lote com relatório por Macro;
- relatório público de compatibilidade em `game.macroMaker.compatibility.report()`;
- exemplo `Sabre Fúngico` em `examples/`;
- gancho público `game.modules.get("macro-maker").api`.

Etapas aninhadas aparecem nas faixas visuais da ramificação e continuam disponíveis integralmente no modo JSON. A próxima etapa é a validação visual no Foundry e a correção dos problemas encontrados antes da preparação de publicação.

## Instalação para teste

1. Extraia a pasta `macro-maker` dentro de `FoundryVTT/Data/modules/`.
2. Ative **Sequencer** e depois **Macro Maker** no mundo. Para assets, ative também **Baileywiki Mass Edit**; para variações de invocação, ative **Visage**; para filtros visuais, ative **Token Magic FX**.
3. Na barra esquerda do canvas, clique na varinha **Macro Maker** para abrir o gerenciador. O diretório de Macros também possui o botão de gerenciamento como atalho.
4. Crie um projeto, edite o JSON e salve.
5. Selecione o token executante, marque um alvo com `T` e execute.

Para testar o exemplo, copie o conteúdo de `examples/sabre-fungico.json` para o editor. Troque os caminhos de som e JB2A pelos arquivos existentes no seu servidor.

## Estrutura

```text
macro-maker/
├── module.json
├── src/
│   ├── main.js
│   ├── api.js
│   ├── apps/
│   ├── data/
│   ├── execution/
│   ├── integrations/
│   └── services/
├── templates/
├── styles/
├── schemas/
├── examples/
└── tests/
```

## Modelo de dados

### Controles do editor

- **Variáveis do projeto:** adicione uma variável, renomeie para `FOR`, escolha Número e informe `4`. Use `1d20 + FOR` (ou `1d20 + @FOR`) na fórmula. O limiar de crítico também aceita `FOR` ou `@FOR` quando a variável for numérica. Basta alterar o valor de FOR e salvar para atualizar as próximas execuções. Os nomes diferenciam maiúsculas de minúsculas. Renomear/excluir uma variável exige atualizar suas referências. OWNER pode editar; campos bloqueados pelo GM continuam protegidos.
- **Dano e cura:** componentes dentro da mesma etapa aparecem em uma única rolagem, com total e discriminação dos tipos. Crie outra etapa se quiser uma segunda rolagem. Resistências são indicadas separadamente do total bruto dos dados; o módulo não altera HP automaticamente.
- **Mensagens:** o texto aceita várias linhas e preserva espaços no início, no fim e repetidos ao salvar. Os controles de formatação alteram a mensagem inteira e mostram uma prévia. No texto, use `{FOR}` (ou o formato legado `{{variables.FOR}}`) para mostrar o valor de uma variável. A descrição de opção de menu também calcula fórmulas como `{DT + 5}`.
- **Descrição de opção do menu:** use `{DT}` para exibir uma variável numérica ou `{DT + 5}` para calcular uma fórmula do Foundry quando o menu abrir. Assim, `DT: {DT + 5}` atualiza automaticamente quando DT muda.
- **Menus:** cada opção aceita rótulo, valor, descrição, imagem, ícone e coluna (1–6). Cada coluna pode ter título e padronizar visualmente os rótulos como original, MAIÚSCULAS, minúsculas ou Iniciais Maiúsculas, sem mudar o valor salvo. O menu grava a escolha na variável de saída; em uma Ramificação, use a condição Opção de menu com essa variável e o valor escolhido.
- **Nome no chat:** em Formatação da mensagem, use Complemento após o nome para manter o alias original e anexar texto livre. `Aldine destrói com sua lâmina` resulta no nome original seguido de ` destrói com sua lâmina`; o nome e o complemento têm controles próprios de fonte, tamanho, cor, alinhamento e estilo. Espaços e quebras de linha são preservados.
- **Alvos e áreas:** a seleção no canvas não troca o token executante. Círculo, cone e linha mostram uma prévia antes do clique; ao marcar a lista de alvos na etapa de rolagem, o chat informa quantidade e nomes dos tokens atingidos. Desmarcar alvos ao terminar é opcional.
- **Etapas:** use a seta de recolher para deixar só o cabeçalho. Edite o número para mudar a posição; Enter ou sair do campo confirma. A lista lateral permite navegar pela sequência sem expandir todos os cartões.
- **Distâncias:** os campos cinza não se aplicam ao método selecionado. Seus valores são mantidos para quando você voltar àquele método. Passe o mouse sobre `?` para consultar exemplos e unidades.
- **Imagens e cores:** o botão de pasta ao lado da imagem do Macro abre o seletor do Foundry. Cores aceitam o seletor RGB e valores `#RRGGBB`.
- **Pastas da aba:** o GM cria e edita nome, cor, destino e permissões diretamente na aba. Arraste um projeto ou uma pasta para outra pasta; use “Solte aqui para mover à raiz” para remover o vínculo.
- **Assets e invocações:** a etapa Asset abre o navegador do Baileywiki Mass Edit e executa o preset salvo. A etapa Invocar token usa o protótipo do Ator selecionado; jogadores podem executar o macro, mas o GM ativo cria o token e somente o GM pode configurar essa etapa. Com Visage ativo, selecione uma variação do ator.
- **Compartilhamento:** Todos aplica o acesso selecionado a todos, incluindo usuários offline e futuros. Não alterar atribuição preserva permissões existentes. Pastas mostram o caminho completo; Raiz remove a pasta do Macro.

O Macro Document contém duas partes:

```js
flags: {
  "macro-maker": {
    project: { /* fonte editável */ }
  }
},
command: "await game.macroMaker.executeMacro(\"Macro.ID\");"
```

Não tente interpretar o JavaScript compilado para reconstruir o projeto. A fonte sempre vem das flags.

## Verificação local

Com Node instalado:

```bash
npm run check
npm test
```

Para gerar o ZIP instalável do módulo:

```bash
npm run package
```

O pacote é recriado em `out/macro-maker.zip`. A pasta `out/` contém apenas artefatos locais e não é versionada.

## Limites conhecidos

- A integração de Defesa, resistências e HP percentual depende de adaptadores registrados por sistema; sem adaptador, use Defesa numérica ou confirmação manual. Itens, efeitos e tags têm fallback genérico.
- O executor atual usa apenas o primeiro alvo para animações direcionadas, embora preserve a lista completa no contexto.
- A validação central já cobre a estrutura comum; schemas específicos por tipo de etapa ainda serão ligados aos respectivos campos.
- Testes dentro do Foundry V13 ainda são necessários para confirmar ApplicationV2, a aba lateral, os modos interativos do canvas e o Sequencer real.

## Notas de compatibilidade do Foundry V13

| Componente | Mínimo | Verificado |
| --- | --- | --- |
| Foundry VTT | 13 | 13 |
| Sequencer | 3.6.0 | 3.6+ |

Versões superiores podem funcionar, mas ainda não fazem parte da matriz verificada.

- `Roll.evaluate()` é assíncrono e é aguardado pelo executor.
- Distâncias usam a API pública `canvas.grid.measurePath(...).distance`.
- Coordenadas do crosshair usam `canvas.canvasCoordinatesFromClient` e `canvas.clientCoordinatesFromCanvas`.
- O seletor visual usa `foundry.applications.apps.FilePicker`, com fallback para o alias global legado.
- O editor usa `HandlebarsApplicationMixin(ApplicationV2)` e a aba usa `AbstractSidebarTab`.

## Licença

MIT.
