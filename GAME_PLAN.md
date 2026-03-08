# レーザーバトラーオンライン - 実現可能性分析・実装計画書

作成日: 2026-03-08

---

## 1. 結論：実現可能性の総評

**結論：完全無料枠での実現は可能。ただし規模に制約あり。**

| 評価軸 | 判定 | 備考 |
|---|---|---|
| 技術的実現可能性 | ✅ 可能 | すべての必要技術が無料で利用可能 |
| コスト0運用 | ✅ 可能 | 適切な設計で達成可能 |
| 同時接続規模 | ⚠️ 制限あり | Photon無料枠：最大20CCU（約3試合同時） |
| スマホ対応 | ✅ 可能 | Phaser 3はモバイルブラウザに最適化済み |
| 開発難易度 | ⚠️ 中〜高 | リアルタイム同期・物理演算の実装が要注意 |

---

## 2. サービス別・無料枠の詳細分析

### 2.1 フロントエンド（Phaser 3）

**ライセンス**: MIT / 完全無料

**適合性評価**: ★★★★★（最良の選択）

| 機能要件 | Phaser 3での実現方法 | 難易度 |
|---|---|---|
| レーザー反射物理 | Arcade Physics のバウンス（bounce=1）+ 法線ベクトル計算 | 中 |
| バーチャルジョイスティック | `phaser3-rex-plugins` の VirtualJoystick を使用 | 低 |
| トップダウン2D描画 | `Graphics` オブジェクトで円・矩形・線を描画 | 低 |
| タッチ操作 | Phaser 組み込みの Input.touch を使用 | 低 |
| ミニマップ | サブカメラ（Camera）を画面右上に配置 | 中 |
| Raycast当たり判定 | `Phaser.Geom.Intersects.GetLineToLine()` を使用 | 中 |

**推奨バンドルサイズ**: Phaser 3本体 ~1MB + ゲームロジック ~200KB = 計約1.2MB（許容範囲）

---

### 2.2 ホスティング（Vercel Hobby プラン）

**月額**: 無料

| 制限項目 | 無料枠 | 本ゲームの想定使用量 | 判定 |
|---|---|---|---|
| 帯域幅 | 100GB/月 | 初期流入 ~1GB/月 | ✅ 余裕あり |
| デプロイ数 | 無制限 | 開発中10〜20回/月 | ✅ 問題なし |
| Edge Functions実行時間 | 500時間/月 | 使用しない（静的配信のみ） | ✅ 問題なし |
| カスタムドメイン | 1つ | 1つあれば十分 | ✅ 問題なし |

**注意点**: ゲーム本体はすべて静的ファイル（HTML/JS/CSS）として配信するため、Vercelの無料枠で問題なし。

---

### 2.3 リアルタイム通信（Photon Realtime）

**月額**: 無料（20CCU以内）

| 制限項目 | 無料枠 | 本ゲームの想定使用量 | 判定 |
|---|---|---|---|
| 同時接続数 (CCU) | **20** | 最大6人/試合 × 約3試合 = 18人 | ⚠️ ギリギリ |
| メッセージ送信レート | 500 msg/秒/room | 6人 × 60msg/秒 = 360msg/秒 | ✅ 問題なし |
| データ転送量 | 制限なし（実質） | - | ✅ 問題なし |
| ルーム数 | 制限なし | - | ✅ 問題なし |

**重要な設計判断**:

20CCUという制約から、**同時に3試合（18人）まで**が無料枠の限界。
MVP・テストフェーズには十分だが、スケールアップ時は有料プランへの移行が必要。

**Photon無料プランでの技術的制約への対応**:
- 送信頻度を抑える差分同期（位置が変化したときのみ送信）で帯域節約
- サーバー側ロジックはPhoton Cloud内では動かせない（クライアント権威型 or マスタークライアント型を採用）

---

### 2.4 バックエンドAPI（Google Cloud Run）

