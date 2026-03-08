import Phaser from 'phaser';
import { requestFullscreen } from '../utils/MobileUtils';

/**
 * LobbyScene: ロビー・マッチメイキング画面
 * Phase 1では「ひとりで試す」ボタンのみ実装
 * Phase 2でPhoton連携のマルチプレイ対応を追加
 */
export class LobbyScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LobbyScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // 背景グリッド（サイバー感の演出）
    this.drawBackground();

    // タイトルテキスト
    this.add.text(width / 2, height * 0.2, 'LASER BUTLER', {
      fontSize: '36px',
      fontFamily: 'monospace',
      color: '#00ffcc',
      stroke: '#003333',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.3, 'ONLINE', {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#00aaff',
    }).setOrigin(0.5);

    // クイックマッチボタン
    this.createButton(width / 2, height * 0.5, 'QUICK MATCH', () => {
      requestFullscreen();
      this.scene.start('GameScene', { mode: 'multiplayer' });
    });

    // ソロプレイボタン（Phase 1: オフラインテスト用）
    this.createButton(width / 2, height * 0.65, 'SOLO PRACTICE', () => {
      requestFullscreen();
      this.scene.start('GameScene', { mode: 'solo' });
    });

    // バージョン表示
    this.add.text(width - 10, height - 10, 'v0.1.0 (alpha)', {
      fontSize: '12px',
      fontFamily: 'monospace',
      color: '#336655',
    }).setOrigin(1, 1);
  }

  private drawBackground(): void {
    const { width, height } = this.cameras.main;
    const graphics = this.add.graphics();

    // グリッド線
    graphics.lineStyle(1, 0x003333, 0.5);
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      graphics.moveTo(x, 0).lineTo(x, height);
    }
    for (let y = 0; y < height; y += gridSize) {
      graphics.moveTo(0, y).lineTo(width, y);
    }
    graphics.strokePath();
  }

  private createButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // ボタン背景
    const bg = this.add.graphics();
    bg.fillStyle(0x001122, 1);
    bg.lineStyle(2, 0x00ffcc, 1);
    bg.fillRoundedRect(-120, -22, 240, 44, 8);
    bg.strokeRoundedRect(-120, -22, 240, 44, 8);

    // ボタンテキスト
    const text = this.add.text(0, 0, label, {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#00ffcc',
    }).setOrigin(0.5);

    container.add([bg, text]);

    // インタラクティブ設定
    container.setSize(240, 44);
    container.setInteractive({ useHandCursor: true });

    container.on('pointerover', () => {
      bg.clear();
      bg.fillStyle(0x003344, 1);
      bg.lineStyle(2, 0x00ffcc, 1);
      bg.fillRoundedRect(-120, -22, 240, 44, 8);
      bg.strokeRoundedRect(-120, -22, 240, 44, 8);
    });

    container.on('pointerout', () => {
      bg.clear();
      bg.fillStyle(0x001122, 1);
      bg.lineStyle(2, 0x00ffcc, 1);
      bg.fillRoundedRect(-120, -22, 240, 44, 8);
      bg.strokeRoundedRect(-120, -22, 240, 44, 8);
    });

    container.on('pointerdown', () => {
      this.cameras.main.flash(100, 0, 255, 204);
      this.time.delayedCall(100, onClick);
    });

    return container;
  }
}
