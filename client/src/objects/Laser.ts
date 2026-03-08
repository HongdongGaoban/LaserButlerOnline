import Phaser from 'phaser';
import { LASER, PLAYER_COLORS } from '../config';
import { Vec2, normalize, reflect } from '../utils/Vector';

export interface WallSegment {
  x1: number; y1: number;
  x2: number; y2: number;
  normalX: number; normalY: number;  // 法線ベクトル（正規化済み）
}

/**
 * レーザー弾クラス
 * 壁に当たると正確な角度で反射し、最大反射回数または生存時間で消失する
 */
export class Laser {
  private graphics: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;

  x: number;
  y: number;
  private vx: number;
  private vy: number;

  private bounceCount = 0;
  private elapsed = 0;
  private alive = true;

  readonly ownerId: string;
  readonly ownerColorIndex: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    ownerId: string,
    ownerColorIndex: number,
  ) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.ownerId = ownerId;
    this.ownerColorIndex = ownerColorIndex;

    const dir = normalize({ x: dirX, y: dirY });
    this.vx = dir.x * LASER.SPEED;
    this.vy = dir.y * LASER.SPEED;

    this.graphics = scene.add.graphics();
  }

  get isAlive(): boolean {
    return this.alive;
  }

  /** フレームごとの更新（delta: ms） */
  update(delta: number, walls: WallSegment[]): void {
    if (!this.alive) return;

    this.elapsed += delta;
    if (this.elapsed >= LASER.LIFETIME) {
      this.destroy();
      return;
    }

    const dt = delta / 1000;
    const nextX = this.x + this.vx * dt;
    const nextY = this.y + this.vy * dt;

    // 壁との衝突チェック
    const hit = this.checkWallCollision(this.x, this.y, nextX, nextY, walls);
    if (hit) {
      if (this.bounceCount >= LASER.MAX_BOUNCES) {
        this.destroy();
        return;
      }
      // 反射
      const dir = normalize({ x: this.vx, y: this.vy });
      const normal: Vec2 = { x: hit.normalX, y: hit.normalY };
      const reflected = reflect(dir, normal);
      this.vx = reflected.x * LASER.SPEED;
      this.vy = reflected.y * LASER.SPEED;
      this.x = hit.hitX;
      this.y = hit.hitY;
      this.bounceCount++;
    } else {
      this.x = nextX;
      this.y = nextY;
    }

    this.draw();
  }

  private checkWallCollision(
    x1: number, y1: number, x2: number, y2: number,
    walls: WallSegment[],
  ): { hitX: number; hitY: number; normalX: number; normalY: number } | null {
    let closestT = Infinity;
    let result: { hitX: number; hitY: number; normalX: number; normalY: number } | null = null;

    for (const wall of walls) {
      // 線分と線分の交差判定（パラメトリック）
      const dx = x2 - x1, dy = y2 - y1;
      const wx = wall.x2 - wall.x1, wy = wall.y2 - wall.y1;
      const denom = dx * wy - dy * wx;
      if (Math.abs(denom) < 1e-10) continue; // 平行

      const t = ((wall.x1 - x1) * wy - (wall.y1 - y1) * wx) / denom;
      const u = ((wall.x1 - x1) * dy - (wall.y1 - y1) * dx) / denom;

      if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && t < closestT) {
        closestT = t;
        result = {
          hitX: x1 + t * dx,
          hitY: y1 + t * dy,
          normalX: wall.normalX,
          normalY: wall.normalY,
        };
      }
    }

    return result;
  }

  private draw(): void {
    this.graphics.clear();

    const color = PLAYER_COLORS[this.ownerColorIndex % PLAYER_COLORS.length];

    // レーザー本体
    this.graphics.lineStyle(LASER.WIDTH, color, 1);
    const tailX = this.x - normalize({ x: this.vx, y: this.vy }).x * LASER.LENGTH;
    const tailY = this.y - normalize({ x: this.vx, y: this.vy }).y * LASER.LENGTH;
    this.graphics.beginPath();
    this.graphics.moveTo(tailX, tailY);
    this.graphics.lineTo(this.x, this.y);
    this.graphics.strokePath();

    // グロー効果（外側に薄い線を追加）
    this.graphics.lineStyle(LASER.WIDTH + 4, color, 0.2);
    this.graphics.beginPath();
    this.graphics.moveTo(tailX, tailY);
    this.graphics.lineTo(this.x, this.y);
    this.graphics.strokePath();
  }

  destroy(): void {
    this.alive = false;
    this.graphics.destroy();
  }
}
