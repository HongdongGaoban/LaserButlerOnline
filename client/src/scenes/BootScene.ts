import Phaser from 'phaser';

/**
 * BootScene: 起動時にアセットをプリロードするシーン
 * アセットがほぼ存在しない（図形描画主体）ため、シンプルな構成
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // 図形描画主体のためテクスチャは最小限
    // 音声ファイルがあればここでロード
    // this.load.audio('laser', 'assets/laser.ogg');
    // this.load.audio('explosion', 'assets/explosion.ogg');

    // ローディングバーを表示（Phaserの組み込み機能）
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();

    progressBox.fillStyle(0x00ffcc, 0.2);
    progressBox.fillRect(width / 2 - 160, height / 2 - 15, 320, 30);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x00ffcc, 1);
      progressBar.fillRect(width / 2 - 158, height / 2 - 13, 316 * value, 26);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
    });
  }

  create(): void {
    // TODO: ロビーシーンへ遷移（後でマッチメイキングUIを実装）
    this.scene.start('LobbyScene');
  }
}
