import Phaser from 'phaser';
import { PLAYER, LASER, PLAYER_COLORS, JOYSTICK, MAP_WIDTH, MAP_HEIGHT, SUB_WEAPON } from '../config';
import { Laser, WallRect, WallSegment } from './Laser';
import { normalize } from '../utils/Vector';

export type SubWeaponType = 'bomb' | 'dash' | 'mud' | 'stone';

export interface TrapData {
  x: number; y: number;
  type: 'mud' | 'stone';
  ownerId: string;
  radius: number;
  graphics: Phaser.GameObjects.Graphics;
}

export interface BombData {
  x: number; y: number;
  ownerId: string;
  graphics: Phaser.GameObjects.Graphics;
  timer: Phaser.Time.TimerEvent;
}

/**
 * プレイヤークラス（ローカルプレイヤー・AIボット兼用）
 */
export class Player {
  readonly id: string;
  readonly colorIndex: number;
  readonly isLocal: boolean;
  name: string;

  x: number;
  y: number;
  private vx = 0;
  private vy = 0;

  private graphics: Phaser.GameObjects.Graphics;
  private labelText: Phaser.GameObjects.Text;

  private _alive = true;
  private invincibleUntil = 0;
  hasBarrier = false;
  private speedMultiplier = 1.0;
  private speedBoostUntil = 0;
  private stunUntil = 0;
  private isDashing = false;
  private dashUntil = 0;

  // 射撃
  private lastFireTime = 0;
  private aimDirX = 1;
  private aimDirY = 0;
  private isFiring = false;

  // サブ装備
  subWeapons: [SubWeaponType, SubWeaponType] = ['bomb', 'dash'];
  subStockA: number;
  subStockB: number;

  // 統計
  kills = 0;
  deaths = 0;

  // ボム投擲の準備中（ドラッグ座標）
  bombTargetX = 0;
  bombTargetY = 0;
  isPreparingBomb = false;

  private scene: Phaser.Scene;

  constructor(
    scene: Phaser.Scene,
    id: string,
    x: number,
    y: number,
    colorIndex: number,
    name: string,
    isLocal: boolean,
    subWeapons: [SubWeaponType, SubWeaponType] = ['bomb', 'dash'],
  ) {
    this.scene = scene;
    this.id = id;
    this.x = x;
    this.y = y;
    this.colorIndex = colorIndex;
    this.name = name;
    this.isLocal = isLocal;
    this.subWeapons = subWeapons;
    this.subStockA = this.getMaxStock(subWeapons[0]);
    this.subStockB = this.getMaxStock(subWeapons[1]);

    this.graphics = scene.add.graphics();
    this.labelText = scene.add.text(x, y - PLAYER.RADIUS - 20, name, {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: `#${PLAYER_COLORS[colorIndex].toString(16).padStart(6, '0')}`,
    }).setOrigin(0.5).setDepth(10);
  }

  get alive(): boolean { return this._alive; }
  get isInvincible(): boolean { return this.scene.time.now < this.invincibleUntil; }
  get currentSpeed(): number {
    const now = this.scene.time.now;
    if (now < this.stunUntil) return 0;
    const mult = now < this.speedBoostUntil ? this.speedMultiplier : 1.0;
    return PLAYER.SPEED * mult;
  }

  /** ローカルプレイヤー用：移動入力（ジョイスティックから正規化済み） */
  setMoveInput(inputX: number, inputY: number): void {
    const len = Math.sqrt(inputX * inputX + inputY * inputY);
    if (len < JOYSTICK.DEADZONE) {
      this.vx = 0; this.vy = 0; return;
    }
    const speed = len >= JOYSTICK.DIGITAL_THRESHOLD ? this.currentSpeed : this.currentSpeed * (len / JOYSTICK.DIGITAL_THRESHOLD);
    const nx = inputX / len;
    const ny = inputY / len;
    this.vx = nx * speed;
    this.vy = ny * speed;
  }

  /** ローカルプレイヤー用：照準入力 */
  setAimInput(aimX: number, aimY: number, firing: boolean): void {
    const len = Math.sqrt(aimX * aimX + aimY * aimY);
    if (len > 0.05) {
      this.aimDirX = aimX / len;
      this.aimDirY = aimY / len;
    }
    this.isFiring = firing;
  }

  /** AIボット用：速度を直接セット */
  setVelocity(vx: number, vy: number): void {
    this.vx = vx;
    this.vy = vy;
  }

