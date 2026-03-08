import Phaser from 'phaser';
import { Player } from '../objects/Player';
import { Laser, WallSegment } from '../objects/Laser';
import {
  GAME_WIDTH, GAME_HEIGHT, MAP_WIDTH, MAP_HEIGHT,
  MATCH, PLAYER, JOYSTICK, LASER,
} from '../config';
import { distanceSq, lineCircleIntersects } from '../utils/Vector';

interface GameSceneData {
  mode: 'solo' | 'multiplayer';
}

/**
 * GameScene: メインゲームプレイシーン
 * Phase 1はソロ（ローカル）動作、Phase 2でPhoton連携を追加
 */
export class GameScene extends Phaser.Scene {
  private players: Player[] = [];
  private lasers: Laser[] = [];
  private walls: WallSegment[] = [];
  private localPlayer!: Player;

  // バーチャルジョイスティック
  private moveJoystick!: VirtualJoystick;
  private aimJoystick!: VirtualJoystick;

  // HUD
  private timerText!: Phaser.GameObjects.Text;
  private scoreTexts: Phaser.GameObjects.Text[] = [];
  private minimapGraphics!: Phaser.GameObjects.Graphics;

  private matchStartTime = 0;
  private gameMode: 'solo' | 'multiplayer' = 'solo';

  constructor() {
    super({ key: 'GameScene' });
  }

  create(data: GameSceneData): void {
    this.gameMode = data.mode;

    // カメラのワールドバウンドを設定
    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // マップを構築
    this.buildMap();

    // ローカルプレイヤーを生成
    this.localPlayer = new Player(
      this, 'local', 400, 300, 0, 'YOU', true,
    );
    this.players.push(this.localPlayer);

    // カメラがプレイヤーを追従
    this.cameras.main.startFollow(
      { x: this.localPlayer.x, y: this.localPlayer.y } as Phaser.GameObjects.GameObject,
    );

    // バーチャルジョイスティックを設定
    this.setupVirtualJoysticks();

    // HUDを設定（カメラに追従しないよう固定）
    this.setupHUD();

    // 試合開始時刻を記録
    this.matchStartTime = this.time.now;
  }

  update(_time: number, delta: number): void {
    // バーチャルジョイスティックの入力を取得
    const moveInput = this.moveJoystick.getInput();
    const aimInput = this.aimJoystick.getInput();

    this.localPlayer.setMoveInput(moveInput.x, moveInput.y);
    this.localPlayer.setAimInput(aimInput.x, aimInput.y, this.aimJoystick.isActive());

    // 全プレイヤーを更新
    for (const player of this.players) {
      const newLasers = player.update(delta, this.walls);
      this.lasers.push(...newLasers);
    }

    // カメラをプレイヤー位置に追従させる（手動制御）
    this.cameras.main.scrollX = this.localPlayer.x - GAME_WIDTH / 2;
    this.cameras.main.scrollY = this.localPlayer.y - GAME_HEIGHT / 2;

    // レーザーを更新
    for (const laser of this.lasers) {
      laser.update(delta, this.walls);
    }

    // 当たり判定（レーザー vs プレイヤー）
    this.checkLaserHits();

    // 死んだレーザーを除去
    this.lasers = this.lasers.filter(l => l.isAlive);

    // HUDを更新
    this.updateHUD();

    // 試合終了チェック
    const elapsed = this.time.now - this.matchStartTime;
    if (elapsed >= MATCH.DURATION) {
      this.endMatch();
    }
  }

  private buildMap(): void {
    const graphics = this.add.graphics();

    // マップ背景
    graphics.fillStyle(0x000820, 1);
    graphics.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // グリッド
    graphics.lineStyle(1, 0x001133, 0.8);
    const gridSize = 80;
    for (let x = 0; x <= MAP_WIDTH; x += gridSize) {
      graphics.moveTo(x, 0).lineTo(x, MAP_HEIGHT);
    }
    for (let y = 0; y <= MAP_HEIGHT; y += gridSize) {
      graphics.moveTo(0, y).lineTo(MAP_WIDTH, y);
    }
    graphics.strokePath();

    // 外壁
    this.addWall(graphics, 0, 0, MAP_WIDTH, 20);          // 上
    this.addWall(graphics, 0, MAP_HEIGHT - 20, MAP_WIDTH, 20);  // 下
    this.addWall(graphics, 0, 0, 20, MAP_HEIGHT);          // 左
    this.addWall(graphics, MAP_WIDTH - 20, 0, 20, MAP_HEIGHT);  // 右

    // 内部の障害物（サンプルマップ）
    this.addWall(graphics, 300, 200, 100, 200);
    this.addWall(graphics, 800, 400, 200, 100);
    this.addWall(graphics, 500, 700, 100, 300);
    this.addWall(graphics, 1100, 200, 100, 200);
    this.addWall(graphics, 1200, 700, 200, 100);
  }

