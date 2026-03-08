import { Hono } from 'hono';
import { supabase } from '../db/supabase';

export const rankingsRouter = new Hono();

/** キル数ランキングを取得 */
rankingsRouter.get('/', async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') ?? '50'), 100);

  const { data, error } = await supabase
    .from('user_stats')
    .select('user_id, users(display_name), total_kills, wins, total_matches')
    .order('total_kills', { ascending: false })
    .limit(limit);

  if (error) {
    return c.json({ error: 'Failed to fetch rankings' }, 500);
  }

  return c.json({ rankings: data });
});
