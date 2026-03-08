// ゲーム全体の定数設定

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 450;

export const MAP_WIDTH = 1600;
export const MAP_HEIGHT = 900;   // 16:9 at 2x zoom

// プレイヤー設定
export const PLAYER = {
  RADIUS: 16,
  HITBOX_RADIUS: 11,            // 見た目の約70%（「ギリギリで避ける」感覚）
  SPEED: 220,
  RESPAWN_DELAY: 3000,
  INVINCIBLE_AFTER_RESPAWN: 2000,
} as const;

// レーザー設定
export const LASER = {
  SPEED: 550,
  WIDTH: 3,
  MAX_BOUNCES: 3,
  LIFETIME: 2200,               // ms
  FIRE_INTERVAL: 500,           // ms（2発/秒）
  LENGTH: 22,                   // 描画上の長さ
} as const;

// サブ装備設定
export const SUB_WEAPON = {
  BOMB: {
    FUSE_TIME: 1000,
    RADIUS: 140,
    MAX_STOCK: 2,
  },
  DASH: {
    DISTANCE: 180,
    INVINCIBLE_DURATION: 280,   // ms
    SPEED: 1200,                // px/sec（瞬間的な高速）
    MAX_STOCK: 2,
  },
  MUD_TRAP: {
    SLOW_RATE: 0.45,
    DURATION: 2000,
    MAX_PER_PLAYER: 3,
    MAX_STOCK: 3,
    RADIUS: 28,
  },
  STONE_TRAP: {
    STUN_DURATION: 1200,
    MAX_PER_PLAYER: 2,
    MAX_STOCK: 2,
    RADIUS: 24,
  },
} as const;

// フィールドアイテム設定
export const FIELD_ITEM = {
  SPAWN_INTERVAL: 8000,
  MAX_ITEMS: 4,
  PICKUP_RADIUS: 28,
  SPEED_UP: {
    MULTIPLIER: 1.6,
    DURATION: 5000,
  },
} as const;

// 試合設定
export const MATCH = {
  DURATION: 120000,             // 2分
  MAX_PLAYERS: 6,
  RESPAWN_POINTS: [
    { x: 160, y: 160 },
    { x: MAP_WIDTH - 160, y: 160 },
    { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 },
    { x: 160, y: MAP_HEIGHT - 160 },
    { x: MAP_WIDTH - 160, y: MAP_HEIGHT - 160 },
    { x: MAP_WIDTH / 2, y: 160 },
  ],
} as const;

// プレイヤーカラー（最大6人分）
export const PLAYER_COLORS = [
  0x00ffcc,   // シアン（自分）
  0xff4466,   // レッド
  0xffcc00,   // イエロー
  0x44ff88,   // グリーン
  0xff8844,   // オレンジ
  0xcc44ff,   // パープル
] as const;

// バーチャルジョイスティック設定
export const JOYSTICK = {
  RADIUS: 55,
  DEADZONE: 0.12,
  DIGITAL_THRESHOLD: 0.4,
} as const;

// バックエンドAPI
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';
