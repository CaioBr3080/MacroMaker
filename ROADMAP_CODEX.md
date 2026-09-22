# Macro Maker — documento de implementação para o Codex

## 1. Visão do produto

Macro Maker será um construtor visual de ações para Foundry VTT. O usuário monta uma sequência sem escrever JavaScript e combina:

- seleção do executante e dos alvos;
- rolagens de ataque, dano, cura e testes;
- animações do Sequencer/JB2A;
- sons;
- espera e sincronização;
- efeitos instantâneos e persistentes;
- menus personalizados;
- condições como crítico, acerto, erro, distância, resultado, estado e opção escolhida;
- ramificações e substituições de etapas;
- permissões e compartilhamento do mestre com jogadores.

O resultado precisa continuar sendo natural para o Foundry: aparecer no diretório de Macros, aceitar pastas, ownership, hotbar, ícone e execução por jogador.

## 2. Regra arquitetural principal

Nunca trate o JavaScript gerado como a fonte editável.

Cada projeto deve ser salvo no Macro Document:

```js
flags: {
  "macro-maker": {
    project: {
      schemaVersion: 1,
      name: "Sabre Fúngico",
      targeting: {},
      variables: {},
      steps: [],
      conditions: []
    }
  }
}
```

O `command` do Macro deve continuar mínimo:

```js
await game.macroMaker.executeMacro("Macro.UUID");
```

Fluxo correto:

```text
Projeto nas flags -> validação/migração -> contexto -> executor -> Sequencer/Rolls/Foundry
```

Não implementar:

- parser reverso de JavaScript;
- `eval` de expressões escritas pelo usuário;
- caminhos internos do Foundry espalhados pela interface;
- acesso direto a dados específicos de Ordem Paranormal dentro do núcleo.

Integrações de sistema devem ficar em adaptadores.

## 3. Estado entregue neste esqueleto

O projeto já possui:

- manifesto para Foundry VTT 13;
- launcher no diretório de Macros;
- aplicação inicial com biblioteca lateral e editor JSON;
- repositório que cria, lista, lê, atualiza e duplica projetos;
- executor sequencial;
- contexto com token controlado, targets, distância, variáveis e estado de ataque;
- etapas `animation`, `sound`, `wait`, `attack`, `damage`, `menu` e `removePersistent`;
- crítico por d20 natural;
- condições iniciais;
- persistência nomeada por projeto;
- schema inicial;
- exemplo Sabre Fúngico;
- scripts de checagem e teste.

Antes de avançar, instale este esqueleto num mundo descartável do Foundry V13 e registre os erros reais do console. A API do Foundry muda entre versões; corrija incompatibilidades observadas antes de aumentar o escopo.

## 4. Regras para o Codex trabalhar neste repositório

1. Trabalhe uma fase por vez.
2. Antes de editar, leia `README.md`, este arquivo e os arquivos envolvidos na fase.
3. Preserve o formato de projeto e adicione migrações quando ele mudar.
4. Não coloque lógica do Sequencer dentro de componentes visuais.
5. Não coloque manipulação de Document dentro de executores de efeito.
6. Não dependa de JB2A: aceite caminho de arquivo normal e chave do banco do Sequencer.
7. Toda função nova precisa de tratamento de erro visível ao usuário.
8. Não confie em valores vindos do formulário; normalize e valide antes de salvar.
9. Não use APIs privadas do Foundry quando houver API pública.
10. Não faça uma refatoração ampla junto de um recurso novo.
11. Execute `npm run check` e `npm test` após cada lote de mudanças.
12. Atualize `CHANGELOG.md` e os critérios de aceite da fase concluída.

## 5. Arquitetura desejada

### 5.1 Camadas

| Camada | Responsabilidade | Não deve fazer |
| --- | --- | --- |
| UI | Editar projeto, ordenar etapas, apresentar erros | Executar Sequencer diretamente |
| Validação | Normalizar e validar projetos | Renderizar interface |
| Repositório | CRUD de Macro Documents, flags, ownership e pasta | Interpretar etapas |
| Executor | Criar contexto e percorrer o fluxo | Conhecer HTML |
| Step executors | Executar um tipo de etapa | Salvar projeto |
| Adapters | Traduzir intenção para Foundry, Sequencer e sistema | Decidir fluxo visual |
| Migrações | Converter schemas antigos | Alterar documentos sem backup/consentimento |

### 5.2 Registro de etapas

