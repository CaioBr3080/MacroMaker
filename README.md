# Macro Maker

Esqueleto de um construtor visual de automações para Foundry VTT, com foco em Sequencer, JB2A, rolagens, condições, som e efeitos persistentes.

## Estado atual

Esta versão `0.1.0` é uma fundação executável, não o produto final. Ela já oferece:

- um botão **Macro Maker** no diretório de Macros;
- criação e edição de projetos por cartões visuais, com modo JSON avançado separado;
- cada projeto salvo como um Macro normal do Foundry;
- fonte do projeto preservada em `flags.macro-maker.project`;
- comando compilado pequeno, chamando `game.macroMaker.executeMacro(uuid)`;
- seleção do token controlado e dos alvos marcados com `T`;
- validação de quantidade e alcance;
- etapas de animação, som, espera, ataque, dano, menu e remoção de persistente;
- validação e normalização centralizadas antes de salvar ou executar;
- registro público e extensível de tipos de etapa em `game.macroMaker.steps`;
- adição, duplicação, exclusão, ativação e reordenação de etapas;
- undo/redo local durante a sessão de edição;
- crítico detectado pelos resultados naturais dos d20;
- fórmula alternativa de dano crítico;
- condições iniciais: crítico, não crítico, acerto, erro, distância e variável;
- exemplo `Sabre Fúngico` em `examples/`;
- gancho público `game.modules.get("macro-maker").api`.

Crosshair, formas de área, permissões avançadas e migrações ainda fazem parte do roadmap. O editor visual linear está em desenvolvimento e já cobre os tipos de etapa do schema v1.

## Instalação para teste

1. Extraia a pasta `macro-maker` dentro de `FoundryVTT/Data/modules/`.
2. Ative **Sequencer** e depois **Macro Maker** no mundo.
3. Abra a aba de Macros e clique em **Macro Maker**.
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
├── tests/
└── ROADMAP_CODEX.md
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

- O shell do editor usa `Application` para reduzir risco no primeiro protótipo; a migração para `ApplicationV2` está prevista.
- O botão fica no diretório de Macros. A aba nativa dedicada da sidebar vem depois que o fluxo principal estiver estável.
- `hit` e `miss` só são definidos se a etapa de ataque receber `defense`; integração com a Defesa de cada sistema deve usar adaptadores.
- O executor atual usa apenas o primeiro alvo para animações direcionadas, embora preserve a lista completa no contexto.
- A validação central já cobre a estrutura comum; schemas específicos por tipo de etapa ainda serão ligados aos respectivos campos.
- Testes dentro do Foundry V13 ainda são necessários para confirmar os pontos dependentes do navegador e do Sequencer.

## Notas de compatibilidade do Foundry V13

- `Roll.evaluate()` é assíncrono e é aguardado pelo executor.
- Distâncias usam a API pública `canvas.grid.measurePath(...).distance`.
- O seletor visual usa `foundry.applications.apps.FilePicker`, com fallback para o alias global legado.
- O editor ainda estende a `Application` legada, disponível mas marcada como obsoleta no V13; a migração para `ApplicationV2` permanece na Fase 2.

## Licença

MIT.