  /** AIボット用：照準方向をセット */
  setAimDir(dx: number, dy: number): void {
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0.001) {
      this.aimDirX = dx / len;
      this.aimDirY = dy / len;
    }
  }

  setFiring(v: boolean): void { this.isFiring = v; }

  getAimDir(): { x: number; y: number } {
    return { x: this.aimDirX, y: this.aimDirY };
  }

  /**
   * フレーム更新。生成したレーザーを返す。
   */
  update(delta: number, walls: WallRect[], allWallSegs: WallSegment[]): Laser[] {
    const newLasers: Laser[] = [];
    if (!this._alive) return newLasers;

    const now = this.scene.time.now;

    // ダッシュ終了チェック
    if (this.isDashing && now > this.dashUntil) {
      this.isDashing = false;
      this.vx = 0; this.vy = 0;
    }

    // 移動
    if (!this.isDashing) {
      this.x += this.vx * (delta / 1000);
      this.y += this.vy * (delta / 1000);
    } else {
      // ダッシュ中も壁判定が必要
      const dashSpeed = SUB_WEAPON.DASH.SPEED;
      const dir = normalize({ x: this.aimDirX, y: this.aimDirY });
      this.x += dir.x * dashSpeed * (delta / 1000);
      this.y += dir.y * dashSpeed * (delta / 1000);
    }

    // マップ境界クランプ
    this.x = Math.max(PLAYER.RADIUS, Math.min(MAP_WIDTH - PLAYER.RADIUS, this.x));
    this.y = Math.max(PLAYER.RADIUS, Math.min(MAP_HEIGHT - PLAYER.RADIUS, this.y));

    // 壁との衝突解決
    this.resolveWallCollisions(walls);

    // 射撃
    if (this.isFiring && now - this.lastFireTime >= LASER.FIRE_INTERVAL) {
      this.lastFireTime = now;
      newLasers.push(new Laser(
        this.scene, this.x, this.y,
        this.aimDirX, this.aimDirY,
        this.id, this.colorIndex,
      ));
    }

    this.draw(now);
    return newLasers;

    void allWallSegs; // 現在未使用（将来の拡張用）
  }

  /** ダッシュを実行 */
  doDash(): void {
    if (this.isDashing) return;
    this.isDashing = true;
    const now = this.scene.time.now;
    this.dashUntil = now + SUB_WEAPON.DASH.DISTANCE / SUB_WEAPON.DASH.SPEED * 1000;
    // ダッシュ中は無敵
    this.invincibleUntil = Math.max(this.invincibleUntil, now + SUB_WEAPON.DASH.INVINCIBLE_DURATION);
  }

  /** レーザーに当たったとき。死亡した場合はtrueを返す */
  onHit(): boolean {
    if (!this._alive || this.isInvincible) return false;
    if (this.hasBarrier) {
      this.hasBarrier = false;
      // バリア破砕エフェクト
      this.showBarrierBreak();
      return false;
    }
    this.die();
    return true;
  }

  private showBarrierBreak(): void {
    const g = this.scene.add.graphics();
    g.lineStyle(3, 0xffffff, 1);
    g.strokeCircle(this.x, this.y, PLAYER.RADIUS + 10);
    this.scene.tweens.add({
      targets: g,
      alpha: 0,
      duration: 300,
      onComplete: () => g.destroy(),
    });
  }

  private die(): void {
    this._alive = false;
    this.vx = 0; this.vy = 0;
    this.deaths++;

    // 死亡エフェクト（パーティクル風）
    const color = PLAYER_COLORS[this.colorIndex];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const g = this.scene.add.graphics();
      g.fillStyle(color, 1);
      g.fillCircle(this.x, this.y, 4);
      this.scene.tweens.add({
        targets: g,
        x: g.x + Math.cos(angle) * 40,
        y: g.y + Math.sin(angle) * 40,
        alpha: 0,
        duration: 400,
        ease: 'Power2',
        onComplete: () => g.destroy(),
      });
    }

    this.graphics.clear();
    this.labelText.setVisible(false);
  }

  /** リスポーン */
  respawn(x: number, y: number): void {
    this._alive = true;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.hasBarrier = false;
    this.speedMultiplier = 1;
    this.invincibleUntil = this.scene.time.now + PLAYER.INVINCIBLE_AFTER_RESPAWN;
    this.isDashing = false;
    // サブ装備を全回復
    this.subStockA = this.getMaxStock(this.subWeapons[0]);
    this.subStockB = this.getMaxStock(this.subWeapons[1]);
    this.labelText.setVisible(true);
  }

  applyBarrier(): void { this.hasBarrier = true; }

  applySpeedBoost(multiplier: number, duration: number): void {
    this.speedMultiplier = multiplier;
    this.speedBoostUntil = this.scene.time.now + duration;
  }

  applyStun(duration: number): void {
    this.stunUntil = this.scene.time.now + duration;
  }

  applySlow(rate: number, duration: number): void {
    this.speedMultiplier = rate;
    this.speedBoostUntil = this.scene.time.now + duration;
  }

  private getMaxStock(type: SubWeaponType): number {
    switch (type) {
      case 'bomb':  return SUB_WEAPON.BOMB.MAX_STOCK;
      case 'dash':  return SUB_WEAPON.DASH.MAX_STOCK;
      case 'mud':   return SUB_WEAPON.MUD_TRAP.MAX_STOCK;
      case 'stone': return SUB_WEAPON.STONE_TRAP.MAX_STOCK;
    }
  }

  /** 矩形壁とのAABB（円-矩形）衝突を解決 */
  private resolveWallCollisions(walls: WallRect[]): void {
    for (const wall of walls) {
      // 円の中心から矩形への最近接点
      const nearX = Math.max(wall.x, Math.min(this.x, wall.x + wall.width));
      const nearY = Math.max(wall.y, Math.min(this.y, wall.y + wall.height));
      const dx = this.x - nearX;
      const dy = this.y - nearY;
      const distSq = dx * dx + dy * dy;
      const r = PLAYER.RADIUS;

      if (distSq < r * r && distSq > 0) {
        // 押し出し
        const dist = Math.sqrt(distSq);
        const overlap = r - dist;
        this.x += (dx / dist) * overlap;
        this.y += (dy / dist) * overlap;
      } else if (distSq === 0) {
        // 中心が矩形内部にある場合（最短方向に押し出す）
        const dl = this.x - wall.x;
        const dr = wall.x + wall.width - this.x;
        const dt = this.y - wall.y;
        const db = wall.y + wall.height - this.y;
        const min = Math.min(dl, dr, dt, db);
        if (min === dl)      this.x = wall.x - r;
        else if (min === dr) this.x = wall.x + wall.width + r;
        else if (min === dt) this.y = wall.y - r;
        else                 this.y = wall.y + wall.height + r;
      }
    }
  }

  private draw(now: number): void {
    this.graphics.clear();
    if (!this._alive) return;

    const color = PLAYER_COLORS[this.colorIndex % PLAYER_COLORS.length];

    // 無敵中は点滅
    const blinking = this.isInvincible && Math.floor(now / 100) % 2 === 0;
    if (blinking) {
      this.labelText.setPosition(this.x, this.y - PLAYER.RADIUS - 20);
      return;
    }

    // スピードブースト中のオーラ
    if (now < this.speedBoostUntil && this.speedMultiplier > 1) {
      this.graphics.fillStyle(0xffff00, 0.15);
      this.graphics.fillCircle(this.x, this.y, PLAYER.RADIUS + 8);
    }

    // バリアリング
    if (this.hasBarrier) {
      this.graphics.lineStyle(2, 0xffffff, 0.7 + 0.3 * Math.sin(now / 200));
      this.graphics.strokeCircle(this.x, this.y, PLAYER.RADIUS + 7);
    }

    // ダッシュ中のエフェクト
    if (this.isDashing) {
      this.graphics.fillStyle(color, 0.3);
      this.graphics.fillCircle(this.x, this.y, PLAYER.RADIUS + 4);
    }

    // プレイヤー本体（円）
    this.graphics.fillStyle(color, 1);
    this.graphics.fillCircle(this.x, this.y, PLAYER.RADIUS);

    // 照準インジケーター（小さな矢印）
    const aimX = this.x + this.aimDirX * (PLAYER.RADIUS + 8);
    const aimY = this.y + this.aimDirY * (PLAYER.RADIUS + 8);
    this.graphics.fillStyle(0xffffff, 0.8);
    this.graphics.fillCircle(aimX, aimY, 3);

    // ハイライト
    this.graphics.fillStyle(0xffffff, 0.25);
    this.graphics.fillCircle(this.x - 4, this.y - 4, PLAYER.RADIUS * 0.35);

    // ラベル更新
    this.labelText.setPosition(this.x, this.y - PLAYER.RADIUS - 20);
  }

  destroy(): void {
    this.graphics.destroy();
    this.labelText.destroy();
  }
}
