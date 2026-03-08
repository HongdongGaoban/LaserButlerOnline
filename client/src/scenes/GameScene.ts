import Phaser from 'phaser';
import { Player, TrapData, BombData } from '../objects/Player';
import { Laser, WallRect, WallSegment, rectToSegments } from '../objects/Laser';
import {
  GAME_WIDTH, GAME_HEIGHT, MAP_WIDTH, MAP_HEIGHT,
  MATCH, PLAYER, PLAYER_COLORS, JOYSTICK, SUB_WEAPON, FIELD_ITEM,
} from '../config';
import { lineCircleIntersects } from '../utils/Vector';

export interface GameSceneData {
  mode: 'solo' | 'multiplayer';
}

// ===================== サブウィジェット: バーチャルジョイスティック =====================
class VirtualJoystick {
  private baseX: number;
  private baseY: number;
  readonly radius: number;
  private thumbX = 0;
  private thumbY = 0;
  private pointerId: number | null = null;
  private _active = false;
  private graphics: Phaser.GameObjects.Graphics;
  private readonly baseColor: number;
  private readonly thumbColor: number;

  constructor(
    scene: Phaser.Scene,
    x: number, y: number, radius: number,
    baseColor: number, thumbColor: number,
  ) {
    this.baseX = x; this.baseY = y;
    this.radius = radius;
    this.baseColor = baseColor; this.thumbColor = thumbColor;

    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(20);
    this.redraw();

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.pointerId !== null) return;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= radius * 1.8) {
        this.pointerId = p.id; this._active = true;
        this.update(p.x, p.y);
      }
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.pointerId) return;
      this.update(p.x, p.y);
    });
    scene.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.id !== this.pointerId) return;
      this.pointerId = null; this._active = false;
      this.thumbX = 0; this.thumbY = 0;
      this.redraw();
    });
  }

  private update(px: number, py: number): void {
    const dx = px - this.baseX;
    const dy = py - this.baseY;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, this.radius);
    this.thumbX = dist > 0 ? (dx / dist) * clamped : 0;
    this.thumbY = dist > 0 ? (dy / dist) * clamped : 0;
    this.redraw();
  }

  private redraw(): void {
    this.graphics.clear();
    // ベース
    this.graphics.fillStyle(this.baseColor, 0.2);
    this.graphics.fillCircle(this.baseX, this.baseY, this.radius);
    this.graphics.lineStyle(2, this.baseColor, 0.5);
    this.graphics.strokeCircle(this.baseX, this.baseY, this.radius);
    // サム
    this.graphics.fillStyle(this.thumbColor, 0.8);
    this.graphics.fillCircle(this.baseX + this.thumbX, this.baseY + this.thumbY, this.radius * 0.38);
  }

  getInput(): { x: number; y: number } {
    return { x: this.thumbX / this.radius, y: this.thumbY / this.radius };
  }
  isActive(): boolean { return this._active; }
  destroy(): void { this.graphics.destroy(); }
}

// ===================== ゲームシーン本体 =====================
export class GameScene extends Phaser.Scene {
  // ゲームオブジェクト
  private players: Player[] = [];
  private localPlayer!: Player;
  private lasers: Laser[] = [];
  private traps: TrapData[] = [];
  private bombs: BombData[] = [];

  // マップ
  private wallRects: WallRect[] = [];
  private wallSegs: WallSegment[] = [];
  private mapGraphics!: Phaser.GameObjects.Graphics;

  // 入力
  private moveJoy!: VirtualJoystick;
  private aimJoy!: VirtualJoystick;

  // HUD（scrollFactor=0）
  private timerText!: Phaser.GameObjects.Text;
  private scoreContainer!: Phaser.GameObjects.Container;
  private minimapGfx!: Phaser.GameObjects.Graphics;
  private subBtnAGfx!: Phaser.GameObjects.Graphics;
  private subBtnBGfx!: Phaser.GameObjects.Graphics;
  private subBtnAText!: Phaser.GameObjects.Text;
  private subBtnBText!: Phaser.GameObjects.Text;
  // 試合
  private matchStartTime = 0;
  private matchEnded = false;

