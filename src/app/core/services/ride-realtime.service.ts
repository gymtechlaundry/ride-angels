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
  private pendingTables = new Set<string>();

  startForCurrentUser(onChange: (table: string) => void): void {
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

      const notify = (table: string) => {
        this.pendingTables.add(table);
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
          const tables = [...this.pendingTables];
          this.pendingTables.clear();
          // Prefer ride-domain tables over notifications when both fire together.
          const rideTable = tables.find((t) => t !== 'notifications');
          onChange(rideTable ?? tables[0] ?? 'notifications');
        }, 400);
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
          () => notify('notifications'),
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ride_requests' },
          () => notify('ride_requests'),
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'appointments' },
          () => notify('appointments'),
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ride_offers' },
          () => notify('ride_offers'),
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ride_assignments' },
          () => notify('ride_assignments'),
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'ride_angel_connections' },
          () => notify('ride_angel_connections'),
        )
        .subscribe();
    });
  }

  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.pendingTables.clear();
    if (this.channel && isSupabaseConfigured()) {
      void getSupabaseClient().removeChannel(this.channel);
    }
    this.channel = null;
    this.userId = null;
  }
}
