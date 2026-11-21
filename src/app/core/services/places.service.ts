import { Injectable } from '@angular/core';
import { getSupabaseClient, isSupabaseConfigured } from '../supabase/supabase-client';

export interface PlaceSuggestion {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  fullText: string;
}

export interface ResolvedPlace {
  placeId: string;
  formattedAddress: string;
  displayName: string;
  line1: string;
  city?: string;
  state?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
}

@Injectable({ providedIn: 'root' })
export class PlacesService {
  private sessionToken = crypto.randomUUID();

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
            sessionToken: this.sessionToken,
          },
        },
      );
      if (error) {
        console.warn('[places] suggest failed', error.message);
        return [];
      }
      if (data?.error === 'places_not_configured') {
        return [];
      }
      return (data?.suggestions ?? []) as PlaceSuggestion[];
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
            sessionToken: this.sessionToken,
          },
        },
      );
      if (error) {
        console.warn('[places] details failed', error.message);
        return null;
      }
      const place = data?.place as ResolvedPlace | undefined;
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
