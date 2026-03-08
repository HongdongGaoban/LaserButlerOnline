import Phaser from 'phaser';
import { PLAYER_COLORS } from '../config';

interface ScoreEntry {
  playerId: string;
  name: string;
  kills: number;
  deaths: number;
  rank: number;
  colorIndex: number;
  isLocal: boolean;
}

interface ResultData {
  scores: ScoreEntry[];
  myPlayerId: string;
}

/**
 * ResultScene: 試合結果表示画面
 */
export class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ResultScene' });
  }

  create(data: ResultData): void {
    const { width, height } = this.cameras.main;
    const scores = data?.scores ?? [];
    const myId = data?.myPlayerId ?? '';

    this.drawBackground(width, height);

    // タイトル
    const winner = scores[0];
    const isPlayerWin = winner?.isLocal;
    const titleText = isPlayerWin ? '🏆 YOU WIN!' : 'RESULT';
    const titleColor = isPlayerWin ? '#ffdd00' : '#00ffcc';

    this.add.text(width / 2, 28, titleText, {
      fontSize: '32px', fontFamily: 'monospace',
      color: titleColor, stroke: '#000000', strokeThickness: 4,
      shadow: { offsetX: 0, offsetY: 0, color: titleColor, blur: 20, fill: true },
    }).setOrigin(0.5);

    // スコアボード
    const startY = 85;
    const rowH = 48;
    scores.forEach((entry, i) => {
      const y = startY + i * rowH;
      const isMe = entry.playerId === myId;
      const col = PLAYER_COLORS[entry.colorIndex ?? i];
      const hexCol = `#${col.toString(16).padStart(6, '0')}`;

      // 行背景
      const g = this.add.graphics();
      if (isMe) {
        g.fillStyle(col, 0.1);
        g.fillRoundedRect(20, y - 4, width - 40, rowH - 4, 6);
        g.lineStyle(1, col, 0.4);
        g.strokeRoundedRect(20, y - 4, width - 40, rowH - 4, 6);
      }

      // ランクアイコン
      const rankIcons = ['🥇', '🥈', '🥉', '4th'];
      const rankTxt = i < 3 ? rankIcons[i] : rankIcons[3];
      this.add.text(36, y + 12, rankTxt, {
        fontSize: i < 3 ? '22px' : '16px', fontFamily: 'monospace', color: hexCol,
      }).setOrigin(0, 0.5);

      // プレイヤー名
      this.add.text(90, y + 12, entry.name + (isMe ? ' ◀' : ''), {
        fontSize: '15px', fontFamily: 'monospace',
        color: isMe ? '#ffffff' : hexCol,
        fontStyle: isMe ? 'bold' : 'normal',
      }).setOrigin(0, 0.5);

      // キル数
      this.add.text(width / 2 + 20, y + 12, `KILL  ${entry.kills}`, {
        fontSize: '14px', fontFamily: 'monospace', color: '#ff6688',
      }).setOrigin(0, 0.5);

      // デス数
      this.add.text(width / 2 + 120, y + 12, `DEATH  ${entry.deaths}`, {
        fontSize: '14px', fontFamily: 'monospace', color: '#888888',
      }).setOrigin(0, 0.5);

      // KDR
      const kdr = entry.deaths > 0 ? (entry.kills / entry.deaths).toFixed(1) : entry.kills.toFixed(1);
      this.add.text(width - 40, y + 12, `KDR ${kdr}`, {
        fontSize: '12px', fontFamily: 'monospace', color: '#aaaaaa',
      }).setOrigin(1, 0.5);
    });

    // 区切り線
    const g2 = this.add.graphics();
    g2.lineStyle(1, 0x224433, 0.8);
    g2.moveTo(20, startY - 10).lineTo(width - 20, startY - 10);
    g2.strokePath();

    // 戻るボタン
    this.createBackButton(width, height);
  }

  private drawBackground(width: number, height: number): void {
    const g = this.add.graphics();
    g.fillStyle(0x000810, 1);
    g.fillRect(0, 0, width, height);
    g.lineStyle(1, 0x001122, 0.6);
    for (let x = 0; x < width; x += 40) { g.moveTo(x, 0).lineTo(x, height); }
    for (let y = 0; y < height; y += 40) { g.moveTo(0, y).lineTo(width, y); }
    g.strokePath();
  }

  private createBackButton(width: number, height: number): void {
    const bw = 240, bh = 40;
    const bx = width / 2, by = height - 34;

    const g = this.add.graphics();
    const draw = (hover: boolean) => {
      g.clear();
      g.fillStyle(hover ? 0x003322 : 0x001122, 0.9);
      g.fillRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 8);
      g.lineStyle(2, 0x00ffcc, 1);
      g.strokeRoundedRect(bx - bw / 2, by - bh / 2, bw, bh, 8);
    };
    draw(false);

    this.add.text(bx, by, '[ BACK TO LOBBY ]', {
      fontSize: '16px', fontFamily: 'monospace', color: '#00ffcc',
    }).setOrigin(0.5);

    const zone = this.add.zone(bx, by, bw, bh).setInteractive();
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout',  () => draw(false));
    zone.on('pointerdown', () => {
      this.cameras.main.fade(200, 0, 0, 0);
      this.time.delayedCall(200, () => this.scene.start('LobbyScene'));
    });
  }
}
