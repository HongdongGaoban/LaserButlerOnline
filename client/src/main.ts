import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './config';
import { BootScene } from './scenes/BootScene';
import { LobbyScene } from './scenes/LobbyScene';
import { GameScene } from './scenes/GameScene';
import { ResultScene } from './scenes/ResultScene';
import {
  disableMobileGestures,
  initAudioOnFirstTouch,
  hideLoadingScreen,
} from './utils/MobileUtils';

// スマホ対策を最初に適用
disableMobileGestures();
initAudioOnFirstTouch();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,             // WebGL優先、非対応なら Canvas にフォールバック
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#000010',
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,      // アスペクト比を維持しながら画面にフィット
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },  // トップダウンなので重力なし
      debug: import.meta.env.DEV,
    },
  },
  input: {
    activePointers: 3,           // 最大3本指まで追跡（移動+照準+ボタン）
  },
  audio: {
    disableWebAudio: false,
  },
  scene: [BootScene, LobbyScene, GameScene, ResultScene],
  callbacks: {
    postBoot: () => {
      hideLoadingScreen();
    },
  },
};

const game = new Phaser.Game(config);

// HMR対応（開発時のみ）
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    game.destroy(true);
  });
}
