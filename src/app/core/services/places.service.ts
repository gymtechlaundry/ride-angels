import { Injectable } from '@angular/core';
import { getSupabaseClient, isSupabaseConfigured } from '../supabase/supabase-client';
import { PlaceSuggestion, ResolvedPlace } from './places.models';

export type { PlaceSuggestion, ResolvedPlace } from './places.models';

@Injectable({ providedIn: 'root' })
export class PlacesService {
  private sessionToken: string | null = null;

  private ensureSession(): string {
    if (!this.sessionToken) {
      this.sessionToken = crypto.randomUUID();
    }
    return this.sessionToken;
  }

  /** Start a new Places billing session (call when opening a field). */
  refreshSession(): void {
    this.sessionToken = crypto.randomUUID();
  }

  async suggest(input: string): Promise<PlaceSuggestion[]> {
    const q = input.trim();
    if (q.length < 2) return [];
    if (!isSupabaseConfigured()) {
      return this.mockSuggest(q);
    }

    try {
      const { data, error } = await getSupabaseClient().functions.invoke(
        'places-autocomplete',
        {
          body: {
            action: 'suggest',
            input: q,
            sessionToken: this.ensureSession(),
          },
        },
      );
      if (error) {
        console.warn(
          '[places] suggest failed',
          error.message,
          await readFunctionsErrorBody(error),
        );
        return [];
      }
      const payload = asRecord(data);
      if (payload?.['error']) {
        console.warn('[places] suggest rejected', payload['error'], payload['message']);
        return [];
      }
      return (payload?.['suggestions'] as PlaceSuggestion[] | undefined) ?? [];
    } catch (err) {
      console.warn('[places] suggest error', err);
      return [];
    }
  }

  async resolve(placeId: string): Promise<ResolvedPlace | null> {
    if (!placeId.trim()) return null;
    if (!isSupabaseConfigured()) {
      return {
        placeId,
        formattedAddress: placeId,
        displayName: placeId,
        line1: placeId,
      };
    }

    try {
      const { data, error } = await getSupabaseClient().functions.invoke(
        'places-autocomplete',
        {
          body: {
            action: 'details',
            placeId,
            sessionToken: this.ensureSession(),
          },
        },
      );
      if (error) {
        console.warn(
          '[places] details failed',
          error.message,
          await readFunctionsErrorBody(error),
        );
        return null;
      }
      const payload = asRecord(data);
      if (payload?.['error']) {
        console.warn('[places] details rejected', payload['error']);
        return null;
      }
      const place = payload?.['place'] as ResolvedPlace | undefined;
      if (!place?.formattedAddress) return null;
      // End session after a successful selection (Places session billing).
      this.refreshSession();
      return {
        ...place,
        latitude: place.latitude ?? undefined,
        longitude: place.longitude ?? undefined,
        city: place.city ?? undefined,
        state: place.state ?? undefined,
        postalCode: place.postalCode ?? undefined,
      };
    } catch (err) {
      console.warn('[places] details error', err);
      return null;
    }
  }

  private mockSuggest(q: string): PlaceSuggestion[] {
    const samples = [
      '123 Main St, Nassau, NY 11550, USA',
      '1 Hospital Rd, East Meadow, NY 11554, USA',
      '200 Old Country Rd, Mineola, NY 11501, USA',
      '900 Stewart Ave, Garden City, NY 11530, USA',
    ];
    return samples
      .filter((s) => s.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 5)
      .map((fullText, i) => {
        const [primary, ...rest] = fullText.split(',');
        return {
          placeId: `mock-${i}-${primary}`,
          primaryText: primary.trim(),
          secondaryText: rest.join(',').trim(),
          fullText,
        };
      });
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

async function readFunctionsErrorBody(error: unknown): Promise<unknown> {
  const ctx = (error as { context?: Response } | null)?.context;
  if (!ctx || typeof ctx.json !== 'function') {
    return undefined;
  }
  try {
    return await ctx.clone().json();
  } catch {
    try {
      return await ctx.text();
    } catch {
      return undefined;
    }
  }
}
