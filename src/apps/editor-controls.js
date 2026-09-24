export function targetingFieldActive(field, targeting = {}) {
  const { mode, source } = targeting;
  if (field === "radius") return ["circle", "cone"].includes(mode);
  if (field === "angle") return mode === "cone";
  if (field === "width") return mode === "line";
  if (["range", "blockOutOfRange"].includes(field)) return mode !== "none" && source !== "none";
  if (field === "filter") return !["none", "point"].includes(mode);
  if (["minTargets", "maxTargets"].includes(field)) return mode !== "none";
  return true;
}

export function folderChoices(folders) {
  const macros = [...folders].filter((folder) => folder.type === "Macro");
  const byId = new Map(macros.map((folder) => [folder.id, folder]));
  return macros.map((folder) => {
    const names = [folder.name];
    const visited = new Set([folder.id]);
    let parent = folder.folder;
    while (parent) {
      parent = typeof parent === "string" ? byId.get(parent) : parent;
      if (!parent || visited.has(parent.id)) break;
      visited.add(parent.id);
      names.unshift(parent.name);
      parent = parent.folder;
    }
    return { id: folder.id, name: names.join(" / ") };
  }).sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
}

export function moveStepTo(steps, from, to) {
  if (![from, to].every(Number.isInteger) || from < 0 || to < 0 || from >= steps.length || to >= steps.length) {
    throw new Error(`Escolha uma posição entre 1 e ${steps.length}.`);
  }
  steps.splice(to, 0, steps.splice(from, 1)[0]);
}

const reserved = new Set(["__proto__", "prototype", "constructor", "lastRoll", "attack", "damage", "healing", "roll", "test", "damagePart", "healingPart"]);
export function validateVariableName(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) || /^d\d/i.test(name) || reserved.has(name)) {
    throw new Error("Use um nome como FOR ou BONUS (letras, números e _, sem espaços). Esse nome não pode ser reservado pela execução.");
  }
  return name;
}

export function parseVariableValue(value, type) {
  if (type === "number") {
    if (!String(value).trim() || !Number.isFinite(Number(value))) throw new Error("Informe um número válido para a variável.");
    return Number(value);
  }
  if (type === "boolean") {
    if (!["true", "false"].includes(value)) throw new Error("Use true ou false para booleanos.");
    return value === "true";
  }
  if (type === "json") return JSON.parse(value);
  return String(value);
}

