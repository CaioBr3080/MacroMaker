# Macro Maker

Esqueleto de um construtor visual de automações para Foundry VTT, com foco em Sequencer, JB2A, rolagens, condições, som e efeitos persistentes.

## Estado atual

Esta versão `0.2.0` entrega o editor linear e as camadas de targeting e combate. Ela já oferece:

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
- condições iniciais: crítico, não crítico, acerto, erro, distância e variável;
- exemplo `Sabre Fúngico` em `examples/`;
- gancho público `game.modules.get("macro-maker").api`.

Permissões avançadas, condições aninhadas e migrações de schema ainda não estão implementadas. O editor visual linear cobre todos os tipos de etapa atuais.

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

## Limites conhecidos

- A integração de Defesa e resistências depende de adaptadores registrados por sistema; sem adaptador, use Defesa numérica ou confirmação manual.
- O executor atual usa apenas o primeiro alvo para animações direcionadas, embora preserve a lista completa no contexto.
- A validação central já cobre a estrutura comum; schemas específicos por tipo de etapa ainda serão ligados aos respectivos campos.
- Testes dentro do Foundry V13 ainda são necessários para confirmar ApplicationV2, a aba lateral, os modos interativos do canvas e o Sequencer real.

## Notas de compatibilidade do Foundry V13

- `Roll.evaluate()` é assíncrono e é aguardado pelo executor.
- Distâncias usam a API pública `canvas.grid.measurePath(...).distance`.
- Coordenadas do crosshair usam `canvas.canvasCoordinatesFromClient` e `canvas.clientCoordinatesFromCanvas`.
- O seletor visual usa `foundry.applications.apps.FilePicker`, com fallback para o alias global legado.
- O editor usa `HandlebarsApplicationMixin(ApplicationV2)` e a aba usa `AbstractSidebarTab`.

## Licença

MIT.
