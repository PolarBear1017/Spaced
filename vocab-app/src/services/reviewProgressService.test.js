import { beforeEach, describe, expect, it, vi } from 'vitest';
const { getSession, rpc } = vi.hoisted(() => ({getSession:vi.fn(), rpc:vi.fn()}));
vi.mock('../supabase', () => ({supabase:{auth:{getSession}, rpc}}));
import { syncDailyReview } from './reviewProgressService';
beforeEach(() => { vi.resetAllMocks(); });
describe('review progress API', () => {
  it('does not upload a previous account’s cache after an account switch', async () => {
    getSession.mockResolvedValue({data:{session:{user:{id:'new-user'}}}});
    await expect(syncDailyReview({userId:'old-user',progress:{goal:5,days:{}}})).rejects.toThrow('account changed');
    expect(rpc).not.toHaveBeenCalled();
  });
  it('uses the authenticated RPC for valid anonymous and registered sessions', async () => {
    getSession.mockResolvedValue({data:{session:{user:{id:'user',is_anonymous:true},access_token:'test-token'}}});
    const progress = {goal:5, timezone:'Asia/Taipei',days:{}};
    const setHeader = vi.fn().mockResolvedValue({data:progress,error:null});
    rpc.mockReturnValue({setHeader});
    await expect(syncDailyReview({userId:'user',progress,pendingGoal:null})).resolves.toEqual(progress);
    expect(setHeader).toHaveBeenCalledWith('Authorization', 'Bearer test-token');
    expect(rpc).toHaveBeenCalledWith('sync_daily_review',{p_days:{},p_goal:null,p_initial_goal:5,p_timezone:'Asia/Taipei'});
  });
  it('propagates database errors so pending work stays available for retry', async () => {
    getSession.mockResolvedValue({data:{session:{user:{id:'user'},access_token:'test-token'}}});
    rpc.mockReturnValue({setHeader:vi.fn().mockResolvedValue({error:new Error('network failure')})});
    await expect(syncDailyReview({userId:'user',progress:{goal:10,timezone:'UTC',days:{}},pendingGoal:20})).rejects.toThrow('network failure');
  });
});

it('sends the optional recovery choice without changing the permanent goal', async () => {
  getSession.mockResolvedValue({data:{session:{user:{id:'user'},access_token:'test-token'}}});
  rpc.mockReturnValue({setHeader:vi.fn().mockResolvedValue({data:{goal:20,days:{}},error:null})});
  await syncDailyReview({userId:'user',progress:{goal:20,timezone:'Asia/Taipei',days:{}},pendingGoal:null,pendingRecovery:{mode:'regular',day:'2026-10-13'}});
  expect(rpc).toHaveBeenCalledWith('sync_daily_review',{p_days:{},p_goal:null,p_initial_goal:20,p_timezone:'Asia/Taipei',p_recovery_choice:'regular'});
});
