import { Component, OnInit, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  AlertController,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonToggle,
  RefresherCustomEvent,
  ToastController,
} from '@ionic/angular/standalone';
import {
  NOTIFICATION_PREF_GROUPS,
  NotificationPreferencesService,
} from '../../core/services/notification-preferences.service';
import { PushRegistrationService } from '../../core/services/push-registration.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { PrimaryButtonComponent } from '../../shared/components/primary-button/primary-button.component';

@Component({
  selector: 'app-notification-settings-page',
  standalone: true,
  imports: [
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonToggle,
    PageHeaderComponent,
    PrimaryButtonComponent,
  ],
  templateUrl: './notification-settings.page.html',
  styleUrl: './notification-settings.page.scss',
})
export class NotificationSettingsPage implements OnInit {
  private readonly notifPrefs = inject(NotificationPreferencesService);
  private readonly push = inject(PushRegistrationService);
  private readonly toast = inject(ToastController);
  private readonly alert = inject(AlertController);

  readonly groups = NOTIFICATION_PREF_GROUPS;
  readonly isNative = Capacitor.isNativePlatform();
  readonly pushBusy = signal(false);
  readonly pushStatus = this.push.status;
  readonly loaded = this.notifPrefs.loaded;

  async ngOnInit(): Promise<void> {
    await Promise.all([this.notifPrefs.load(), this.push.refreshStatus()]);
  }

  ionViewWillEnter(): void {
    void this.push.refreshStatus();
  }

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      await Promise.all([this.notifPrefs.load(), this.push.refreshStatus()]);
    } finally {
      event.target.complete();
    }
  }

  pushStatusLabel(): string {
    return this.push.statusLabel();
  }

  isEnabled(type: string): boolean {
    return this.notifPrefs.isEnabled(type);
  }

  async onDeviceToggle(enabled: boolean): Promise<void> {
    if (this.pushBusy()) return;
    this.pushBusy.set(true);
    try {
      if (!enabled) {
        await this.push.disable();
        await this.showToast('Push turned off on this device.');
        return;
      }
      const result = await this.push.enable();
      if (!result.ready) {
        await this.push.refreshStatus();
        if (this.push.status() === 'denied') {
          const sheet = await this.alert.create({
            header: 'Notifications blocked',
            message:
              'Enable notifications for Ride Angels in system settings, then try again.',
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
      await this.showToast('Push is on for this device.');
    } finally {
      this.pushBusy.set(false);
      await this.push.refreshStatus();
    }
  }

  openSystemSettings(): void {
    void this.push.openSystemSettings();
  }

  async onToggle(type: string, enabled: boolean): Promise<void> {
    try {
      await this.notifPrefs.setType(type, enabled);
    } catch (err) {
      await this.showToast(
        err instanceof Error ? err.message : 'Unable to save preference.',
        'danger',
      );
      await this.notifPrefs.load();
    }
  }

  private async showToast(
    message: string,
    color: 'primary' | 'danger' = 'primary',
  ): Promise<void> {
    const toast = await this.toast.create({
      message,
      duration: 2500,
      position: 'top',
      color,
    });
    await toast.present();
  }
}
