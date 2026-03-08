import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../config';

/**
 * BootScene: 起動・アセット読み込みシーン
 * 図形描画主体のためテクスチャは最小限
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const cw = GAME_WIDTH, ch = GAME_HEIGHT;

    // ローディングバー
    const barBg = this.add.graphics();
    barBg.fillStyle(0x00ffcc, 0.15);
    barBg.fillRoundedRect(cw / 2 - 160, ch / 2 - 12, 320, 24, 6);

    const bar = this.add.graphics();

    this.add.text(cw / 2, ch / 2 - 30, 'LASER BUTLER ONLINE', {
      fontSize: '18px', fontFamily: 'monospace', color: '#00ffcc',
    }).setOrigin(0.5);

    this.load.on('progress', (v: number) => {
      bar.clear();
      bar.fillStyle(0x00ffcc, 1);
      bar.fillRoundedRect(cw / 2 - 158, ch / 2 - 10, 316 * v, 20, 5);
    });

    this.load.on('complete', () => {
      bar.destroy();
      barBg.destroy();
    });
  }

  create(): void {
    this.scene.start('LobbyScene');
  }
}