  // AIボット用
  private botTimers: Map<string, number> = new Map();
  private botTargetX: Map<string, number> = new Map();
  private botTargetY: Map<string, number> = new Map();

  // フィールドアイテム
  private fieldItems: Array<{
    x: number; y: number; type: 'barrier' | 'speed';
    graphics: Phaser.GameObjects.Graphics;
  }> = [];
  private nextItemSpawn = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(data: GameSceneData): void {
    void (data?.mode); // 将来のマルチプレイ実装時に使用
    this.players = [];
    this.lasers = [];
    this.traps = [];
    this.bombs = [];
    this.fieldItems = [];
    this.wallRects = [];
    this.wallSegs = [];
    this.matchEnded = false;
    this.botTimers.clear();
    this.botTargetX.clear();
    this.botTargetY.clear();

    this.cameras.main.setBounds(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // 1. マップ構築
    this.buildMap();

    // 2. プレイヤー生成
    this.localPlayer = new Player(
      this, 'local', MATCH.RESPAWN_POINTS[0].x, MATCH.RESPAWN_POINTS[0].y,
      0, 'YOU', true, ['bomb', 'dash'],
    );
    this.players.push(this.localPlayer);

    // AIボット（3体）
    const botNames = ['BOT-R', 'BOT-Y', 'BOT-G'];
    const botSubs: Array<['bomb' | 'dash' | 'mud' | 'stone', 'bomb' | 'dash' | 'mud' | 'stone']> = [
      ['dash', 'mud'], ['bomb', 'stone'], ['mud', 'dash'],
    ];
    for (let i = 0; i < 3; i++) {
      const pt = MATCH.RESPAWN_POINTS[i + 1];
      const bot = new Player(this, `bot${i}`, pt.x, pt.y, i + 1, botNames[i], false, botSubs[i]);
      this.players.push(bot);
    }

    // 3. バーチャルジョイスティック
    this.moveJoy = new VirtualJoystick(
      this,
      JOYSTICK.RADIUS * 2 + 10, GAME_HEIGHT - JOYSTICK.RADIUS - 15,
      JOYSTICK.RADIUS, 0x334455, 0x00ffcc,
    );
    this.aimJoy = new VirtualJoystick(
      this,
      GAME_WIDTH - JOYSTICK.RADIUS * 2 - 10, GAME_HEIGHT - JOYSTICK.RADIUS - 15,
      JOYSTICK.RADIUS, 0x334455, 0xff4466,
    );

    // 4. HUDセットアップ
    this.setupHUD();

    // 5. サブウェポンボタン
    this.setupSubButtons();

    // 6. ボム投擲プレビュー
    // 将来のボム投擲プレビュー用（Phase 2）
    this.add.graphics().setScrollFactor(0).setDepth(25).setVisible(false);

    // 7. カメラ初期位置
    this.cameras.main.scrollX = this.localPlayer.x - GAME_WIDTH / 2;
    this.cameras.main.scrollY = this.localPlayer.y - GAME_HEIGHT / 2;

    this.matchStartTime = this.time.now;
    this.nextItemSpawn = this.time.now + FIELD_ITEM.SPAWN_INTERVAL;
  }

  // ── マップ構築 ──────────────────────────────────────────────────
  private buildMap(): void {
    this.mapGraphics = this.add.graphics();

    // 背景
    this.mapGraphics.fillStyle(0x000820, 1);
    this.mapGraphics.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    // グリッド
    this.mapGraphics.lineStyle(1, 0x001133, 0.6);
    const gs = 80;
    for (let x = 0; x <= MAP_WIDTH; x += gs) {
      this.mapGraphics.moveTo(x, 0).lineTo(x, MAP_HEIGHT);
    }
    for (let y = 0; y <= MAP_HEIGHT; y += gs) {
      this.mapGraphics.moveTo(0, y).lineTo(MAP_WIDTH, y);
    }
    this.mapGraphics.strokePath();

    // 外壁
    this.addWall(0, 0, MAP_WIDTH, 20);
    this.addWall(0, MAP_HEIGHT - 20, MAP_WIDTH, 20);
    this.addWall(0, 0, 20, MAP_HEIGHT);
    this.addWall(MAP_WIDTH - 20, 0, 20, MAP_HEIGHT);

    // 内部障害物（対称配置）
    const cx = MAP_WIDTH / 2, cy = MAP_HEIGHT / 2;
    // 中央十字
    this.addWall(cx - 100, cy - 20, 200, 40);
    this.addWall(cx - 20, cy - 100, 40, 200);
    // 四隅の柱（対称）
    this.addWall(200, 160, 80, 80);
    this.addWall(MAP_WIDTH - 280, 160, 80, 80);
    this.addWall(200, MAP_HEIGHT - 240, 80, 80);
    this.addWall(MAP_WIDTH - 280, MAP_HEIGHT - 240, 80, 80);
    // 中間の横壁
    this.addWall(360, cy - 70, 120, 20);
    this.addWall(cx + 120, cy - 70, 120, 20);
    this.addWall(360, cy + 50, 120, 20);
    this.addWall(cx + 120, cy + 50, 120, 20);
    // 上下の縦壁
    this.addWall(cx - 200, 160, 20, 120);
    this.addWall(cx + 180, 160, 20, 120);
    this.addWall(cx - 200, MAP_HEIGHT - 280, 20, 120);
    this.addWall(cx + 180, MAP_HEIGHT - 280, 20, 120);
  }

  private addWall(x: number, y: number, w: number, h: number): void {
    const rect: WallRect = { x, y, width: w, height: h };
    this.wallRects.push(rect);
    this.wallSegs.push(...rectToSegments(rect));

    this.mapGraphics.fillStyle(0x1a3a5c, 1);
    this.mapGraphics.fillRect(x, y, w, h);
    this.mapGraphics.lineStyle(2, 0x3a7aaa, 1);
    this.mapGraphics.strokeRect(x, y, w, h);

    // 反射ハイライト（壁に光沢感）
    this.mapGraphics.lineStyle(1, 0x5abcee, 0.3);
    this.mapGraphics.moveTo(x, y).lineTo(x + w, y);
    this.mapGraphics.strokePath();
  }

  // ── HUDセットアップ ─────────────────────────────────────────────
  private setupHUD(): void {
    // タイマー
    this.timerText = this.add.text(GAME_WIDTH / 2, 12, '2:00', {
      fontSize: '26px', fontFamily: 'monospace',
      color: '#ffffff', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(30);

    // スコアボード（左上）
    this.scoreContainer = this.add.container(10, 10).setScrollFactor(0).setDepth(30);
    this.refreshScoreUI();

    // ミニマップ
    this.minimapGfx = this.add.graphics().setScrollFactor(0).setDepth(30);
  }

  private setupSubButtons(): void {
    // サブボタンA（左）
    this.subBtnAGfx = this.add.graphics().setScrollFactor(0).setDepth(25);
    this.subBtnAText = this.add.text(0, 0, '', {
      fontSize: '10px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(26);

    // サブボタンB（右）
    this.subBtnBGfx = this.add.graphics().setScrollFactor(0).setDepth(25);
    this.subBtnBText = this.add.text(0, 0, '', {
      fontSize: '10px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(26);

    this.drawSubButtons();

    // ボタンタップ検出
    const aimX = GAME_WIDTH - JOYSTICK.RADIUS * 2 - 10;
    const aimY = GAME_HEIGHT - JOYSTICK.RADIUS - 15;
    const btnAX = aimX - 50, btnY = aimY - JOYSTICK.RADIUS - 20;
    const btnBX = aimX + 10;

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.localPlayer.alive) return;

      // ボタンA
      if (Math.hypot(p.x - btnAX, p.y - btnY) < 28) {
        this.useSubWeaponA();
      }
      // ボタンB
      if (Math.hypot(p.x - btnBX, p.y - btnY) < 28) {
        this.useSubWeaponB();
      }
    });
  }

  private drawSubButtons(): void {
    const aimX = GAME_WIDTH - JOYSTICK.RADIUS * 2 - 10;
    const aimY = GAME_HEIGHT - JOYSTICK.RADIUS - 15;
    const btnAX = aimX - 50, btnBX = aimX + 10;
    const btnY = aimY - JOYSTICK.RADIUS - 20;
    const r = 24;

    const subA = this.localPlayer?.subWeapons[0] ?? 'bomb';
    const subB = this.localPlayer?.subWeapons[1] ?? 'dash';
    const stockA = this.localPlayer?.subStockA ?? 0;
    const stockB = this.localPlayer?.subStockB ?? 0;

    this.subBtnAGfx.clear();
    this.subBtnBGfx.clear();

    const drawBtn = (g: Phaser.GameObjects.Graphics, bx: number, by: number, stock: number, color: number) => {
      g.fillStyle(0x001122, 0.8);
      g.fillCircle(bx, by, r);
      g.lineStyle(2, stock > 0 ? color : 0x444444, 1);
      g.strokeCircle(bx, by, r);
      if (stock > 0) {
        g.fillStyle(color, 0.3);
        g.fillCircle(bx, by, r - 3);
      }
      // ストック数
      g.fillStyle(stock > 0 ? color : 0x555555, 1);
      for (let i = 0; i < Math.max(stock, 0); i++) {
        g.fillCircle(bx - 8 + i * 8, by + r - 6, 3);
      }
    };

    drawBtn(this.subBtnAGfx, btnAX, btnY, stockA, 0xffaa00);
    drawBtn(this.subBtnBGfx, btnBX, btnY, stockB, 0x44aaff);

    this.subBtnAText.setPosition(btnAX, btnY).setText(this.subIcon(subA));
    this.subBtnBText.setPosition(btnBX, btnY).setText(this.subIcon(subB));
  }

  private subIcon(type: string): string {
    switch (type) {
      case 'bomb':  return '💣';
      case 'dash':  return '⚡';
      case 'mud':   return '🟤';
      case 'stone': return '⬛';
      default:      return '?';
    }
  }

  // ── サブ装備使用 ─────────────────────────────────────────────────
  private useSubWeaponA(): void {
    if (this.localPlayer.subStockA <= 0) return;
    this.activateSubWeapon(this.localPlayer, this.localPlayer.subWeapons[0], 'A');
  }
  private useSubWeaponB(): void {
    if (this.localPlayer.subStockB <= 0) return;
    this.activateSubWeapon(this.localPlayer, this.localPlayer.subWeapons[1], 'B');
  }

  private activateSubWeapon(player: Player, type: string, slot: 'A' | 'B'): void {
    if (!player.alive) return;

    switch (type) {
      case 'bomb':
        this.throwBomb(player);
        break;
      case 'dash':
        player.doDash();
        break;
      case 'mud':
        this.placeTrap(player, 'mud');
        break;
      case 'stone':
        this.placeTrap(player, 'stone');
        break;
    }

    if (slot === 'A') player.subStockA--;
    else player.subStockB--;
    this.drawSubButtons();
  }

  private throwBomb(player: Player): void {
    // 照準方向に一定距離投擲
    const aim = player.getAimDir();
    const dist = 180;
    const bx = player.x + aim.x * dist;
    const by = player.y + aim.y * dist;
    const clampedBx = Math.max(40, Math.min(MAP_WIDTH - 40, bx));
    const clampedBy = Math.max(40, Math.min(MAP_HEIGHT - 40, by));

    const g = this.add.graphics();
    this.drawBombGraphic(g, clampedBx, clampedBy, 1);

    // カウントダウンアニメーション
    this.tweens.add({
      targets: {},
      duration: SUB_WEAPON.BOMB.FUSE_TIME,
      onUpdate: (_tween: Phaser.Tweens.Tween, _obj: unknown, progress: number) => {
        this.drawBombGraphic(g, clampedBx, clampedBy, 1 - progress);
      },
    });

    const timer = this.time.delayedCall(SUB_WEAPON.BOMB.FUSE_TIME, () => {
      this.explodeBomb(player.id, clampedBx, clampedBy);
      g.destroy();
      const idx = this.bombs.findIndex(b => b.timer === timer);
      if (idx >= 0) this.bombs.splice(idx, 1);
    });

    this.bombs.push({ x: clampedBx, y: clampedBy, ownerId: player.id, graphics: g, timer });
  }

  private drawBombGraphic(g: Phaser.GameObjects.Graphics, x: number, y: number, fuseRatio: number): void {
    g.clear();
    // 本体
    g.fillStyle(0x222222, 1);
    g.fillCircle(x, y, 12);
    g.lineStyle(2, 0xff4400, 1);
    g.strokeCircle(x, y, 12);
    // 導火線（残り時間を示す）
    g.lineStyle(3, 0xff8800, 1);
    g.beginPath();
    g.moveTo(x, y - 12);
    g.lineTo(x, y - 12 - 16 * fuseRatio);
    g.strokePath();
    // 爆発予告円
    g.lineStyle(1, 0xff4400, 0.3);
    g.strokeCircle(x, y, SUB_WEAPON.BOMB.RADIUS);
  }

  private explodeBomb(ownerId: string, bx: number, by: number): void {
    // 爆発エフェクト
    const g = this.add.graphics();
    g.fillStyle(0xff6600, 0.8);
    g.fillCircle(bx, by, SUB_WEAPON.BOMB.RADIUS);
    this.tweens.add({
      targets: g, alpha: 0, scaleX: 1.4, scaleY: 1.4,
      duration: 350, ease: 'Power2', onComplete: () => g.destroy(),
    });

    // 範囲内のプレイヤーにダメージ
    for (const player of this.players) {
      if (!player.alive) continue;
      const d = Math.hypot(player.x - bx, player.y - by);
      if (d <= SUB_WEAPON.BOMB.RADIUS) {
        const killed = player.onHit();
        if (killed) {
          const killer = this.players.find(p => p.id === ownerId);
          if (killer && killer !== player) killer.kills++;
          this.scheduleRespawn(player);
        }
      }
    }

    // 範囲内のレーザーを消去
    for (const laser of this.lasers) {
      if (!laser.alive) continue;
      const d = Math.hypot(laser.x - bx, laser.y - by);
      if (d <= SUB_WEAPON.BOMB.RADIUS) laser.destroy();
    }

    this.refreshScoreUI();
  }

  private placeTrap(player: Player, type: 'mud' | 'stone'): void {
    const radius = type === 'mud' ? SUB_WEAPON.MUD_TRAP.RADIUS : SUB_WEAPON.STONE_TRAP.RADIUS;
    const maxPerPlayer = type === 'mud' ? SUB_WEAPON.MUD_TRAP.MAX_PER_PLAYER : SUB_WEAPON.STONE_TRAP.MAX_PER_PLAYER;

    // 同タイプのトラップが上限を超えたら古いのを除去
    const playerTraps = this.traps.filter(t => t.ownerId === player.id && t.type === type);
    if (playerTraps.length >= maxPerPlayer) {
      const oldest = playerTraps[0];
      oldest.graphics.destroy();
      this.traps = this.traps.filter(t => t !== oldest);
    }

    const g = this.add.graphics();
    const color = type === 'mud' ? 0x885533 : 0x8888aa;
    g.fillStyle(color, 0.7);
    g.fillCircle(player.x, player.y, radius);
    g.lineStyle(2, color, 1);
    g.strokeCircle(player.x, player.y, radius);

    this.traps.push({ x: player.x, y: player.y, type, ownerId: player.id, radius, graphics: g });
  }

  // ── フィールドアイテム ────────────────────────────────────────────
  private spawnFieldItem(): void {
    if (this.fieldItems.length >= FIELD_ITEM.MAX_ITEMS) return;

    // ランダム位置（壁から離れた場所）
    let x: number, y: number;
    let attempts = 0;
    do {
      x = 100 + Math.random() * (MAP_WIDTH - 200);
      y = 100 + Math.random() * (MAP_HEIGHT - 200);
      attempts++;
    } while (attempts < 20 && this.isInsideWall(x, y, 40));

    const type: 'barrier' | 'speed' = Math.random() < 0.5 ? 'barrier' : 'speed';
    const color = type === 'barrier' ? 0xffffff : 0xffdd00;

    const g = this.add.graphics();
    g.fillStyle(color, 0.9);
    g.fillCircle(x, y, 14);
    g.lineStyle(3, color, 1);
    g.strokeCircle(x, y, 18);

    // 点滅アニメ
    this.tweens.add({
      targets: g, alpha: 0.4,
      duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    this.fieldItems.push({ x, y, type, graphics: g });
  }

  private isInsideWall(x: number, y: number, margin: number): boolean {
    for (const w of this.wallRects) {
      if (x > w.x - margin && x < w.x + w.width + margin &&
          y > w.y - margin && y < w.y + w.height + margin) {
        return true;
      }
    }
    return false;
  }

  // ── メインゲームループ ─────────────────────────────────────────────
  update(_time: number, delta: number): void {
    if (this.matchEnded) return;

    const now = this.time.now;

    // 1. ローカルプレイヤー入力
    if (this.localPlayer.alive) {
      const moveIn = this.moveJoy.getInput();
      const aimIn = this.aimJoy.getInput();
      this.localPlayer.setMoveInput(moveIn.x, moveIn.y);
      this.localPlayer.setAimInput(aimIn.x, aimIn.y, this.aimJoy.isActive());
    }

    // 2. AIボットの更新
    for (const bot of this.players.filter(p => !p.isLocal)) {
      this.updateBot(bot, now);
    }

    // 3. 全プレイヤーの物理更新 → 新規レーザー収集
    for (const player of this.players) {
      if (!player.alive) continue;
      const newLasers = player.update(delta, this.wallRects, this.wallSegs);
      this.lasers.push(...newLasers);
    }

    // 4. レーザー更新
    for (const laser of this.lasers) {
      laser.update(delta, this.wallSegs);
    }

    // 5. レーザー vs プレイヤーの当たり判定
    this.checkLaserHits();

    // 6. トラップ vs プレイヤー判定
    this.checkTrapHits();

    // 7. フィールドアイテム判定
    this.checkFieldItemPickups();

    // 8. フィールドアイテムスポーン
    if (now > this.nextItemSpawn) {
      this.spawnFieldItem();
      this.nextItemSpawn = now + FIELD_ITEM.SPAWN_INTERVAL;
    }

    // 9. 死んだレーザーを除去
    this.lasers = this.lasers.filter(l => l.alive);

    // 10. カメラ追従
    const targetScrollX = this.localPlayer.x - GAME_WIDTH / 2;
    const targetScrollY = this.localPlayer.y - GAME_HEIGHT / 2;
    this.cameras.main.scrollX += (targetScrollX - this.cameras.main.scrollX) * 0.1;
    this.cameras.main.scrollY += (targetScrollY - this.cameras.main.scrollY) * 0.1;

    // 11. HUD更新
    this.updateHUD(now);

    // 12. 試合終了チェック
    const elapsed = now - this.matchStartTime;
    if (elapsed >= MATCH.DURATION && !this.matchEnded) {
      this.endMatch();
    }
  }

  // ── AIボット ──────────────────────────────────────────────────────
  private updateBot(bot: Player, now: number): void {
    if (!bot.alive) return;

    // ターゲット更新（2秒ごと）
    const lastUpdate = this.botTimers.get(bot.id) ?? 0;
    if (now - lastUpdate > 2000) {
      this.botTimers.set(bot.id, now);

      // 最も近い生存中の他プレイヤーをターゲット
      let closest: Player | null = null;
      let closestDist = Infinity;
      for (const p of this.players) {
        if (p.id === bot.id || !p.alive) continue;
        const d = Math.hypot(p.x - bot.x, p.y - bot.y);
        if (d < closestDist) { closestDist = d; closest = p; }
      }

      if (closest) {
        // 目標位置にランダムオフセットを加える（単純追跡にしない）
        const offset = 80;
        this.botTargetX.set(bot.id, closest.x + (Math.random() - 0.5) * offset);
        this.botTargetY.set(bot.id, closest.y + (Math.random() - 0.5) * offset);
      } else {
        // 目標がいなければランダム移動
        this.botTargetX.set(bot.id, 80 + Math.random() * (MAP_WIDTH - 160));
        this.botTargetY.set(bot.id, 80 + Math.random() * (MAP_HEIGHT - 160));
      }
    }

    const tx = this.botTargetX.get(bot.id) ?? MAP_WIDTH / 2;
    const ty = this.botTargetY.get(bot.id) ?? MAP_HEIGHT / 2;
    const dx = tx - bot.x;
    const dy = ty - bot.y;
    const dist = Math.hypot(dx, dy);

    // 移動
    if (dist > 10) {
      const speed = PLAYER.SPEED * 0.85;
      bot.setVelocity((dx / dist) * speed, (dy / dist) * speed);
    } else {
      bot.setVelocity(0, 0);
    }

    // 照準と射撃
    // 最も近い敵を狙う（反射を考慮した単純な直線狙い）
    let aimTarget: Player | null = null;
    let aimDist = Infinity;
    for (const p of this.players) {
      if (p.id === bot.id || !p.alive) continue;
      const d = Math.hypot(p.x - bot.x, p.y - bot.y);
      if (d < aimDist) { aimDist = d; aimTarget = p; }
    }
    if (aimTarget) {
      const adx = aimTarget.x - bot.x;
      const ady = aimTarget.y - bot.y;
      bot.setAimDir(adx, ady);
      bot.setFiring(aimDist < 500); // 射程内なら射撃
    }
  }

  // ── 当たり判定 ────────────────────────────────────────────────────
  private checkLaserHits(): void {
    for (const laser of this.lasers) {
      if (!laser.alive) continue;
      const seg = laser.getSegment();

      for (const player of this.players) {
        if (!player.alive) continue;

        // 自分のレーザー（反射前）は当たらない（フレンドリーファイアは反射後のみ）
        // → 仕様通り「自分のレーザーの反射に当たると自爆」 → 常に判定（自分も含む）

        const hit = lineCircleIntersects(
          { x: seg.x1, y: seg.y1 }, { x: seg.x2, y: seg.y2 },
          { x: player.x, y: player.y }, PLAYER.HITBOX_RADIUS,
        );
        if (!hit) continue;

        const killed = player.onHit();
        laser.destroy();
        if (killed) {
          const killer = this.players.find(p => p.id === laser.ownerId);
          if (killer && killer !== player) killer.kills++;
          this.scheduleRespawn(player);
          this.refreshScoreUI();
        }
        break;
      }
    }
  }

  private checkTrapHits(): void {
    for (const trap of this.traps) {
      for (const player of this.players) {
        if (!player.alive || player.id === trap.ownerId) continue;
        const d = Math.hypot(player.x - trap.x, player.y - trap.y);
        if (d < trap.radius + PLAYER.RADIUS) {
          // トラップを消費
          trap.graphics.destroy();
          const idx = this.traps.indexOf(trap);
          if (idx >= 0) this.traps.splice(idx, 1);

          if (trap.type === 'mud') {
            player.applySlow(SUB_WEAPON.MUD_TRAP.SLOW_RATE, SUB_WEAPON.MUD_TRAP.DURATION);
          } else {
            player.applyStun(SUB_WEAPON.STONE_TRAP.STUN_DURATION);
          }
          break;
        }
      }
    }
  }

  private checkFieldItemPickups(): void {
    for (let i = this.fieldItems.length - 1; i >= 0; i--) {
      const item = this.fieldItems[i];
      for (const player of this.players) {
        if (!player.alive) continue;
        const d = Math.hypot(player.x - item.x, player.y - item.y);
        if (d < FIELD_ITEM.PICKUP_RADIUS + PLAYER.RADIUS) {
          // アイテム取得
          if (item.type === 'barrier') {
            player.applyBarrier();
          } else {
            player.applySpeedBoost(FIELD_ITEM.SPEED_UP.MULTIPLIER, FIELD_ITEM.SPEED_UP.DURATION);
          }
          item.graphics.destroy();
          this.fieldItems.splice(i, 1);
          break;
        }
      }
    }
  }

  private scheduleRespawn(player: Player): void {
    this.time.delayedCall(PLAYER.RESPAWN_DELAY, () => {
      if (this.matchEnded) return;
      const pt = MATCH.RESPAWN_POINTS[Math.floor(Math.random() * MATCH.RESPAWN_POINTS.length)];
      player.respawn(pt.x, pt.y);
      this.drawSubButtons();
    });
  }

  // ── HUD更新 ────────────────────────────────────────────────────────
  private refreshScoreUI(): void {
    this.scoreContainer.removeAll(true);

    const sorted = [...this.players].sort((a, b) => b.kills - a.kills);
    sorted.forEach((p, i) => {
      const color = `#${PLAYER_COLORS[p.colorIndex].toString(16).padStart(6, '0')}`;
      const prefix = p.isLocal ? '▶' : ' ';
      const text = this.add.text(0, i * 18, `${prefix}${p.name}  K:${p.kills} D:${p.deaths}`, {
        fontSize: '12px', fontFamily: 'monospace', color,
        stroke: '#000000', strokeThickness: 2,
      });
      this.scoreContainer.add(text);
    });
  }

  private updateHUD(now: number): void {
    // タイマー
    const remaining = Math.max(0, MATCH.DURATION - (now - this.matchStartTime));
    const min = Math.floor(remaining / 60000);
    const sec = Math.floor((remaining % 60000) / 1000);
    this.timerText.setText(`${min}:${sec.toString().padStart(2, '0')}`);

    // 残り30秒で赤く
    this.timerText.setColor(remaining < 30000 ? '#ff4444' : '#ffffff');

    // ミニマップ
    this.drawMinimap();

    // サブボタン更新（在庫変動に対応）
    this.drawSubButtons();
  }

  private drawMinimap(): void {
    const mm = this.minimapGfx;
    mm.clear();

    const mmX = GAME_WIDTH - 115, mmY = 10;
    const mmW = 105, mmH = Math.round(mmW * MAP_HEIGHT / MAP_WIDTH);
    const sx = mmW / MAP_WIDTH, sy = mmH / MAP_HEIGHT;

    // 背景
    mm.fillStyle(0x000000, 0.65);
    mm.fillRect(mmX, mmY, mmW, mmH);

    // 壁
    mm.fillStyle(0x2255aa, 0.7);
    for (const w of this.wallRects) {
      mm.fillRect(mmX + w.x * sx, mmY + w.y * sy, w.width * sx, w.height * sy);
    }

    // カメラ範囲
    const camX = mmX + this.cameras.main.scrollX * sx;
    const camY = mmY + this.cameras.main.scrollY * sy;
    mm.lineStyle(1, 0x555555, 0.6);
    mm.strokeRect(camX, camY, GAME_WIDTH * sx, GAME_HEIGHT * sy);

    // プレイヤー
    for (const p of this.players) {
      if (!p.alive) continue;
      const px = mmX + p.x * sx;
      const py = mmY + p.y * sy;
      const col = PLAYER_COLORS[p.colorIndex];
      mm.fillStyle(col, 1);
      mm.fillCircle(px, py, p.isLocal ? 4 : 3);
    }

    // 枠線
    mm.lineStyle(1, 0x336655, 1);
    mm.strokeRect(mmX, mmY, mmW, mmH);
  }

  // ── 試合終了 ───────────────────────────────────────────────────────
  private endMatch(): void {
    this.matchEnded = true;

    const scores = this.players
      .map((p, i) => ({
        playerId: p.id,
        name: p.name,
        kills: p.kills,
        deaths: p.deaths,
        rank: 0,
        colorIndex: p.colorIndex,
        isLocal: p.isLocal,
        index: i,
      }))
      .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
      .map((s, i) => ({ ...s, rank: i + 1 }));

    // フラッシュ後にリザルト画面へ
    this.cameras.main.flash(500, 255, 255, 255);
    this.time.delayedCall(600, () => {
      this.scene.start('ResultScene', { scores, myPlayerId: this.localPlayer.id });
    });
  }

  // ── クリーンアップ ─────────────────────────────────────────────────
  shutdown(): void {
    for (const laser of this.lasers) laser.destroy();
    for (const player of this.players) player.destroy();
    for (const trap of this.traps) trap.graphics.destroy();
    for (const item of this.fieldItems) item.graphics.destroy();
    this.moveJoy?.destroy();
    this.aimJoy?.destroy();
  }
}
