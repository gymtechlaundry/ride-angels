export const environment = {
  production: false,
  organizationsEnabled: false,
  /**
   * Public Supabase client config only — never put service_role here.
   * Leave url/anonKey empty to use the local OTP mock adapter for UI development.
   */
  supabase: {
    url: 'https://zuvfzmpdmjwewcuyxtac.supabase.co',
    anonKey: 'sb_publishable_iXAHE2iJnTpgxYQKglqE9A_5TJdS9lS',
  },
  /** Default dial code for phone entry UI */
  defaultCountryCallingCode: '+1',
  /**
   * Google Calendar OAuth (PKCE) — disabled for V1 (Apple Calendar only).
   * Set enabled: true and fill client IDs when shipping Google sync later.
   */
  googleCalendar: {
    enabled: false,
    iosClientId: '',
    webClientId: '',
    redirectUri: 'org.rideangels.app://google-calendar-oauth',
  },
  /**
   * Emails treated as app creator when profile.is_app_creator is not yet set.
   * Server moderation still requires profiles.is_app_creator = true.
   */
  appCreatorEmails: ['devin@hyperionappstudio.com'],
};
