import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  ActionSheetController,
  AlertController,
  IonContent,
  IonHeader,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent,
  ToastController,
} from '@ionic/angular/standalone';
import { Capacitor } from '@capacitor/core';
import {
  Camera,
  CameraResultType,
  CameraSource,
} from '@capacitor/camera';
import {
  CalendarProviderId,
  ExternalCalendarInfo,
} from '../../core/models/calendar';
import { AuthService } from '../../core/services/auth.service';
import { CalendarSyncService } from '../../core/services/calendar-sync.service';
import { DomainSyncService } from '../../core/services/domain-sync.service';
import { PartnerLinksService, NotificationPreferencesService } from '../../core/services/notification-preferences.service';
import { PushRegistrationService } from '../../core/services/push-registration.service';
import { NotificationService } from '../../core/services/notification.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ProfileAvatarComponent } from '../../shared/components/profile-avatar/profile-avatar.component';
import { PrimaryButtonComponent } from '../../shared/components/primary-button/primary-button.component';
import { environment } from '../../../environments/environment';
import {
  STUDIO_COPYRIGHT,
  STUDIO_CREDIT,
  STUDIO_URL,
} from '../../core/config/studio';

export interface CalendarProviderRow {
  id: CalendarProviderId;
  label: string;
  connected: boolean;
  selectedName: string | null;
  canConnect: boolean;
  supportsPicker: boolean;
}

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [
    IonHeader,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    ReactiveFormsModule,
    PageHeaderComponent,
    ProfileAvatarComponent,
    PrimaryButtonComponent,
  ],
  templateUrl: './profile.page.html',
  styleUrl: './profile.page.scss',
})
export class ProfilePage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly calendarSync = inject(CalendarSyncService);
  private readonly partnerLinks = inject(PartnerLinksService);
  private readonly notifPrefs = inject(NotificationPreferencesService);
  private readonly notifications = inject(NotificationService);
  private readonly push = inject(PushRegistrationService);
  private readonly domainSync = inject(DomainSyncService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastController);
  private readonly alert = inject(AlertController);
  private readonly actionSheet = inject(ActionSheetController);
  private readonly fb = inject(FormBuilder);

  readonly user = computed(() => this.auth.getCurrentUserOrNull());
  readonly persona = this.auth.activePersona;
  readonly prefs = this.calendarSync.prefs;
  readonly calendars = signal<ExternalCalendarInfo[]>([]);
  readonly showCalendarPicker = signal(false);
  readonly calendarBusy = signal(false);
  readonly appsBusy = signal(false);
  readonly profileBusy = signal(false);
  readonly pushBusy = signal(false);
  readonly editing = signal(false);
  readonly isNative = Capacitor.isNativePlatform();
  readonly isIosNative =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  readonly isAndroidNative =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  /** Device calendar (EventKit / CalendarContract) available on native builds. */
  readonly deviceCalendarAvailable = this.isIosNative || this.isAndroidNative;

  readonly partnerLinkRows = this.partnerLinks.links;
  readonly pushStatus = this.push.status;
  readonly inAppChannelEnabled = computed(() => {
    void this.notifPrefs.preferences();
    return this.notifPrefs.isChannelEnabled('in_app');
  });
  readonly channelBusy = signal(false);
  readonly studioCredit = STUDIO_CREDIT;
  readonly studioCopyright = STUDIO_COPYRIGHT;
  readonly studioUrl = STUDIO_URL;

  /** Provider rows for Profile — device now; Google when env flag is on. */
  readonly calendarRows = computed((): CalendarProviderRow[] => {
    const prefs = this.prefs();
    const rows: CalendarProviderRow[] = [];

    const deviceConnected =
      prefs?.preferredProvider === 'apple' &&
      prefs.connectionStatus === 'connected';
    if (this.deviceCalendarAvailable || deviceConnected) {
      rows.push({
        id: 'apple',
        label: this.isAndroidNative ? 'Device calendar' : 'Apple Calendar',
        connected: deviceConnected,
        selectedName: deviceConnected
          ? (prefs?.selectedCalendarName ?? null)
          : null,
        canConnect: this.deviceCalendarAvailable && !deviceConnected,
        supportsPicker: true,
      });
    }

    if (environment.googleCalendar.enabled) {
      const googleConnected =
        prefs?.preferredProvider === 'google' &&
        prefs.connectionStatus === 'connected';
      rows.push({
        id: 'google',
        label: 'Google Calendar',
        connected: googleConnected,
        selectedName: googleConnected
          ? (prefs?.selectedCalendarName ??
            prefs?.googleAccountEmail ??
            null)
          : null,
        canConnect: !googleConnected,
        supportsPicker: true,
      });
    }

    return rows;
  });

  readonly anyCalendarConnected = computed(() =>
    this.calendarRows().some((row) => row.connected),
  );

  /** Show Change / picker only when more than one writable calendar exists. */
  readonly canChangeCalendar = computed(() => this.calendars().length > 1);

  readonly editForm = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
  });

  readonly signInMethods = computed(() => {
    void this.auth.currentUser();
    return this.auth.getLinkedSignInMethods();
  });
  readonly phoneMethod = computed(
    () => this.signInMethods().find((m) => m.channel === 'phone') ?? null,
  );
  readonly emailMethod = computed(
    () => this.signInMethods().find((m) => m.channel === 'email') ?? null,
  );

  async ngOnInit(): Promise<void> {
    this.syncEditForm();
    await Promise.all([
      this.calendarSync.loadPreferences(),
      this.partnerLinks.load(),
      this.notifPrefs.load(),
      this.push.refreshStatus(),
    ]);
    // Connected means syncing — no separate pause toggle.
    if (this.anyCalendarConnected() && !this.prefs()?.syncEnabled) {
      await this.calendarSync.savePreferences({ syncEnabled: true });
    }
    if (this.anyCalendarConnected()) {
      await this.refreshCalendars();
    }
  }

  ionViewWillEnter(): void {
    void this.push.refreshStatus();
    void this.partnerLinks.load();
    void this.notifPrefs.load();
    if (this.anyCalendarConnected()) {
      void this.refreshCalendars();
    }
    if (this.editing()) {
      this.syncEditForm();
    }
  }

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      await Promise.all([
        this.calendarSync.loadPreferences(),
        this.partnerLinks.load(),
        this.notifPrefs.load(),
        this.push.refreshStatus(),
        this.domainSync.refreshForCurrentUser({ force: true }),
      ]);
      if (this.anyCalendarConnected()) {
        await this.refreshCalendars();
      }
    } finally {
      event.target.complete();
    }
  }

  pushStatusLabel(): string {
    return this.push.statusLabel();
  }

  calendarConnectLabel(_id: CalendarProviderId = 'apple'): string {
    return 'Connect';
  }

  calendarHelpText(): string {
    return this.isAndroidNative
      ? 'Sync appointments and claimed drives to the calendar on this phone.'
      : 'Sync appointments and claimed drives to Apple Calendar.';
  }

  calendarEmptyHelp(): string {
    if (this.calendarRows().length > 0) {
      return this.calendarHelpText();
    }
    return 'Available in the iOS or Android app.';
  }

  methodStatusLabel(status: string | undefined): string {
    switch (status) {
      case 'verified':
        return 'Verified';
      case 'pending':
        return 'Pending verification';
      default:
        return 'Not added';
    }
  }

  startEdit(): void {
    this.syncEditForm();
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.syncEditForm();
    this.editing.set(false);
  }

  manageSignIn(channel: 'phone' | 'email'): void {
    void this.router.navigate(['/account/security'], {
      queryParams: { change: channel },
    });
  }

  async switchMode(persona: 'rider' | 'angel'): Promise<void> {
    if (this.persona() === persona || this.profileBusy()) {
      return;
    }
    this.profileBusy.set(true);
    try {
      await this.auth.setDefaultPersona(persona);
      await this.showToast(
        persona === 'angel'
          ? 'Ride Angel mode — Home shows drives; Calendar shows open requests.'
          : 'Rider mode — Home shows your rides and appointments.',
      );
    } catch (err) {
      await this.showToast(
        err instanceof Error ? err.message : 'Could not switch mode.',
        'danger',
      );
    } finally {
      this.profileBusy.set(false);
    }
  }

  async saveProfile(): Promise<void> {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    this.profileBusy.set(true);
    try {
      const value = this.editForm.getRawValue();
      await this.auth.updateProfile({
        firstName: value.firstName,
        lastName: value.lastName,
      });
      this.editing.set(false);
      await this.showToast('Profile updated.');
    } catch (err) {
      await this.showToast(
        err instanceof Error ? err.message : 'Could not save profile.',
        'danger',
      );
    } finally {
      this.profileBusy.set(false);
    }
  }

  async changePhoto(): Promise<void> {
    if (this.profileBusy() || !this.isNative) {
      return;
    }

    const sheet = await this.actionSheet.create({
      header: 'Profile photo',
      buttons: [
        {
          text: 'Take photo',
          handler: () => {
            void this.captureAvatar(CameraSource.Camera);
          },
        },
        {
          text: 'Choose from library',
          handler: () => {
            void this.captureAvatar(CameraSource.Photos);
          },
        },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  async onAvatarSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }
    this.profileBusy.set(true);
    try {
      await this.auth.uploadAvatar(file);
      await this.showToast('Photo updated.');
    } catch (err) {
      await this.showToast(
        err instanceof Error ? err.message : 'Could not upload photo.',
        'danger',
      );
    } finally {
      this.profileBusy.set(false);
    }
  }

  private async captureAvatar(source: CameraSource): Promise<void> {
    this.profileBusy.set(true);
    try {
      const photo = await Camera.getPhoto({
        quality: 85,
        width: 1280,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source,
        saveToGallery: false,
      });
      if (!photo.dataUrl) {
        throw new Error('No photo was captured.');
      }
      await this.auth.uploadAvatarFromDataUrl(photo.dataUrl);
      await this.showToast('Photo updated.');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/cancel/i.test(message)) {
        return;
      }
      await this.showToast(message || 'Could not upload photo.', 'danger');
    } finally {
      this.profileBusy.set(false);
    }
  }

  openDiscussion(): void {
    void this.router.navigate(['/tabs/profile/discussion']);
  }

  openSecurity(): void {
    void this.router.navigate(['/account/security']);
  }

  openNotifications(): void {
    void this.router.navigate(['/account/notifications']);
  }

  openNotificationSettings(): void {
    void this.push.openSystemSettings();
  }

  async onInAppToggle(enabled: boolean): Promise<void> {
    if (this.channelBusy()) {
      return;
    }
    this.channelBusy.set(true);
    try {
      await this.notifPrefs.setChannel('in_app', enabled);
      await this.notifications.refreshForCurrentUser();
      await this.showToast(
        enabled
          ? 'In-app notifications turned on.'
          : 'In-app notifications turned off.',
      );
    } catch (err) {
      await this.showToast(
        err instanceof Error ? err.message : 'Could not update preference.',
        'danger',
      );
      await this.notifPrefs.load();
    } finally {
      this.channelBusy.set(false);
    }
  }

  async onPushToggle(enabled: boolean): Promise<void> {
    if (this.pushBusy()) {
      return;
    }
    this.pushBusy.set(true);
    try {
      if (!enabled) {
        await this.push.disable();
        await this.showToast('Push notifications turned off on this device.');
        return;
      }

      const result = await this.push.enable();
      if (!result.ready) {
        await this.push.refreshStatus();
        if (this.push.status() === 'denied') {
          const sheet = await this.alert.create({
            header: 'Notifications blocked',
            message:
              'Enable notifications for Ride Angels in system settings, then tap Turn on again.',
            buttons: [
              { text: 'Not now', role: 'cancel' },
              {
                text: 'Open Settings',
                handler: () => {
                  void this.push.openSystemSettings();
                },
              },
            ],
          });
          await sheet.present();
          return;
        }
        await this.showToast(
          result.reason || 'Unable to enable push.',
          'danger',
        );
        return;
      }

      const choose = await this.alert.create({
        header: 'Push is on',
        message: 'Choose which events should alert you on this device.',
        buttons: [
          { text: 'Later', role: 'cancel' },
          {
            text: 'Choose events',
            handler: () => {
              void this.router.navigate(['/account/notifications']);
            },
          },
        ],
      });
      await choose.present();
    } finally {
      this.pushBusy.set(false);
      await this.push.refreshStatus();
    }
  }

  async connectProvider(id: CalendarProviderId): Promise<void> {
    if (id === 'google' && !environment.googleCalendar.enabled) {
      await this.showToast(
        'Google Calendar sync is not available in this version.',
        'danger',
      );
      return;
    }
    this.calendarBusy.set(true);
    try {
      const result = await this.calendarSync.connectProvider(id);
      if (!result.ok) {
        await this.showToast(
          result.message || 'Could not connect calendar.',
          'danger',
        );
        return;
      }
      await this.refreshCalendars();
      // Only ask to choose when there are multiple writable calendars.
      if (this.calendars().length > 1) {
        this.showCalendarPicker.set(true);
        await this.showToast(
          'Connected. Pick which calendar should receive events.',
        );
      } else {
        this.showCalendarPicker.set(false);
        const name = this.prefs()?.selectedCalendarName;
        await this.showToast(
          name ? `Connected to ${name}.` : 'Calendar connected.',
        );
      }
    } finally {
      this.calendarBusy.set(false);
    }
  }

  async toggleCalendarPicker(row?: CalendarProviderRow): Promise<void> {
    if (this.showCalendarPicker()) {
      this.showCalendarPicker.set(false);
      return;
    }
    if (row && !row.supportsPicker) {
      return;
    }
    this.calendarBusy.set(true);
    try {
      await this.refreshCalendars();
      if (this.calendars().length <= 1) {
        this.showCalendarPicker.set(false);
        return;
      }
      this.showCalendarPicker.set(true);
    } finally {
      this.calendarBusy.set(false);
    }
  }

  async selectCalendar(cal: ExternalCalendarInfo): Promise<void> {
    this.calendarBusy.set(true);
    try {
      await this.calendarSync.selectCalendar(cal);
      this.showCalendarPicker.set(false);
      await this.showToast(`Saving events to ${cal.name}.`);
    } catch (err) {
      await this.showToast(
        err instanceof Error ? err.message : 'Could not save calendar choice.',
        'danger',
      );
      await this.calendarSync.loadPreferences();
    } finally {
      this.calendarBusy.set(false);
    }
  }

  async disconnectCalendar(): Promise<void> {
    this.calendarBusy.set(true);
    try {
      await this.calendarSync.disconnect();
      this.calendars.set([]);
      this.showCalendarPicker.set(false);
      await this.showToast('Calendar sync disconnected.');
    } finally {
      this.calendarBusy.set(false);
    }
  }

  async unlinkPartner(partnerId: string, partnerName: string): Promise<void> {
    const confirm = await this.alert.create({
      header: `Unlink ${partnerName}?`,
      message: `Appointments will no longer sync from ${partnerName} into Ride Angels.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Unlink', role: 'destructive' },
      ],
    });
    await confirm.present();
    const { role } = await confirm.onDidDismiss();
    if (role !== 'destructive') {
      return;
    }

    this.appsBusy.set(true);
    try {
      await this.partnerLinks.unlink(partnerId);
      await this.showToast(`${partnerName} unlinked.`);
    } catch (err) {
      await this.showToast(
        err instanceof Error ? err.message : 'Could not unlink app.',
        'danger',
      );
    } finally {
      this.appsBusy.set(false);
    }
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl('/auth', { replaceUrl: true });
  }

  private syncEditForm(): void {
    const u = this.user();
    if (!u) {
      return;
    }
    this.editForm.patchValue({
      firstName: u.firstName,
      lastName: u.lastName,
    });
  }

  private async refreshCalendars(): Promise<void> {
    try {
      const list = await this.calendarSync.listCalendarsForPreferred();
      this.calendars.set(list);
    } catch {
      this.calendars.set([]);
    }
  }

  private async showToast(
    message: string,
    color: 'primary' | 'danger' = 'primary',
  ): Promise<void> {
    const toast = await this.toast.create({
      message,
      duration: 2200,
      position: 'top',
      color,
    });
    await toast.present();
  }
}
