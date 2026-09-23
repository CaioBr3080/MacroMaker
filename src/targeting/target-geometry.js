export class TargetGeometry {
  static distance(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  static pointInCircle(point, { center, radius }) {
    return this.distance(point, center) <= radius;
  }

  static pointInCone(point, { origin, radius, direction, angle }) {
    const dx = point.x - origin.x;
    const dy = point.y - origin.y;
    if (Math.hypot(dx, dy) > radius) return false;
    const pointDirection = Math.atan2(dy, dx) * 180 / Math.PI;
    const delta = ((pointDirection - direction + 540) % 360) - 180;
    return Math.abs(delta) <= angle / 2;
  }

  static pointInLine(point, { origin, destination, width }) {
    const dx = destination.x - origin.x;
    const dy = destination.y - origin.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) return this.distance(point, origin) <= width / 2;
    const projection = Math.max(0, Math.min(1,
      ((point.x - origin.x) * dx + (point.y - origin.y) * dy) / lengthSquared
    ));
    const closest = { x: origin.x + projection * dx, y: origin.y + projection * dy };
    return this.distance(point, closest) <= width / 2;
  }

  static relationMatches(source, target, filter = "all") {
    if (filter === "all") return true;
    if (!source || !target) return false;
    const sourceDisposition = Number(source.document?.disposition ?? source.disposition ?? 0);
    const targetDisposition = Number(target.document?.disposition ?? target.disposition ?? 0);
    if (filter === "ally") return sourceDisposition === targetDisposition;
    if (filter === "enemy") return sourceDisposition * targetDisposition < 0;
    return false;
  }

  static filterTokens(tokens, { source = null, filter = "all", predicate = () => true } = {}) {
    return tokens.filter((token) => token !== source)
      .filter((token) => this.relationMatches(source, token, filter))
      .filter(predicate);
  }
}
