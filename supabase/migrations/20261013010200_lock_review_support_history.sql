-- Supabase's default table grants include DELETE/TRUNCATE. Keep protection
-- history available for monthly accounting; account deletion still cascades.
revoke delete, truncate on public.review_days, public.review_preferences from authenticated, anon;
