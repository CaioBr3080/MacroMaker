export class ConditionEngine {
  static matches(condition, context) {
    if (!condition || condition.type === "always") return true;

    switch (condition.type) {
      case "critical": return context.critical === true;
      case "notCritical": return context.critical !== true;
      case "hit": return context.hit === true;
      case "miss": return context.hit === false;
      case "distanceAbove": return (context.distanceTo() ?? -Infinity) > Number(condition.value);
      case "distanceAtMost": return (context.distanceTo() ?? Infinity) <= Number(condition.value);
      case "variableEquals": return context.variables?.[condition.key] === condition.value;
      default:
        console.warn("Macro Maker | condição desconhecida", condition);
        return false;
    }
  }

  static allMatch(conditions = [], context) {
    return conditions.every((condition) => this.matches(condition, context));
  }
}