Substituir o `switch` central por um registro extensível:

```js
game.macroMaker.steps.register("animation", {
  label: "Animação",
  icon: "fas fa-film",
  defaults: {},
  schema: {},
  execute: async (step, context) => {}
});
```

Isso permitirá que outros módulos adicionem tipos de etapa sem editar o núcleo.

### 5.3 Contexto de execução

O contexto deve manter pelo menos:

```js
{
  project,
  macro,
  source,
  targets,
  target,
  location,
  variables,
  attack,
  lastRoll,
  critical,
  hit,
  cancelled,
  executionId
}
```

Para múltiplos alvos, definir explicitamente se a etapa executa:

- uma vez usando `targets`;
- uma vez por alvo, atualizando `context.target`;
- somente no primeiro alvo.

Nunca deixar isso implícito.

## 6. Fases de implementação

### Fase 0 — estabilizar o esqueleto

Objetivo: abrir, salvar e executar no Foundry V13 sem erro.

Tarefas:

- instalar manualmente o ZIP num mundo de teste;
- verificar o formato atual de `renderMacroDirectory`;
- verificar se o shell legado `Application` funciona sem avisos impeditivos;
- confirmar a assinatura de `Roll.evaluate` no V13;
- confirmar as chamadas usadas do Sequencer instalado;
- corrigir o encadeamento do som, animação e persistent;
- confirmar que o Macro criado recebe UUID e comando corretos;
- testar com GM e jogador proprietário;
- documentar qualquer diferença entre Foundry V13 e V14.

Critérios de aceite:

- o mundo inicia sem erro do Macro Maker;
- o botão aparece no diretório de Macros;
- salvar cria exatamente um Macro;
- reabrir recupera o projeto das flags;
- o exemplo rola ataque e dano;
- uma animação JB2A e um som local são reproduzidos;
- um erro de seleção gera notificação, não exceção silenciosa.

### Fase 1 — editor visual de etapas

Objetivo: construir a maioria dos macros simples sem editar JSON.

Tarefas:

- [x] criar cartões de etapa;
- [x] criar seletor de tipo de etapa;
- [x] permitir adicionar, duplicar, excluir, habilitar e desabilitar;
- [x] permitir reordenar por botões e drag-and-drop;
- [x] painel de propriedades por tipo;
- campos comuns: rótulo, delay, condição, alvo e execução por alvo;
- [x] manter um modo JSON avançado separado;
- [x] impedir que alterações visuais destruam propriedades desconhecidas;
- [x] implementar undo/redo local da sessão.

Campos visuais mínimos da animação:

- `file` com texto e file picker;
- origem e destino;
- `atLocation`, `attachTo`, `stretchTo`;
- `scale`, `scaleToObject`, `opacity`, `tint`, `rotation`;
- `playbackRate`, `belowTokens`, `randomRotation`, espelhamento;
- `fadeIn`, `fadeOut`, `persist`, nome do persistente;
- comportamento por distância.

Critérios de aceite:

- criar o Sabre Fúngico sem tocar no JSON;
- reordenar etapas muda a ordem real de execução;
- fechar e reabrir preserva todos os valores;
- entrada inválida destaca o campo responsável;
- o usuário não perde dados ao alternar entre visual e JSON.

### Fase 2 — targeting completo e aba lateral própria

Objetivo: dar ao Macro Maker uma presença nativa e cobrir formas de seleção.

Tarefas:

- migrar a interface para a API pública recomendada de ApplicationV2;
- implementar uma aba própria da sidebar usando somente API pública documentada;
- manter fallback pelo diretório de Macros;
- targets atuais com `T`;
- crosshair de ponto;
- seleção de token;
- círculo, cone, linha e template;
- mínimo e máximo de alvos;
- filtros aliado/inimigo/todos;
- alcance em unidades da cena;
- visualização do alcance antes de confirmar;
- cancelar crosshair sem deixar estado parcial.

Critérios de aceite:

- todos os modos podem ser cancelados sem erro;
- limite de alvos é respeitado;
- medidas funcionam em grid quadrado, hexagonal e gridless;
- a aba não quebra quando a sidebar está recolhida;
- o fallback continua acessível.

### Fase 3 — rolagens, crítico, acerto e eventos

Objetivo: modelar combate sem amarrar o módulo a um sistema.

Tarefas:

