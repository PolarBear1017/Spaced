import { supabase } from '../supabase';

export async function syncDailyReview({ userId, progress, pendingGoal, pendingRecovery = null }) {
  const { data: auth, error: authError } = await supabase.auth.getSession();
  if (authError || auth.session?.user?.id !== userId) throw new Error('Review account changed');
  const { data, error } = await supabase.rpc('sync_daily_review', {
    ...(pendingRecovery !== null ? { p_recovery_choice: pendingRecovery.mode } : {}),
    p_days: progress.days,
    p_goal: pendingGoal,
    p_initial_goal: progress.goal,
    p_timezone: progress.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  }).setHeader('Authorization', `Bearer ${auth.session.access_token}`);
  if (error) throw error;
  return data;
}
