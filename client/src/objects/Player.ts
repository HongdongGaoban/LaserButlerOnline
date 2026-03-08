import Phaser from 'phaser';
import { PLAYER, LASER, PLAYER_COLORS, JOYSTICK } from '../config';
import { Laser, WallSegment } from './Laser';
import { normalize } from '../utils/Vector';

export type SubWeaponType = 'bomb' | 'dash' | 'mud' | 'stone';

interface PlayerState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hasBarrier: boolean;
  speedMultiplier: number;
}

/**
 * プレイヤークラス
 * ローカルプレイヤーとリモートプレイヤーを兼用（isLocal フラグで切り替え）
 */
export class Player {
  readonly id: string;
  readonly colorIndex: number;
  readonly isLocal: boolean;

  x: number;
  y: number;
  private vx = 0;
  private vy = 0;

  private graphics: Phaser.GameObjects.Graphics;
  private nameText: Phaser.GameObjects.Text;
  private hpText: Phaser.GameObjects.Text;

  private alive = true;
  private invincible = false;
  private invincibleUntil = 0;
  private hasBarrier = false;
  private speedMultiplier = 1.0;
  private speedBoostUntil = 0;

  // 射撃
  private lastFireTime = 0;
  private firingDirection = { x: 0, y: 0 };
  private isFiring = false;

  // サブ装備
  subWeapons: [SubWeaponType, SubWeaponType] = ['bomb', 'dash'];

  // 統計
  kills = 0;
  deaths = 0;

  private scene: Phaser.Scene;
  private lasers: Laser[] = [];

  constructor(
    scene: Phaser.Scene,
    id: string,
    x: number,
    y: number,
    colorIndex: number,
    name: string,
    isLocal: boolean,
  ) {
    this.scene = scene;
    this.id = id;
    this.x = x;
    this.y = y;
    this.colorIndex = colorIndex;
    this.isLocal = isLocal;

    this.graphics = scene.add.graphics();

    // 名前表示
    this.nameText = scene.add.text(x, y - PLAYER.RADIUS - 20, name, {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: `#${PLAYER_COLORS[colorIndex].toString(16).padStart(6, '0')}`,
    }).setOrigin(0.5);

    // HP表示（残機）
    this.hpText = scene.add.text(x, y - PLAYER.RADIUS - 6, '●', {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#00ff00',
    }).setOrigin(0.5);
  }

  get isAlive(): boolean {
    return this.alive;
  }

  /** 移動入力を設定（バーチャルジョイスティックから） */
  setMoveInput(inputX: number, inputY: number): void {
    if (!this.isLocal) return;

    const len = Math.sqrt(inputX * inputX + inputY * inputY);
    if (len < JOYSTICK.DEADZONE) {
      this.vx = 0;
      this.vy = 0;
      return;
    }

    // デジタル補正: 閾値以上なら最大速度
    const speed = len >= JOYSTICK.DIGITAL_THRESHOLD
      ? PLAYER.SPEED * this.speedMultiplier
      : PLAYER.SPEED * this.speedMultiplier * (len / JOYSTICK.DIGITAL_THRESHOLD);

    const nx = inputX / len;
    const ny = inputY / len;
    this.vx = nx * speed;
    this.vy = ny * speed;
  }

  /** 照準方向を設定（右バーチャルジョイスティックから） */
  setAimInput(aimX: number, aimY: number, firing: boolean): void {
    if (!this.isLocal) return;
    const len = Math.sqrt(aimX * aimX + aimY * aimY);
    if (len > 0.1) {
      this.firingDirection = normalize({ x: aimX, y: aimY });
    }
    this.isFiring = firing;
  }