- separar etapas de ataque, teste, dano, cura e rolagem genérica;
- detectar crítico pelos termos naturais configurados;
- margem, multiplicador e fórmula alternativa;
- adaptador de sistema para localizar Defesa e resistências;
- modo manual de confirmação de acerto;
- modos `onStart`, `onTarget`, `onAttack`, `onHit`, `onMiss`, `onCritical`, `onDamage`, `onEnd`;
- expor resultados nas variáveis;
- múltiplos tipos de dano;
- rolagem pública, privada, cega e apenas GM.

Critérios de aceite:

- `4d20kh + 15` critica se qualquer d20 ativo satisfizer a regra configurada;
- crítico pode substituir fórmula, som e animação;
- sem adaptador de sistema, o usuário escolhe comparação numérica ou confirmação manual;
- eventos executam na ordem documentada.

### Fase 4 — condições e ramificações

Objetivo: transformar a sequência numa árvore de automação compreensível.

Tarefas:

- grupos `AND`, `OR` e `NOT`;
- condições de crítico, acerto, erro e distância;
- valor da rolagem, dano e dado natural;
- HP percentual por adaptador;
- item, efeito e tag;
- quantidade de alvos;
- variável e opção de menu;
- ações condicionais: adicionar, remover, substituir e modificar etapa;
- nós de ramificação visual;
- prevenção de ciclos infinitos;
- log de depuração mostrando por que uma condição passou ou falhou.

Representação sugerida:

```js
{
  type: "group",
  operator: "and",
  children: [
    { type: "critical" },
    { type: "distance", operator: "lte", value: 6 }
  ]
}
```

Não armazenar JavaScript de condição.

Critérios de aceite:

- condições aninhadas sobrevivem a salvar/reabrir;
- o preview explica o resultado;
- nenhum campo executa código arbitrário;
- alterações condicionais não mutam permanentemente o projeto-fonte durante a execução.

### Fase 5 — menus e variáveis

Objetivo: cobrir macros grandes de veneno, postura, munição e versões de ritual.

Tarefas:

- editor de menu com título, descrição, imagem, ícone e colunas;
- opções simples e cartões visuais;
- seleção única e múltipla;
- variáveis locais da execução;
- valores padrão;
- interpolação segura, por exemplo `{{variables.poison}}`;
- etapa de atribuição e transformação de variável;
- validação de nome e tipo;
- cancelamento configurável.

Critérios de aceite:

- um menu de três venenos direciona para três comportamentos;
- cancelar pode abortar ou usar padrão;
- uma execução não vaza variáveis para a próxima;
- conteúdo do usuário é escapado no HTML.

### Fase 6 — persistentes e ciclo de vida

Objetivo: tornar efeitos persistentes previsíveis e removíveis.

Tarefas:

- identificador estável por projeto e etapa;
- persistência no source, target e posição;
- duração em segundos e rodadas;
- vínculo a Token, Actor, Item e ActiveEffect quando suportado;
- remover por nome, origem, alvo, projeto ou tag;
- atualizar persistent existente em vez de duplicar;
- limpeza em exclusão de token/cena quando apropriado;
- painel de persistentes ativos para o GM.

Critérios de aceite:

- executar duas vezes respeita a política de duplicação;
- remover no alvo não remove o efeito do executante;
- nomes não colidem entre dois projetos;
- efeitos órfãos podem ser encontrados e encerrados.

### Fase 7 — permissões, pastas e compartilhamento

Objetivo: o mestre entregar macros aos jogadores sem expor o restante.

Tarefas:

- criar em pasta escolhida;
- definir ownership por usuário;
- atribuir a jogador;
- adicionar à hotbar em slot escolhido, quando permitido;
- modos OWNER, OBSERVER e execução sem edição;
- duplicar para outro jogador;
- bloquear edição de campos marcados pelo GM;
- registrar autor e última edição;
- lidar com jogador desconectado;
- evitar que um jogador altere flags de Macro que não possui.

Critérios de aceite:

- OWNER edita e executa;
- OBSERVER visualiza conforme política, mas não salva;
- NONE não vê;
- atribuir não muda permissões de outros usuários;
- excluir projeto pede confirmação e respeita ownership.

### Fase 8 — templates, importação e exportação

Objetivo: reduzir o tempo de criação para segundos.

Templates iniciais:

- ataque corpo a corpo;
- ataque à distância;
- ataque em área;
- ritual;
- buff;
- debuff;
- cura;
- teleporte;
- aura persistente.

Tarefas:

