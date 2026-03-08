import Phaser from 'phaser';
import { LASER, PLAYER_COLORS } from '../config';
import { Vec2, normalize, reflect } from '../utils/Vector';

export interface WallRect {
  x: number; y: number;
  width: number; height: number;
}

// 壁の線分と法線（反射計算用）
export interface WallSegment {
  x1: number; y1: number;
  x2: number; y2: number;
  nx: number; ny: number;    // 法線ベクトル（正規化済み）
}

/** 矩形壁からWallSegment（4辺）を生成 */
export function rectToSegments(r: WallRect): WallSegment[] {
  return [
    { x1: r.x,           y1: r.y,            x2: r.x + r.width, y2: r.y,            nx: 0,  ny: -1 },
    { x1: r.x,           y1: r.y + r.height, x2: r.x + r.width, y2: r.y + r.height, nx: 0,  ny: 1  },
    { x1: r.x,           y1: r.y,            x2: r.x,           y2: r.y + r.height, nx: -1, ny: 0  },
    { x1: r.x + r.width, y1: r.y,            x2: r.x + r.width, y2: r.y + r.height, nx: 1,  ny: 0  },
  ];
}

interface HitResult {
  hitX: number;
  hitY: number;
  nx: number;
  ny: number;
}

/**
 * レーザー弾クラス
 * 壁に当たると R = I - 2(I・N)N で正確に反射する
 */
export class Laser {
  x: number;
  y: number;
  private prevX: number;
  private prevY: number;
  private vx: number;
  private vy: number;

  private bounceCount = 0;
  private elapsed = 0;
  private _alive = true;

  readonly ownerId: string;
  readonly ownerColorIndex: number;

  private graphics: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    dirX: number,
    dirY: number,
    ownerId: string,
    ownerColorIndex: number,
  ) {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.ownerId = ownerId;
    this.ownerColorIndex = ownerColorIndex;

    const dir = normalize({ x: dirX, y: dirY });
    this.vx = dir.x * LASER.SPEED;
    this.vy = dir.y * LASER.SPEED;

    this.graphics = scene.add.graphics();
  }

  get alive(): boolean { return this._alive; }

  /** 前フレームから今フレームまでの移動線分（当たり判定に使用） */
  getSegment(): { x1: number; y1: number; x2: number; y2: number } {
    return { x1: this.prevX, y1: this.prevY, x2: this.x, y2: this.y };
  }

  update(delta: number, walls: WallSegment[]): void {
    if (!this._alive) return;

    this.elapsed += delta;
    if (this.elapsed >= LASER.LIFETIME) { this.destroy(); return; }

    this.prevX = this.x;
    this.prevY = this.y;

    const dt = delta / 1000;
    let remainDt = dt;
    let maxIter = 8;

    while (remainDt > 0 && maxIter-- > 0) {
      const nextX = this.x + this.vx * remainDt;
      const nextY = this.y + this.vy * remainDt;

      const hit = this.findWallHit(this.x, this.y, nextX, nextY, walls);
      if (!hit) {
        this.x = nextX;
        this.y = nextY;
        break;
      }

      // 衝突点までの移動割合
      const travelDist = Math.sqrt((hit.hitX - this.x) ** 2 + (hit.hitY - this.y) ** 2);
      const fullDist = Math.sqrt((nextX - this.x) ** 2 + (nextY - this.y) ** 2);
      const t = fullDist > 0 ? travelDist / fullDist : 0;
      remainDt *= (1 - t);

      this.x = hit.hitX + hit.nx * 0.5;
      this.y = hit.hitY + hit.ny * 0.5;

      if (this.bounceCount >= LASER.MAX_BOUNCES) {
        this.destroy();
        return;
      }

      // 反射: R = I - 2(I·N)N
      const dir = normalize({ x: this.vx, y: this.vy });
      const normal: Vec2 = { x: hit.nx, y: hit.ny };
      const reflected = reflect(dir, normal);
      this.vx = reflected.x * LASER.SPEED;
      this.vy = reflected.y * LASER.SPEED;
      this.bounceCount++;
    }

    this.draw();
  }

  private findWallHit(
    x1: number, y1: number, x2: number, y2: number,
    walls: WallSegment[],
  ): HitResult | null {
    const dx = x2 - x1;
    const dy = y2 - y1;
    let closestT = Infinity;
    let result: HitResult | null = null;

    for (const seg of walls) {
      const wx = seg.x2 - seg.x1;
      const wy = seg.y2 - seg.y1;
      const denom = dx * wy - dy * wx;
      if (Math.abs(denom) < 1e-8) continue;

      const t = ((seg.x1 - x1) * wy - (seg.y1 - y1) * wx) / denom;
      const u = ((seg.x1 - x1) * dy - (seg.y1 - y1) * dx) / denom;

      if (t > 0.001 && t < 1 && u >= 0 && u <= 1 && t < closestT) {
        closestT = t;
        result = {
          hitX: x1 + t * dx,
          hitY: y1 + t * dy,
          nx: seg.nx,
          ny: seg.ny,
        };
      }
    }
    return result;
  }

  private draw(): void {
    this.graphics.clear();
    const color = PLAYER_COLORS[this.ownerColorIndex % PLAYER_COLORS.length];

    const dir = normalize({ x: this.vx, y: this.vy });
    const tailX = this.x - dir.x * LASER.LENGTH;
    const tailY = this.y - dir.y * LASER.LENGTH;

    // グロー（外側）
    this.graphics.lineStyle(LASER.WIDTH + 6, color, 0.15);
    this.graphics.beginPath();
    this.graphics.moveTo(tailX, tailY);
    this.graphics.lineTo(this.x, this.y);
    this.graphics.strokePath();

    // 本体
    this.graphics.lineStyle(LASER.WIDTH, color, 1);
    this.graphics.beginPath();
    this.graphics.moveTo(tailX, tailY);
    this.graphics.lineTo(this.x, this.y);
    this.graphics.strokePath();

    // 先端の輝点
    this.graphics.fillStyle(0xffffff, 0.9);
    this.graphics.fillCircle(this.x, this.y, LASER.WIDTH * 0.8);
  }

  destroy(): void {
    if (!this._alive) return;
    this._alive = false;
    this.graphics.destroy();
  }
}
