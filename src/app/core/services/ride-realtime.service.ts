import { Injectable } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from '../supabase/supabase-client';

/**
 * Selective Realtime for rows the signed-in user can already read via RLS.
 * Core correctness must still work after a full refresh (DomainSync).
 */
@Injectable({ providedIn: 'root' })
export class RideRealtimeService {
  private channel: RealtimeChannel | null = null;
  private userId: string | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  startForCurrentUser(onChange: () => void): void {
    if (!isSupabaseConfigured()) {
      return;
    }
    const client = getSupabaseClient();
    void client.auth.getUser().then(({ data }) => {
      const id = data.user?.id;
      if (!id) {
        return;
      }
      if (this.channel && this.userId === id) {
        return;
      }
      this.stop();
      this.userId = id;

      const notify = () => {
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => onChange(), 400);
      };

      this.channel = client
        .channel(`ra-user-${id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `recipient_profile_id=eq.${id}`,
          },
          notify,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ride_requests' },
          notify,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'appointments' },
          notify,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ride_offers' },
          notify,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ride_assignments' },
          notify,
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ride_angel_connections' },
          notify,
        )
        .subscribe();
    });
  }

  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.channel && isSupabaseConfigured()) {
      void getSupabaseClient().removeChannel(this.channel);
    }
    this.channel = null;
    this.userId = null;
  }
}
