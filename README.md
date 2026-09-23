# Macro Maker

Base funcional de um construtor visual de automações para Foundry VTT, com foco em Sequencer, JB2A, rolagens, condições, som e efeitos persistentes.

## Estado atual

Esta versão `0.9.0` entrega a base do MVP até importação, compartilhamento e migrações. Ela já oferece:

- uma aba própria **Macro Maker** na sidebar e um botão de fallback no diretório de Macros;
- editor migrado para `ApplicationV2` e Handlebars;
- criação e edição de projetos por cartões visuais, com modo JSON avançado separado;
- cada projeto salvo como um Macro normal do Foundry;
- fonte do projeto preservada em `flags.macro-maker.project`;
- comando compilado pequeno, chamando `game.macroMaker.executeMacro(uuid)`;
- alvos marcados com `T`, seleção interativa de tokens, ponto, círculo, cone, linha e template medido;
- filtros de aliado/inimigo, mínimo, máximo, alcance e visualização do alcance no canvas;
- etapas separadas de ataque, teste, dano, cura, rolagem genérica, animação, som, espera, menu e remoção de persistente;
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
- menus simples ou em cartões, seleção única/múltipla, padrões, cancelamento configurável e interpolação segura;
- variáveis locais com operações de atribuição, soma, subtração, multiplicação, lista e alternância;
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
2. Ative **Sequencer** e depois **Macro Maker** no mundo.
3. Abra a aba **Macro Maker** na sidebar. Se ela não estiver disponível, use o botão **Macro Maker** no diretório de Macros.
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