**月額**: 無料

| 制限項目 | 無料枠/月 | 本ゲームの想定使用量 | 判定 |
|---|---|---|---|
| リクエスト数 | 200万回 | ~1万回（試合結果保存のみ） | ✅ 大幅に余裕 |
| vCPU秒 | 18万秒 | ~1,000秒 | ✅ 大幅に余裕 |
| メモリ (GB秒) | 36万GB秒 | ~2,000GB秒 | ✅ 大幅に余裕 |
| ネットワーク送信 | 1GB | ~10MB | ✅ 大幅に余裕 |

**冷却起動（Cold Start）対策**: 最小インスタンス数を0に設定し、リクエストがない時間帯はゼロスケール。ゲーム終了後の非同期保存のみに使用するため、Cold Startの遅延（~1秒）は許容範囲。

---

### 2.5 データベース（Supabase Free Tier）

**月額**: 無料

| 制限項目 | 無料枠 | 本ゲームの想定使用量 | 判定 |
|---|---|---|---|
| データベース容量 | 500MB | ~10MB（ユーザー数1000人規模） | ✅ 余裕あり |
| 月次アクティブユーザー | 50,000 | 初期は100〜1000人 | ✅ 余裕あり |
| APIリクエスト | 500K/月 | ~10K/月 | ✅ 余裕あり |
| ストレージ | 1GB | 使用しない（アバター等なし） | ✅ 問題なし |
| 不活性化 | **1週間アクセスなしで一時停止** | ⚠️ 要注意 | ⚠️ 対策必要 |

**重要な注意点**: Supabaseの無料プロジェクトは7日間アクセスがないと**自動一時停止**される。
定期的なヘルスチェック（cronジョブ）を設定して対策する。

**代替案（Firestore無料枠）**:
- 読み取り: 50,000回/日
- 書き込み: 20,000回/日
- 削除: 20,000回/日
- ストレージ: 1GiB

どちらも本ゲームの規模には十分。**Supabaseを第一候補**とし、PostgreSQLの親しみやすさとRLS（Row Level Security）によるセキュリティを活かす。

---

## 3. アーキテクチャ詳細設計

### 3.1 全体構成図

```
[スマホブラウザ]
     │
     ├──(HTTP/HTTPS)──► [Vercel]
     │                    静的ファイル配信
     │                    HTML/JS/CSS/Assets
     │
     ├──(WebSocket)──► [Photon Realtime Cloud]
     │                    リアルタイム同期
     │                    位置・レーザー・イベント
     │
     └──(REST API)──► [Google Cloud Run]
                          試合結果保存
                          ランキング取得
                          マスターデータ配信
                               │
                               ▼
                         [Supabase]
                          PostgreSQL DB
                          ユーザーデータ
                          戦績データ
```

### 3.2 ネットワーク同期設計（重要）

**同期方式**: クライアント権威型 + マスタークライアント型のハイブリッド

```
各クライアントが自分の移動を先行処理（予測）
   │
   ├── 自分の位置を Photon で全員に送信（60fps → 実際は20〜30fps）
   ├── 他プレイヤーの位置を受信して補間表示（線形補間）
   └── レーザー発射イベントを全員に送信
         └── 各クライアントが自前でレーザー軌道を計算・描画
```

**送信データパケット（1回あたり）**:

```json
{
  "t": 1234567,      // タイムスタンプ（ms）: 4byte
  "x": 512.3,        // X座標: 4byte
  "y": 384.1,        // Y座標: 4byte
  "vx": 1.0,         // 速度X方向: 1byte（正規化）
  "vy": 0.0          // 速度Y方向: 1byte（正規化）
}
// 合計: ~14byte/パケット × 20fps × 6人 = ~1.6KB/秒/クライアント
```

レーザー発射イベント:
```json
{
  "type": "laser",
  "x": 512.3, "y": 384.1,   // 発射位置
  "dx": 0.7, "dy": 0.7      // 方向ベクトル（正規化済み）
}
```

