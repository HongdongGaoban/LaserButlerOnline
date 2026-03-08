import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { matchesRouter } from './routes/matches';
import { rankingsRouter } from './routes/rankings';

const app = new Hono();

// CORS設定（Vercelのフロントエンドからのアクセスを許可）
app.use('*', cors({
  origin: [
    'http://localhost:3000',
    process.env.FRONTEND_URL ?? 'https://your-app.vercel.app',
  ],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ヘルスチェック（Supabase自動停止防止のcronからも呼ばれる）
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ルーターを登録
app.route('/matches', matchesRouter);
app.route('/rankings', rankingsRouter);

// Cloud Runはポート8080でLISTEN
const port = parseInt(process.env.PORT ?? '8080');
console.log(`Server running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
