# レーザーバトラーオンライン

スマホ向けWebブラウザ2D対戦アクション - ツインスティックシューター

> 詳細な実現可能性分析・実装計画は [GAME_PLAN.md](./GAME_PLAN.md) を参照

## 技術スタック（すべて無料枠）

| レイヤー | 技術 |
|---|---|
| ゲームエンジン | Phaser 3 + TypeScript |
| ビルドツール | Vite |
| ホスティング | Vercel (Hobby) |
| リアルタイム通信 | Photon Realtime |
| バックエンド | Google Cloud Run |
| データベース | Supabase (PostgreSQL) |

## クイックスタート

```bash
# クライアントの起動
cd client
npm install
npm run dev
# → http://localhost:3000 でゲームが動作

# サーバーの起動
cd server
npm install
cp ../.env.example .env  # 環境変数を設定
npm run dev
# → http://localhost:8080 でAPIが動作
```

## ディレクトリ構成

```
LaserButlerOnline/
├── client/       # Phaser 3 ゲーム本体
├── server/       # Cloud Run バックエンドAPI
├── vercel.json   # Vercelデプロイ設定
├── GAME_PLAN.md  # 実現可能性分析・実装計画書
└── .env.example  # 環境変数のテンプレート
```

## 開発フェーズ

- **Phase 1** (現在): ローカル動作プロトタイプ
- **Phase 2**: Photon連携によるオンライン対戦
- **Phase 3**: バックエンド・ランキング機能
- **Phase 4**: バランス調整・本番リリース