export const FIELD_HELP = {
  name: "Nome exibido para identificar o projeto ou efeito. Para remover um efeito por nome, use o mesmo nome na etapa de remoção.",
  description: "Descrição livre para explicar a finalidade do projeto ou a escolha oferecida no menu.",
  source: "Origem da automação: token executante, alvo, ponto ou template, conforme as opções deste campo. Cone e linha precisam de um token de origem.",
  mode: "Método para escolher alvos ou uma área. Os campos de geometria que não se aplicam ficam cinza sem perder os valores.",
  target: "Destino da animação. Ponto e template dependem do método de seleção escolhido no projeto.",
  label: "Nome da etapa, mostrado no cartão e na lista lateral. Não altera o comportamento.",
  enabled: "Desmarque para ignorar esta etapa sem removê-la do projeto.",
  type: "Tipo do componente (ex.: corte ou fogo), condição ou ação, conforme este campo. Os tipos de dano são consultados pelo adaptador de resistências.",
  event: "Vazio executa na sequência. Um evento faz esta etapa reagir ao ataque, acerto, crítico, dano ou outro momento indicado.",
  hotbarSlot: "Número de 1 a 50 na sua hotbar. Ao salvar, o Macro será colocado nesse slot; não altera a hotbar de outros usuários.",
  observerCanExecute: "Permite a execução pelo módulo para quem tem acesso OBSERVER. As permissões gerais de scripts do Foundry ainda se aplicam.",
  lockedFields: "Caminhos separados por vírgula que só o GM pode alterar. Ex.: targeting, steps. Deixe variables fora da lista se o jogador deve editar FOR.",
  attachTo: "Anexa o efeito ao objeto de origem, acompanhando seu movimento.",
  stretchTo: "Estica sempre a animação entre a origem e o destino. Desmarque para usar somente o limite de distância abaixo.",
  rotateTowardsTarget: "Aponta a animação da origem para o destino escolhido. Funciona também quando o efeito estica; o ajuste de rotação corrige a orientação do asset.",
  belowTokens: "Desenha o efeito abaixo dos tokens.",
  randomRotation: "Escolhe uma rotação aleatória para a animação.",
  mirrorX: "Espelha a animação na horizontal.",
  mirrorY: "Espelha a animação na vertical.",
  duplicatePolicy: "Substituir atualiza o persistente existente; manter evita duplicatas; empilhar cria outro efeito.",
  linkUuid: "UUID de Token, Actor, Item ou ActiveEffect ao qual vincular o efeito persistente. Opcional.",
  tags: "Palavras separadas por vírgula para agrupar efeitos persistentes e removê-los por tag.",
  hitMode: "Automático compara o total com a defesa. Manual pede confirmação de acerto durante a execução.",
  damageType: "Tipo de dano, como corte, fogo ou energia. É usado pelo adaptador de resistências do sistema, quando disponível.",
  typeLabel: "Rótulo do componente de cura. Os componentes são somados na mesma rolagem.",
  title: "Título apresentado ao jogador no menu de escolha.",
  selection: "Única salva um valor; múltipla salva uma lista com as opções escolhidas.",
  columns: "Número de colunas do menu visual, entre 1 e 6. A posição de cada opção pode ser definida no campo Coluna.",
  textTransform: "Define como os rótulos das opções dessa coluna aparecem: texto original, maiúsculas, minúsculas ou iniciais maiúsculas. Os valores das opções não mudam.",
  cancelBehavior: "Define se cancelar o menu interrompe a macro, usa o valor padrão ou continua sem atribuir uma escolha.",
  defaultValue: "Valor atribuído à variável quando o menu é cancelado com a opção Usar padrão.",
  image: "Caminho de imagem no servidor Foundry para ilustrar o menu ou uma opção.",
  operation: "Definir substitui o valor. Somar, subtrair e multiplicar calculam a partir do valor atual. Alternar inverte true/false.",
  valueType: "Número para cálculos, texto para rótulos, booleano para true/false e lista para múltiplos valores.",
  value: "Valor da condição, opção ou variável. Na etapa Definir variável, o tipo escolhido determina a conversão.",
  operator: "Comparação da condição: igual, diferente, maior, menor ou contém. Grupos combinam condições com AND, OR ou NOT.",
  key: "Nome da variável ou chave consultada pela condição. Ex.: FOR ou damage.total.",
  action: "Escolhe como alterar uma etapa durante esta execução. O projeto salvo não é modificado.",
  targetId: "ID da etapa a modificar nesta execução. Você pode consultar os IDs no JSON avançado.",
  scope: "Critério usado para encontrar os efeitos persistentes a encerrar. Todos se limita aos efeitos do Macro Maker.",
  stepId: "ID da etapa que criou o efeito persistente; pode ser consultado no JSON avançado.",
  tag: "Tag utilizada na criação dos persistentes que você deseja encerrar.",
  playbackRate: "Velocidade de reprodução: 1 = normal, 0.5 = metade, 2 = dobro. Não é velocidade de deslocamento. Vazio usa o padrão do arquivo.",
  range: "Distância máxima da origem ao alvo/ponto, nas unidades da cena. Vazio = sem limite. Marque Bloquear fora do alcance para impedir a execução.",
  radius: "Raio do círculo ou comprimento do cone, nas unidades da cena.",
  angle: "Abertura do cone em graus: 90 é um quarto de círculo; 360 é um círculo completo.",
  width: "Largura da linha nas unidades da cena. O comprimento vai da origem até o ponto clicado.",
  blockOutOfRange: "Impede executar quando um alvo está além do alcance. Precisa de uma origem e de alcance preenchido.",
  clearTargetsAfterExecution: "Desmarca somente os alvos usados ao concluir a macro. Não altera o token executante controlado.",
  minTargets: "Quantidade mínima de alvos. Em Escolher ponto, o ponto conta como uma seleção.",
  maxTargets: "Quantidade máxima permitida de alvos (não é o raio da área).",
  filter: "Todos, aliados ou inimigos. A relação é comparada com o token de origem.",
  formula: "Ex.: 1d20 + FOR ou 2d6 + @FOR. Cadastre FOR nas Variáveis do projeto. Componentes na mesma etapa são somados em uma rolagem.",
  criticalFormula: "Fórmula usada quando houver crítico. Vazio mantém a fórmula normal e aplica o multiplicador, se informado.",
  criticalMultiplier: "Multiplica o resultado do componente no crítico; 2 dobra o total. Para dobrar apenas os dados, use uma fórmula crítica como 2d6 + FOR.",
  criticalThreshold: "Resultado natural do d20 a partir do qual a rolagem é crítica. Ex.: 20 ou 19.",
  criticalMargin: "Também considera crítico ao superar a defesa por esta diferença. Opcional.",
  defense: "Valor numérico contra o qual o ataque é comparado. Vazio consulta o adaptador do sistema.",
  defenseKey: "Chave reconhecida pelo adaptador do seu sistema para consultar a defesa. Não é uma fórmula.",
  scale: "Tamanho base da animação: 1 = original, 0.5 = metade, 2 = dobro. Continua valendo quando o efeito estica.",
  scaleToObject: "Dimensiona a animação em relação ao token/objeto. 1 corresponde ao tamanho do objeto.",
  opacity: "Transparência da animação entre 0 (invisível) e 1 (opaca).",
  tint: "Escolha a cor no seletor RGB ou digite #RRGGBB. Vazio preserva a cor original.",
  rotation: "Em graus. Sem apontar ao destino, gira a animação; com Apontar para o destino, funciona como ajuste fino da direção. Ex.: 90 gira um quarto de volta.",
  fadeIn: "Tempo para aparecer gradualmente, em milissegundos. 1000 ms = 1 segundo.",
  fadeOut: "Tempo para desaparecer gradualmente, em milissegundos. 1000 ms = 1 segundo.",
  ms: "Tempo de espera, em milissegundos. 1000 ms = 1 segundo.",
  volume: "Volume entre 0 (mudo) e 1 (máximo). Ex.: 0.5 = metade.",
  stretchAfter: "Estica somente quando a distância até o destino exceder esse valor, nas unidades da cena. Deixe vazio para não usar limite.",
  flavor: "Texto da mensagem no chat. Use os controles abaixo para fonte, tamanho, cor e estilo. Variáveis no texto: {{variables.FOR}}.",
  speakerAppend: "Complemento que acompanha o nome do usuário no chat. Digite só o final ( — destrói com sua lâmina) ou a frase completa (Aldine destrói com sua lâmina); o nome original nunca é substituído.",
  speakerStyle: "Estilo visual aplicado somente ao nome e ao complemento do usuário no cabeçalho da mensagem.",
  announceTargets: "Adiciona os nomes dos alvos resolvidos logo depois da mensagem da rolagem. Para uma área, lista todos os tokens atingidos.",
  durationSeconds: "Limita a duração em segundos. Vazio usa a duração do arquivo/persistência.",
  durationRounds: "Duração em rodadas, convertidas para segundos pela configuração de combate.",
  persist: "Mantém o efeito após a animação. Pode ser encerrado pela aba de persistentes ou por uma etapa de remoção.",
  folderId: "Pasta de Macros no mundo. O caminho completo distingue subpastas de mesmo nome. Raiz remove a pasta atual.",
  userId: "Concede o nível escolhido ao usuário, inclusive offline. Todos aplica o acesso a todos os usuários, inclusive futuros.",
  level: "OWNER pode editar e executar; OBSERVER apenas visualizar/executar; NONE remove o acesso atribuído. GMs mantêm suas permissões.",
  icon: "Imagem do Macro e da hotbar. Abra a pasta para escolher um arquivo de imagem do Foundry.",
  file: "Caminho de mídia no Foundry ou chave de animação da biblioteca Sequencer. Use a pasta para navegar pelos arquivos.",
  variable: "Nome da variável usada pela etapa. Para valores iniciais, use a seção Variáveis do projeto.",
  rollMode: "Define quem recebe a rolagem: todos, autor e GM, apenas GM (cega) ou apenas o autor.",
  on: "Evento que dispara esta etapa. Vazio executa na sequência principal; um evento aguarda o disparo correspondente.",
  font: "Fonte da mensagem no chat. A disponibilidade depende das fontes instaladas no dispositivo.",
  size: "Tamanho do texto em pixels, entre 8 e 72.",
  color: "Cor do texto em #RRGGBB; o seletor permite escolher RGB visualmente.",
  align: "Alinhamento do texto da mensagem.",
  bold: "Exibe o texto da mensagem em negrito.",
  italic: "Exibe o texto da mensagem em itálico.",
  underline: "Sublinha o texto da mensagem.",
  presetName: "Nome do preset do Baileywiki Mass Edit. Use Escolher asset para preencher pelo navegador de presets.",
  presetUuid: "UUID do preset Mass Edit. O seletor preenche automaticamente; use este campo apenas para informar um UUID conhecido.",
  presetType: "Tipo de documento do preset. ALL deixa o Mass Edit decidir pelo próprio preset.",
  destination: "Ponto onde o asset ou token será colocado: ponto selecionado durante a macro, executante ou alvo.",
  pickPosition: "Abre a prévia de posicionamento do Mass Edit antes de criar o asset.",
  snapToGrid: "Ajusta a criação à grade da cena.",
  hidden: "Cria o documento oculto para jogadores.",
  actorId: "Ator cujo Protótipo de Token será criado. Esta etapa só pode ser configurada pelo GM.",
  tokenName: "Nome exibido pelo token invocado. Vazio usa o nome definido no ator.",
  count: "Quantidade de tokens criados, de 1 a 20.",
  disposition: "Relação do token invocado com os jogadores: hostil, neutra ou amigável.",
  visageId: "Variação de aparência aplicada pelo Visage após a criação do token."};