  /** 壁を追加し、当たり判定用のセグメントを登録 */
  private addWall(
    graphics: Phaser.GameObjects.Graphics,
    x: number, y: number, w: number, h: number,
  ): void {
    graphics.fillStyle(0x224466, 1);
    graphics.lineStyle(2, 0x4488bb, 1);
    graphics.fillRect(x, y, w, h);
    graphics.strokeRect(x, y, w, h);

    // 4辺の線分セグメントを壁として登録
    // 上辺: 法線は下向き (0, -1)
    this.walls.push({ x1: x, y1: y, x2: x + w, y2: y, normalX: 0, normalY: -1 });
    // 下辺: 法線は上向き (0, 1)
    this.walls.push({ x1: x, y1: y + h, x2: x + w, y2: y + h, normalX: 0, normalY: 1 });
    // 左辺: 法線は右向き (-1, 0)
    this.walls.push({ x1: x, y1: y, x2: x, y2: y + h, normalX: -1, normalY: 0 });
    // 右辺: 法線は左向き (1, 0)
    this.walls.push({ x1: x + w, y1: y, x2: x + w, y2: y + h, normalX: 1, normalY: 0 });
  }

  private setupVirtualJoysticks(): void {
    // 左側：移動ジョイスティック
    this.moveJoystick = new VirtualJoystick(
      this,
      JOYSTICK.RADIUS * 2,
      GAME_HEIGHT - JOYSTICK.RADIUS * 2,
      JOYSTICK.RADIUS,
      0x333333,
      0x00ffcc,
    );

    // 右側：照準ジョイスティック
    this.aimJoystick = new VirtualJoystick(
      this,
      GAME_WIDTH - JOYSTICK.RADIUS * 2,
      GAME_HEIGHT - JOYSTICK.RADIUS * 2,
      JOYSTICK.RADIUS,
      0x333333,
      0xff4466,
    );
  }

  private setupHUD(): void {
    // カメラに追従しないUIカメラを使用
    const uiCamera = this.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT);
    uiCamera.setScroll(0, 0);

    // タイマー（上部中央）
    this.timerText = this.add.text(GAME_WIDTH / 2, 20, '2:00', {
      fontSize: '28px',
      fontFamily: 'monospace',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0).setScrollFactor(0);

    // ミニマップ（右上）
    this.minimapGraphics = this.add.graphics().setScrollFactor(0);
  }

