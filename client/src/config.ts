// ゲーム全体の定数設定

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 450;

export const MAP_WIDTH = 1600;
export const MAP_HEIGHT = 1200;

// プレイヤー設定
export const PLAYER = {
  RADIUS: 16,                   // 見た目の半径 (px)
  HITBOX_RADIUS: 11,            // 当たり判定の半径（見た目の約70%）
  SPEED: 200,                   // 移動速度 (px/sec)
  RESPAWN_DELAY: 3000,          // リスポーン待機時間 (ms)
} as const;

// レーザー設定
export const LASER = {
  SPEED: 600,                   // 弾速 (px/sec)
  WIDTH: 3,                     // 描画幅 (px)
  MAX_BOUNCES: 3,               // 最大反射回数
  LIFETIME: 2000,               // 生存時間 (ms)
  FIRE_INTERVAL: 500,           // 発射間隔 (ms) = 2発/秒
  LENGTH: 20,                   // 描画上の長さ (px)
} as const;

// サブ装備設定
export const SUB_WEAPON = {
  BOMB: {
    FUSE_TIME: 1000,            // 爆発までの時間 (ms)
    RADIUS: 150,                // 爆発範囲の半径 (px)
    MAX_STOCK: 2,               // 初期在庫
  },
  DASH: {
    DISTANCE: 200,              // ダッシュ距離 (px)
    INVINCIBLE_DURATION: 300,   // 無敵時間 (ms)
    MAX_STOCK: 2,
  },
  MUD_TRAP: {
    SLOW_RATE: 0.5,             // 減速率（50%の速度）
    DURATION: 2000,             // 効果時間 (ms)
    MAX_PER_PLAYER: 3,          // 同時設置数上限
    MAX_STOCK: 3,
  },
  STONE_TRAP: {
    STUN_DURATION: 1200,        // 拘束時間 (ms)
    MAX_PER_PLAYER: 2,          // 同時設置数上限
    MAX_STOCK: 2,
  },
} as const;

// フィールドアイテム設定
export const FIELD_ITEM = {
  SPAWN_INTERVAL: 10000,        // 出現間隔 (ms)
  MAX_ITEMS: 3,                 // 同時最大出現数
  BARRIER: {
    DURATION: 0,                // 永続（1回ダメージ無効）
  },
  SPEED_UP: {
    MULTIPLIER: 1.5,            // 速度倍率
    DURATION: 5000,             // 効果時間 (ms)
  },
} as const;

// 試合設定
export const MATCH = {
  DURATION: 120000,             // 試合時間 (ms) = 2分
  MAX_PLAYERS: 6,
  RESPAWN_POINTS: [             // リスポーン位置（マップ座標）
    { x: 200, y: 200 },
    { x: 1400, y: 200 },
    { x: 800, y: 600 },
    { x: 200, y: 1000 },
    { x: 1400, y: 1000 },
    { x: 800, y: 200 },
  ],
} as const;

// プレイヤーカラー（最大6人分）
export const PLAYER_COLORS = [
  0x00ffcc,   // シアン
  0xff4466,   // レッド
  0xffcc00,   // イエロー
  0x44ff88,   // グリーン
  0xff8844,   // オレンジ
  0xcc44ff,   // パープル
] as const;

// ネットワーク設定
export const NETWORK = {
  SYNC_RATE: 20,                // 位置同期レート (fps)
  MIN_MOVE_THRESHOLD: 2,        // 送信するための最小移動距離 (px)
  INTERPOLATION_DELAY: 100,     // 補間遅延 (ms)
} as const;

// Photon設定（実際の値はenv変数から取得）
export const PHOTON_CONFIG = {
  APP_ID: import.meta.env.VITE_PHOTON_APP_ID ?? 'your-photon-app-id',
  APP_VERSION: '1.0.0',
  REGION: 'jp',                 // 日本リージョン
} as const;

// バックエンドAPI
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

// バーチャルジョイスティック設定
export const JOYSTICK = {
  RADIUS: 60,                   // ジョイスティックの半径 (px)
  DEADZONE: 0.15,               // デッドゾーン（この割合以下の入力を無視）
  DIGITAL_THRESHOLD: 0.5,       // デジタル入力として扱う閾値
} as const;
