import { Hono } from 'hono';
import { supabase } from '../db/supabase';

export const matchesRouter = new Hono();

interface MatchResultPayload {
  matchId: string;
  mapId: string;
  mode: string;
  startedAt: string;
  endedAt: string;
  results: Array<{
    userId: string;
    displayName: string;
    rank: number;
    kills: number;
    deaths: number;
  }>;
}

/** 試合結果を保存 */
matchesRouter.post('/', async (c) => {
  let payload: MatchResultPayload;
  try {
    payload = await c.req.json<MatchResultPayload>();
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400);
  }

  // 試合レコードを挿入
  const { data: match, error: matchError } = await supabase
    .from('matches')
    .insert({
      id: payload.matchId,
      map_id: payload.mapId,
      mode: payload.mode,
      started_at: payload.startedAt,
      ended_at: payload.endedAt,
    })
    .select()
    .single();

  if (matchError) {
    console.error('Failed to insert match:', matchError);
    return c.json({ error: 'Failed to save match' }, 500);
  }

  // 各プレイヤーの結果を挿入
  const resultRows = payload.results.map(r => ({
    match_id: match.id,
    user_id: r.userId,
    rank: r.rank,
    kills: r.kills,
    deaths: r.deaths,
  }));

  const { error: resultError } = await supabase
    .from('match_results')
    .insert(resultRows);

  if (resultError) {
    console.error('Failed to insert match results:', resultError);
    return c.json({ error: 'Failed to save results' }, 500);
  }

  // ユーザー統計を更新（UPSERT）
  for (const r of payload.results) {
    await supabase.rpc('upsert_user_stats', {
      p_user_id: r.userId,
      p_kills: r.kills,
      p_deaths: r.deaths,
      p_won: r.rank === 1 ? 1 : 0,
    });
  }

  return c.json({ success: true, matchId: match.id });
});

/** 最近の試合一覧を取得 */
matchesRouter.get('/', async (c) => {
  const { data, error } = await supabase
    .from('matches')
    .select('*, match_results(*)')
    .order('started_at', { ascending: false })
    .limit(20);

  if (error) {
    return c.json({ error: 'Failed to fetch matches' }, 500);
  }

  return c.json({ matches: data });
});