---

## 4. 実装フェーズ計画

### Phase 1：ローカル動作プロトタイプ（1〜2週間）

- [ ] プロジェクトセットアップ（Vite + TypeScript + Phaser 3）
- [ ] バーチャルジョイスティック実装（移動・照準）
- [ ] プレイヤースプライト（円形）の描画と移動
- [ ] レーザー発射・壁反射ロジックの実装
- [ ] 当たり判定（レーザー vs プレイヤー）
- [ ] マップ（壁・溝）の実装
- [ ] サブ装備（ボム・ダッシュ・罠×2）の実装
- [ ] フィールドアイテム（バリア・スピードUP）
- [ ] HUD（タイマー・スコア・HP・ミニマップ）
- [ ] スマホ特有の対策（スクロール無効・フルスクリーン・AudioContext）

### Phase 2：オンライン対戦実装（2〜3週間）

- [ ] Photon Realtime JS SDK の導入
- [ ] ルーム作成・入室・マッチメイキング実装
- [ ] プレイヤー位置同期（20〜30fps）
- [ ] レーザー発射イベント同期
- [ ] リスポーン同期
- [ ] マスタークライアントによる試合管理（タイマー・スコア集計）
- [ ] 切断時の処理（AIボット切り替え or 試合続行ロジック）

### Phase 3：バックエンド・データ永続化（1〜2週間）

- [ ] Supabaseのスキーマ設計・RLS設定
- [ ] Cloud Runへのバックエンドコンテナデプロイ
- [ ] 試合結果のAPIエンドポイント実装
- [ ] ランキング機能
- [ ] ゲストログイン / 匿名認証

### Phase 4：バランス調整・リリース（1週間）

- [ ] 実機テストプレイ（パラメータチューニング）
- [ ] Vercelへの本番デプロイ
- [ ] パフォーマンス計測・最適化
- [ ] エラーハンドリング・再接続処理の検証

---

## 5. リスク分析と対策

### リスク1: Photon 20CCU制限 ⚠️ 高

**問題**: ユーザーが増えると同時に20人以上が接続できない。

**対策**:
- MVPフェーズでは20CCU内でテスト（最大3試合同時）
- ユーザーが増えたらPhoton有料プランへ移行（$95/月〜）または代替検討
- 代替案: `PartyKit`（Cloudflare Durable Objectsベース）の無料枠も検討

### リスク2: Supabase自動一時停止 ⚠️ 中

**問題**: 7日間アクセスなしでプロジェクト停止。

**対策**:
- GitHub Actions + cron で週1回ヘルスチェックAPIを叩く
- Vercel Cron（無料枠あり）でも代替可能

### リスク3: モバイルブラウザの性能差 ⚠️ 中

**問題**: 低スペックAndroudでフレームレート低下。

**対策**:
- Phaser 3の`renderer`設定でWebGLを優先、Canvas fallback
- 描画を図形（Graphics）のみに限定し、テクスチャ使用を最小化
- 目標: 60fps on iPhone 12 / Galaxy A53

### リスク4: レーザー同期のズレ ⚠️ 中

**問題**: 通信遅延でクライアント間のレーザー位置がずれ、当たり判定に不公平感。

**対策**:
- レーザーはマスタークライアント（ホスト）が当たり判定を担当
- 発射時刻を送信し、クライアント側でタイムスタンプ補正
- 視覚的なエフェクトと当たり判定を分離（見た目は各自ローカル計算）

### リスク5: Cold Start遅延（Cloud Run） ⚠️ 低

**問題**: 非アクティブ後の初回リクエストに1〜3秒かかる。

**対策**:
- 試合結果保存は非同期（Fire-and-forget）で実装
- ユーザーは結果画面を見ている間にAPIが処理する設計

---