  private updateHUD(): void {
    // タイマー更新
    const remaining = Math.max(0, MATCH.DURATION - (this.time.now - this.matchStartTime));
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    this.timerText.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`);

    // ミニマップ更新
    this.updateMinimap();
  }

  private updateMinimap(): void {
    const mm = this.minimapGraphics;
    mm.clear();

    const mmX = GAME_WIDTH - 110, mmY = 10;
    const mmW = 100, mmH = 75;
    const scaleX = mmW / MAP_WIDTH;
    const scaleY = mmH / MAP_HEIGHT;

    // ミニマップ背景
    mm.fillStyle(0x000000, 0.6);
    mm.fillRect(mmX, mmY, mmW, mmH);
    mm.lineStyle(1, 0x336655, 1);
    mm.strokeRect(mmX, mmY, mmW, mmH);

    // プレイヤーを点で表示
    for (const player of this.players) {
      if (!player.isAlive) continue;
      const px = mmX + player.x * scaleX;
      const py = mmY + player.y * scaleY;
      mm.fillStyle(player.isLocal ? 0x00ffcc : 0xff4466, 1);
      mm.fillCircle(px, py, 3);
    }
  }

  private checkLaserHits(): void {
    for (const laser of this.lasers) {
      if (!laser.isAlive) continue;

      for (const player of this.players) {
        if (!player.isAlive) continue;

        // フレンドリーファイア: 自分のレーザーでも当たる（反射後のみ）
        // 仕様上、自分のレーザーでも当たるため owner チェックは省略

        // 線分（レーザーの軌跡）と円（プレイヤー）の交差判定
        const tailX = laser.x - laser.x; // TODO: 実際の軌跡を使う
        const tailY = laser.y - laser.y;

        // 簡易判定: 中心との距離でチェック
        const dSq = distanceSq({ x: laser.x, y: laser.y }, { x: player.x, y: player.y });
        if (dSq < PLAYER.HITBOX_RADIUS * PLAYER.HITBOX_RADIUS) {
          const killed = player.onHit(laser);
          laser.destroy();
          if (killed) {
            // キルスコアを加算（キラーを探す）
            const killer = this.players.find(p => p.id === laser.ownerId);
            if (killer && killer !== player) {
              killer.kills++;
            }

            // リスポーン処理
            const respawnPoint = MATCH.RESPAWN_POINTS[
              Math.floor(Math.random() * MATCH.RESPAWN_POINTS.length)
            ];
            this.time.delayedCall(PLAYER.RESPAWN_DELAY, () => {
              player.respawn(respawnPoint.x, respawnPoint.y);
            });
          }
        }
      }
    }
  }

  private endMatch(): void {
    const scores = this.players.map((p, i) => ({
      playerId: p.id,
      name: `Player${i + 1}`,
      kills: p.kills,
      deaths: p.deaths,
      rank: 0,
    })).sort((a, b) => b.kills - a.kills)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    this.scene.start('ResultScene', {
      scores,
      myPlayerId: this.localPlayer.id,
    });
  }
}

/**
 * シンプルなバーチャルジョイスティック実装
 * phaser3-rex-plugins の VirtualJoystick の代替（依存を減らすため）
 */
class VirtualJoystick {
  private scene: Phaser.Scene;
  private baseX: number;
  private baseY: number;
  private radius: number;
  private graphics: Phaser.GameObjects.Graphics;
  private pointerId: number | null = null;
  private thumbX = 0;
  private thumbY = 0;
  private active = false;

  constructor(
    scene: Phaser.Scene,
    x: number, y: number,
    radius: number,
    baseColor: number,
    thumbColor: number,
  ) {
    this.scene = scene;
    this.baseX = x;
    this.baseY = y;
    this.radius = radius;

    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(10);
    this.draw(baseColor, thumbColor);

    // タッチイベントを設定
    scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.pointerId !== null) return;

      const distToCenter = Math.sqrt(
        (pointer.x - x) ** 2 + (pointer.y - y) ** 2,
      );
      if (distToCenter <= radius * 1.5) {
        this.pointerId = pointer.id;
        this.active = true;
        this.updateThumb(pointer.x, pointer.y, baseColor, thumbColor);
      }
    });

    scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id !== this.pointerId) return;
      this.updateThumb(pointer.x, pointer.y, baseColor, thumbColor);
    });

    scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.id !== this.pointerId) return;
      this.pointerId = null;
      this.active = false;
      this.thumbX = 0;
      this.thumbY = 0;
      this.draw(baseColor, thumbColor);
    });
  }

  private updateThumb(px: number, py: number, baseColor: number, thumbColor: number): void {
    const dx = px - this.baseX;
    const dy = py - this.baseY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, this.radius);

    if (dist > 0) {
      this.thumbX = (dx / dist) * clampedDist;
      this.thumbY = (dy / dist) * clampedDist;
    }

    this.draw(baseColor, thumbColor);
  }

  private draw(baseColor: number, thumbColor: number): void {
    this.graphics.clear();

    // ベース円
    this.graphics.fillStyle(baseColor, 0.3);
    this.graphics.fillCircle(this.baseX, this.baseY, this.radius);
    this.graphics.lineStyle(2, baseColor, 0.6);
    this.graphics.strokeCircle(this.baseX, this.baseY, this.radius);

    // サム（親指）
    this.graphics.fillStyle(thumbColor, 0.7);
    this.graphics.fillCircle(
      this.baseX + this.thumbX,
      this.baseY + this.thumbY,
      this.radius * 0.4,
    );
  }

  getInput(): { x: number; y: number } {
    return {
      x: this.thumbX / this.radius,
      y: this.thumbY / this.radius,
    };
  }

  isActive(): boolean {
    return this.active;
  }
}
