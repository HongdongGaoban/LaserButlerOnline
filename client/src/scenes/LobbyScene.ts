import Phaser from 'phaser';
import { requestFullscreen } from '../utils/MobileUtils';
import { PLAYER_COLORS } from '../config';

/**
 * LobbyScene: ロビー・マッチメイキング画面
 * Phase 1: ソロプレイ（AIボット3体）のみ
 * Phase 2: Photon連携のマルチプレイを追加予定
 */
export class LobbyScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LobbyScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    this.drawCyberBackground(width, height);
    this.drawTitle(width, height);
    this.drawControls(width, height);
    this.createButtons(width, height);

    // バージョン
    this.add.text(width - 8, height - 8, 'v0.1.0 alpha', {
      fontSize: '11px', fontFamily: 'monospace', color: '#224433',
    }).setOrigin(1, 1);
  }

  private drawCyberBackground(width: number, height: number): void {
    const g = this.add.graphics();

    // グラデーション背景（矩形で近似）
    for (let i = 0; i < height; i += 4) {
      const t = i / height;
      const r = Math.floor(0 * (1 - t) + 0 * t);
      const gb = Math.floor(8 * (1 - t) + 20 * t);
      const b = Math.floor(16 * (1 - t) + 32 * t);
      g.fillStyle(Phaser.Display.Color.GetColor(r, gb, b), 1);
      g.fillRect(0, i, width, 4);
    }

    // グリッドライン
    g.lineStyle(1, 0x002233, 0.8);
    const gs = 40;
    for (let x = 0; x < width; x += gs) { g.moveTo(x, 0).lineTo(x, height); }
    for (let y = 0; y < height; y += gs) { g.moveTo(0, y).lineTo(width, y); }
    g.strokePath();

    // 浮遊するレーザー装飾
    for (let i = 0; i < 4; i++) {
      const col = PLAYER_COLORS[i];
      g.lineStyle(2, col, 0.15);
      const startX = Math.random() * width;
      const startY = Math.random() * height;
      g.beginPath();
      g.moveTo(startX, startY);
      g.lineTo(startX + 80, startY + 40);
      g.lineTo(startX + 120, startY - 20);
      g.strokePath();
    }
  }

  private drawTitle(width: number, height: number): void {
    // メインタイトル
    this.add.text(width / 2, height * 0.18, 'LASER BUTLER', {
      fontSize: '38px', fontFamily: 'monospace',
      color: '#00ffcc',
      stroke: '#003322', strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 0, color: '#00ffcc', blur: 20, fill: true },
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.29, 'O N L I N E', {
      fontSize: '18px', fontFamily: 'monospace',
      color: '#00aaff',
      letterSpacing: 8,
    }).setOrigin(0.5);

    // 装飾ライン
    const g = this.add.graphics();
    g.lineStyle(1, 0x00ffcc, 0.3);
    g.moveTo(width / 2 - 160, height * 0.34).lineTo(width / 2 + 160, height * 0.34);
    g.strokePath();
  }

  private drawControls(width: number, height: number): void {
    // 操作説明
    const lines = [
      '[ 操作方法 ]',
      '左スティック  : 移動',
      '右スティック  : 照準・連射',
      'ボタンA/B     : サブ装備',
      '',
      '[ ルール ]',
      '制限時間 2分 / キル数競争',
      'レーザーは壁で3回まで反射',
      '自分のレーザー反射に注意!',
    ];

    const y = height * 0.38;
    lines.forEach((line, i) => {
      const isHeader = line.startsWith('[');
      this.add.text(width / 2, y + i * 18, line, {
        fontSize: isHeader ? '13px' : '12px',
        fontFamily: 'monospace',
        color: isHeader ? '#ffcc00' : '#aaccaa',
      }).setOrigin(0.5);
    });
  }

  private createButtons(width: number, height: number): void {
    // SOLO PLAY ボタン
    this.createButton(width / 2, height * 0.82, '▶  SOLO PLAY  ( vs 3 bots )', 0x00ffcc, () => {
      requestFullscreen();
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => {
        this.scene.start('GameScene', { mode: 'solo' });
      });
    });

    // ONLINE (Coming Soon)
    const onlineBtn = this.add.text(width / 2, height * 0.91, 'ONLINE MATCH  [ Coming in Phase 2 ]', {
      fontSize: '13px', fontFamily: 'monospace', color: '#445566',
    }).setOrigin(0.5);
    // 点滅
    this.tweens.add({
      targets: onlineBtn, alpha: 0.5,
      duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }

  private createButton(x: number, y: number, label: string, color: number, cb: () => void): void {
    const hexColor = `#${color.toString(16).padStart(6, '0')}`;
    const w = 280, h = 42;

    const g = this.add.graphics();
    const drawNormal = () => {
      g.clear();
      g.fillStyle(0x001122, 0.9);
      g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 8);
      g.lineStyle(2, color, 1);
      g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 8);
    };
    const drawHover = () => {
      g.clear();
      g.fillStyle(color, 0.2);
      g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 8);
      g.lineStyle(2, color, 1);
      g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 8);
    };

    drawNormal();

    const txt = this.add.text(x, y, label, {
      fontSize: '15px', fontFamily: 'monospace', color: hexColor,
    }).setOrigin(0.5);

    // ヒットエリア
    const zone = this.add.zone(x, y, w, h).setInteractive();
    zone.on('pointerover', () => drawHover());
    zone.on('pointerout',  () => drawNormal());
    zone.on('pointerdown', () => { this.cameras.main.flash(80, 0, 255, 204); cb(); });

    // 呼吸アニメーション
    this.tweens.add({
      targets: txt, scaleX: 1.02, scaleY: 1.02,
      duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }
}