## 6. データベーススキーマ（Supabase PostgreSQL）

```sql
-- ユーザーテーブル
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- 試合テーブル
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  map_id VARCHAR(20) NOT NULL,
  mode VARCHAR(20) NOT NULL DEFAULT 'battle_royale'
);

-- 試合結果テーブル
CREATE TABLE match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id),
  user_id UUID REFERENCES users(id),
  rank INTEGER NOT NULL,
  kills INTEGER DEFAULT 0,
  deaths INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 統計サマリー（集計済みキャッシュ）
CREATE TABLE user_stats (
  user_id UUID PRIMARY KEY REFERENCES users(id),
  total_matches INTEGER DEFAULT 0,
  total_kills INTEGER DEFAULT 0,
  total_deaths INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 7. ディレクトリ構成

```
LaserButlerOnline/
├── client/                     # Phaser 3 ゲーム本体
│   ├── src/
│   │   ├── main.ts             # エントリーポイント
│   │   ├── config.ts           # Phaser設定
│   │   ├── scenes/
│   │   │   ├── BootScene.ts    # 起動・アセット読み込み
│   │   │   ├── LobbyScene.ts   # ロビー・マッチメイキング
│   │   │   ├── GameScene.ts    # メインゲームプレイ
│   │   │   └── ResultScene.ts  # 試合結果
│   │   ├── objects/
│   │   │   ├── Player.ts       # プレイヤークラス
│   │   │   ├── Laser.ts        # レーザークラス（反射ロジック含む）
│   │   │   ├── Map.ts          # マップ・壁・溝
│   │   │   └── items/
│   │   │       ├── Bomb.ts
│   │   │       ├── Dash.ts
│   │   │       ├── MudTrap.ts
│   │   │       └── StoneTrap.ts
│   │   ├── network/
│   │   │   ├── PhotonClient.ts # Photon Realtime接続管理
│   │   │   └── SyncManager.ts  # 同期ロジック
│   │   ├── ui/
│   │   │   ├── VirtualJoystick.ts
│   │   │   ├── HUD.ts
│   │   │   └── Minimap.ts
│   │   └── utils/
│   │       ├── Vector.ts       # ベクトル演算（反射計算）
│   │       └── MobileUtils.ts  # スマホ特有の対策
│   ├── public/
│   │   └── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── server/                     # Cloud Run バックエンド
│   ├── src/
│   │   ├── index.ts            # Fastify/Honoエントリーポイント
│   │   ├── routes/
│   │   │   ├── matches.ts      # 試合結果CRUD
│   │   │   └── rankings.ts     # ランキング取得
│   │   └── db/
│   │       └── supabase.ts     # Supabaseクライアント
│   ├── Dockerfile
│   └── package.json
│
├── GAME_PLAN.md                # 本ドキュメント
└── README.md
```

---

## 8. 主要パラメータ（初期値・要チューニング）

| パラメータ | 初期値 | チューニング方針 |
|---|---|---|
| プレイヤー移動速度 | 200px/sec | 実機テストで調整 |
| 当たり判定半径 | 視覚の70%（例: 見た目20px → 判定14px） | 「ギリギリで避ける」感覚を目標 |
| レーザー弾速 | 600px/sec | 反射が見えるギリギリの速さ |
| レーザー発射間隔 | 0.5秒（2発/秒） | テストプレイで決定 |
| レーザー最大反射回数 | 3回 | 増やすと戦略性UP、減らすと追跡力UP |
| レーザー生存時間 | 2.0秒 | 反射回数上限と併用 |
| リスポーン待機時間 | 3秒 | 短すぎると死にゲー感が薄れる |
| 試合時間 | 120秒（2分） | 1〜3分が適切 |
| マップサイズ | 1600×1200px | スマホ画面の約2.7倍 |
| カメラ追従ズーム | 1.0（等倍） | ミニマップとの見やすさで調整 |
| ボム爆発範囲 | 150px半径 | - |
| ボム爆発遅延 | 1.0秒 | - |
| ダッシュ距離 | 200px | - |
| ダッシュ無敵時間 | 0.3秒 | - |
| マッドトラップ減速率 | 50% / 2.0秒 | - |
| ストーントラップ拘束時間 | 1.2秒 | - |

---

## 9. 技術実装の重要ポイント

### 9.1 レーザー反射実装（コアメカニクス）

```typescript
// Vector.ts
export function reflect(incident: {x: number, y: number}, normal: {x: number, y: number}) {
  // R = I - 2(I・N)N
  const dot = incident.x * normal.x + incident.y * normal.y;
  return {
    x: incident.x - 2 * dot * normal.x,
    y: incident.y - 2 * dot * normal.y,
  };
}
```

Phaser の `Arcade Physics` の `setVelocity` + `setBounce(1)` + `setCollideWorldBounds(true)` で実装し、
壁の角度が斜めの場合のみ手動の法線ベクトル計算を組み合わせる。

### 9.2 スマホ最適化

```typescript
// MobileUtils.ts - スクロール・戻る操作の無効化
export function disableMobileGestures() {
  document.body.style.touchAction = 'none';
  document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  window.addEventListener('popstate', e => e.preventDefault());
}