  update(delta: number, walls: WallSegment[]): Laser[] {
    const newLasers: Laser[] = [];

    if (!this.alive) {
      return newLasers;
    }

    const now = this.scene.time.now;

    // 無敵時間終了チェック
    if (this.invincible && now > this.invincibleUntil) {
      this.invincible = false;
    }

    // スピードブースト終了チェック
    if (this.speedMultiplier > 1 && now > this.speedBoostUntil) {
      this.speedMultiplier = 1;
    }

    // 移動（ローカルのみ、リモートは補間で動かす）
    if (this.isLocal) {
      this.x += this.vx * (delta / 1000);
      this.y += this.vy * (delta / 1000);

      // TODO: 壁との衝突処理
    }

    // 射撃
    if (this.isLocal && this.isFiring) {
      if (now - this.lastFireTime >= LASER.FIRE_INTERVAL) {
        this.lastFireTime = now;
        const laser = new Laser(
          this.scene,
          this.x,
          this.y,
          this.firingDirection.x,
          this.firingDirection.y,
          this.id,
          this.colorIndex,
        );
        newLasers.push(laser);
      }
    }

    this.draw(now);
    return newLasers;
  }

  /** リモートプレイヤーの状態を同期 */
  applyRemoteState(state: PlayerState): void {
    if (this.isLocal) return;
    // 線形補間で滑らかに移動
    this.x += (state.x - this.x) * 0.3;
    this.y += (state.y - this.y) * 0.3;
    this.hasBarrier = state.hasBarrier;
  }

  /** レーザーに当たったとき */
  onHit(laser: Laser): boolean {
    if (!this.alive || this.invincible) return false;

    if (this.hasBarrier) {
      this.hasBarrier = false;
      return false;  // バリアが防いだ
    }

    this.die();
    return true;
  }

  private die(): void {
    this.alive = false;
    this.vx = 0;
    this.vy = 0;
    this.deaths++;
    this.graphics.clear();
    // TODO: 死亡エフェクト（爆発パーティクル）
  }

  /** リスポーン */
  respawn(x: number, y: number): void {
    this.alive = true;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.hasBarrier = false;
    this.speedMultiplier = 1;
    this.invincible = true;
    this.invincibleUntil = this.scene.time.now + 2000;  // 2秒間の無敵
  }

  applyBarrier(): void {
    this.hasBarrier = true;
  }

  applySpeedBoost(multiplier: number, duration: number): void {
    this.speedMultiplier = multiplier;
    this.speedBoostUntil = this.scene.time.now + duration;
  }

  applyStun(duration: number): void {
    const prevVx = this.vx;
    const prevVy = this.vy;
    this.vx = 0;
    this.vy = 0;
    this.scene.time.delayedCall(duration, () => {
      this.vx = prevVx;
      this.vy = prevVy;
    });
  }

  applySlow(rate: number, duration: number): void {
    this.speedMultiplier = rate;
    this.speedBoostUntil = this.scene.time.now + duration;
  }

  private draw(now: number): void {
    this.graphics.clear();

    const color = PLAYER_COLORS[this.colorIndex % PLAYER_COLORS.length];

    // 無敵中は点滅
    if (this.invincible && Math.floor(now / 100) % 2 === 0) {
      // 点滅のため描画スキップ
    } else {
      // バリアエフェクト（外側リング）
      if (this.hasBarrier) {
        this.graphics.lineStyle(2, 0xffffff, 0.6);
        this.graphics.strokeCircle(this.x, this.y, PLAYER.RADIUS + 6);
      }

      // プレイヤー本体
      this.graphics.fillStyle(color, 1);
      this.graphics.fillCircle(this.x, this.y, PLAYER.RADIUS);

      // 内側の明るいハイライト
      this.graphics.fillStyle(0xffffff, 0.3);
      this.graphics.fillCircle(this.x - 4, this.y - 4, PLAYER.RADIUS * 0.4);

      // 当たり判定の可視化（デバッグ用）
      // this.graphics.lineStyle(1, 0xff0000, 0.5);
      // this.graphics.strokeCircle(this.x, this.y, PLAYER.HITBOX_RADIUS);
    }

    // テキスト位置を更新
    this.nameText.setPosition(this.x, this.y - PLAYER.RADIUS - 20);
    this.hpText.setPosition(this.x, this.y - PLAYER.RADIUS - 6);
  }

  destroy(): void {
    this.graphics.destroy();
    this.nameText.destroy();
    this.hpText.destroy();
  }
}
