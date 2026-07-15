import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Settings } from '../types.ts';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? 'https://gvpnrasaurhncwimdemw.supabase.co';
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? 'sb_publishable_znmztYzSn9MjcmMs5oV3vQ_qofm8593';

export interface CloudProfile {
  id: string;
  nickname: string;
  skin_id: string;
  unlocked_skins: string[];
  settings: Partial<Settings>;
}

export interface LeaderboardRow {
  nickname: string;
  score: number;
  created_at: string;
}

/**
 * Thin wrapper around Supabase for the global leaderboard + cross-device
 * profile sync. Every method fails soft: if the network, the project, or
 * anonymous auth isn't available, callers get null/[]/no-op instead of a
 * thrown error, and the game keeps running entirely on localStorage.
 */
class CloudSync {
  private client: SupabaseClient;
  private userId: string | null = null;
  online = false;
  ready: Promise<CloudProfile | null>;

  constructor() {
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    this.ready = this.init();
  }

  private async init(): Promise<CloudProfile | null> {
    try {
      const { data: sessionData } = await this.client.auth.getSession();
      let session = sessionData.session;
      if (!session) {
        const { data, error } = await this.client.auth.signInAnonymously();
        if (error) throw error;
        session = data.session;
      }
      if (!session?.user) return null;
      this.userId = session.user.id;
      this.online = true;
      return await this.fetchProfile();
    } catch (err) {
      this.online = false;
      console.warn('[theWIND cloud] running local-only:', err instanceof Error ? err.message : err);
      return null;
    }
  }

  private async fetchProfile(): Promise<CloudProfile | null> {
    if (!this.userId) return null;
    try {
      const { data, error } = await this.client.from('players').select('*').eq('id', this.userId).maybeSingle();
      if (error) throw error;
      return data as CloudProfile | null;
    } catch (err) {
      this.online = false;
      console.warn('[theWIND cloud] profile fetch failed:', err instanceof Error ? err.message : err);
      return null;
    }
  }

  async updateProfile(patch: Partial<Pick<CloudProfile, 'skin_id' | 'unlocked_skins' | 'settings'>>): Promise<void> {
    if (!this.online || !this.userId) return;
    try {
      const { error } = await this.client.from('players').update(patch).eq('id', this.userId);
      if (error) throw error;
    } catch (err) {
      console.warn('[theWIND cloud] profile update failed:', err instanceof Error ? err.message : err);
    }
  }

  async submitScore(mode: string, score: number): Promise<void> {
    if (!this.online || !this.userId) return;
    try {
      const { error } = await this.client.from('scores').insert({ player_id: this.userId, mode, score });
      if (error) throw error;
    } catch (err) {
      console.warn('[theWIND cloud] score submit failed:', err instanceof Error ? err.message : err);
    }
  }

  /** Global top scores for a mode, or null if the leaderboard couldn't be reached (distinct from "genuinely empty"). */
  async fetchLeaderboard(mode: string, limit = 10): Promise<LeaderboardRow[] | null> {
    try {
      const { data, error } = await this.client.rpc('get_leaderboard', { p_mode: mode, p_limit: limit });
      if (error) throw error;
      return (data ?? []) as LeaderboardRow[];
    } catch (err) {
      console.warn('[theWIND cloud] leaderboard fetch failed:', err instanceof Error ? err.message : err);
      return null;
    }
  }

  /** This player's own personal-best score per mode (used to compute skin unlocks across devices). */
  async fetchMyBestScores(): Promise<Record<string, number>> {
    if (!this.online) return {};
    try {
      const { data, error } = await this.client.rpc('get_my_best_scores');
      if (error) throw error;
      const out: Record<string, number> = {};
      for (const row of (data ?? []) as { mode: string; best_score: number }[]) out[row.mode] = row.best_score;
      return out;
    } catch (err) {
      console.warn('[theWIND cloud] best-scores fetch failed:', err instanceof Error ? err.message : err);
      return {};
    }
  }
}

export const cloud = new CloudSync();