// フルスクリーン化
export function requestFullscreen() {
  const elem = document.documentElement;
  if (elem.requestFullscreen) elem.requestFullscreen();
}

// AudioContext初期化（自動再生ブロック回避）
export function initAudioOnFirstTouch() {
  document.addEventListener('touchstart', () => {
    const ctx = new AudioContext();
    ctx.resume();
  }, { once: true });
}
```

### 9.3 Photon同期の効率化

```typescript
// SyncManager.ts
const SYNC_RATE = 20; // 20fps で送信（帯域節約）

// 位置が前回から一定以上変化したときのみ送信
const MIN_MOVE_THRESHOLD = 2; // 2px以上動いた場合のみ

sendPlayerState(state) {
  const dx = state.x - this.lastSentState.x;
  const dy = state.y - this.lastSentState.y;
  if (Math.sqrt(dx*dx + dy*dy) < MIN_MOVE_THRESHOLD) return;
  // ... Photon送信
}
```

---

## 10. 開発開始チェックリスト

- [ ] Node.js 20+ インストール確認
- [ ] Vite + TypeScript プロジェクト作成（`npm create vite@latest`）
- [ ] Phaser 3 インストール（`npm install phaser`）
- [ ] phaser3-rex-plugins インストール（バーチャルジョイスティック用）
- [ ] Photon JS SDK 取得（Exit Gamesダッシュボードから）
- [ ] Photon App ID 取得（無料アカウント登録）
- [ ] Supabase プロジェクト作成（supabase.com）
- [ ] Vercel アカウント作成・GitHub連携
- [ ] Google Cloud アカウント作成（Cloud Run用）

---

## 11. 参考：類似ゲームとの比較

| ゲーム | 参考にする要素 |
|---|---|
| Agar.io | トップダウン2D、カメラ追従、シンプルなビジュアル |
| Diep.io | タレット操作（ツインスティック）、マルチプレイヤー同期 |
| Bomberman | 罠・ボムの設置戦術 |
| Geometry Wars | レーザーと反射の視覚的なカオス感 |

---

## まとめ

本ゲームは技術的に十分実現可能であり、各サービスの無料枠内での運用も可能です。
最大のボトルネックは **Photon Realtime の20CCU制限**（最大3試合同時）ですが、
MVP・テスト段階では十分な規模です。ユーザーが増えた段階で有料プランへの移行を検討してください。

開発優先順位は **Phase 1（ローカルゲームロジック）を徹底的に磨く** ことを推奨します。
ネットワーク同期は後から追加できますが、コアゲームプレイが面白くないと何も始まりません。