- galeria de templates;
- salvar projeto como template;
- exportar JSON com versão;
- importar com validação e preview;
- resolver caminhos ausentes;
- duplicar com novos IDs internos;
- categorias e pesquisa;
- pacote opcional de exemplos de Ordem Paranormal sem acoplar o núcleo ao sistema.

Critérios de aceite:

- importação inválida não cria Macro parcial;
- template não compartilha referências mutáveis com o original;
- caminhos ausentes são listados antes da execução;
- exportar e importar preserva comportamento.

### Fase 9 — migrações e compatibilidade

Objetivo: atualizar o módulo sem quebrar projetos antigos.

Tarefas:

- criar `MigrationRegistry`;
- uma migração pequena por mudança de schema;
- nunca pular versões;
- backup serializado antes de migração em massa;
- migração preguiçosa ao abrir e ferramenta de migração em lote;
- relatório de sucesso e falha;
- matriz de Foundry e Sequencer suportados;
- testes com dados das versões anteriores.

Interface sugerida:

```js
migrations.register(1, 2, (project) => migratedProject);
```

Critérios de aceite:

- projetos v1 abrem depois de uma alteração para v2;
- falha de migração não sobrescreve a fonte antiga;
- o usuário consegue exportar o backup;
- o Macro compilado é atualizado após migrar.

### Fase 10 — qualidade, publicação e documentação

Objetivo: preparar uma versão pública sustentável.

Tarefas:

- testes unitários de condição, migração e compilação;
- testes manuais documentados em Foundry;
- log de execução ativável;
- tratamento global de erros;
- localização completa pt-BR e en;
- acessibilidade por teclado;
- responsividade para sidebar estreita;
- `manifest` e `download` de release;
- workflow de ZIP e release;
- versionamento semântico;
- guia de contribuição;
- política clara sobre caminhos de assets pagos;
- screenshots e GIF curto do fluxo de criação.

Critérios de aceite:

- instalação por Manifest URL;
- atualização preserva projetos;
- nenhum asset pago é redistribuído;
- documentação cobre instalação, primeiro macro, erros e compatibilidade;
- pacote publicado contém somente os arquivos necessários.

## 7. Ordem recomendada das primeiras entregas

Não comece pelo editor em nós. A ordem de menor risco é:

1. validar o executor real no Foundry;
2. editor visual linear;
3. targeting completo;
4. rolagens e eventos;
5. condições aninhadas;
6. menus e variáveis;
7. persistentes;
8. permissões;
9. templates;
10. nós visuais opcionais.

Uma timeline linear com ramificações explícitas cobre a maior parte dos macros e é mais simples de depurar que um grafo livre.

## 8. Backlog técnico imediato

Use esta lista na primeira sessão de Codex:

- [ ] Abrir o módulo em Foundry V13.
- [ ] Registrar erros do console.
- [ ] Corrigir APIs divergentes.
- [ ] Testar criação e atualização de Macro.
- [ ] Testar propriedade e visibilidade com um jogador.
- [ ] Testar Sequencer com caminho físico.
- [ ] Testar Sequencer com chave JB2A.
- [ ] Testar efeito persistente e remoção no alvo.
- [ ] Testar crítico em `4d20kh`.
- [x] Tornar a validação do projeto uma classe própria.
- [x] Criar registro de tipos de etapa.
- [x] Criar o primeiro cartão visual de animação.

## 9. Checklist para cada pull request

- [ ] Escopo pequeno e descrito.
- [ ] Não remove propriedades desconhecidas do projeto.
- [ ] Não usa `eval`.
- [ ] Erros aparecem em notificação e no console com contexto.
- [ ] `npm run check` passa.
- [ ] `npm test` passa.
- [ ] Teste manual relevante foi executado no Foundry.
- [ ] `CHANGELOG.md` foi atualizado.
- [ ] Mudança de schema inclui migração.
- [ ] README foi atualizado se o comportamento público mudou.

## 10. Definição do MVP público

O MVP público está pronto quando um mestre consegue, sem editar JSON:

1. criar um macro;
2. escolher token e alvo;
3. configurar alcance;
4. adicionar ataque e dano com crítico;
5. adicionar animações, sons e delays;
6. configurar um efeito persistente;
7. usar condições de crítico e distância;
8. salvar, reabrir e editar;
9. atribuir ao jogador;
10. executar pela hotbar.

Tudo além disso pode entrar depois sem comprometer o valor inicial do módulo.
