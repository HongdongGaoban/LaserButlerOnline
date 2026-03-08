import Phaser from 'phaser';

interface ResultData {
  scores: Array<{ playerId: string; name: string; kills: number; deaths: number; rank: number }>;
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

    this.add.text(width / 2, 40, 'RESULT', {
      fontSize: '32px',
      fontFamily: 'monospace',
      color: '#ffcc00',
      stroke: '#333300',
      strokeThickness: 3,
    }).setOrigin(0.5);

    // スコアボード表示
    const sorted = [...(data?.scores ?? [])].sort((a, b) => a.rank - b.rank);
    sorted.forEach((entry, i) => {
      const y = 100 + i * 50;
      const isMe = entry.playerId === data?.myPlayerId;
      const color = isMe ? '#00ffcc' : '#ffffff';

      this.add.text(width / 2 - 160, y, `${entry.rank}.`, {
        fontSize: '20px', fontFamily: 'monospace', color,
      });
      this.add.text(width / 2 - 100, y, entry.name, {
        fontSize: '20px', fontFamily: 'monospace', color,
      });
      this.add.text(width / 2 + 60, y, `K: ${entry.kills}`, {
        fontSize: '18px', fontFamily: 'monospace', color: '#ff4466',
      });
      this.add.text(width / 2 + 130, y, `D: ${entry.deaths}`, {
        fontSize: '18px', fontFamily: 'monospace', color: '#aaaaaa',
      });
    });

    // ホームに戻るボタン
    const backBtn = this.add.text(width / 2, height - 60, '[ BACK TO LOBBY ]', {
      fontSize: '20px',
      fontFamily: 'monospace',
      color: '#00ffcc',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    backBtn.on('pointerdown', () => {
      this.scene.start('LobbyScene');
    });
  }
}
