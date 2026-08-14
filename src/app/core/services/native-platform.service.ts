import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { App } from '@capacitor/app';
import { NotificationService } from './notification.service';

/**
 * Native shell bootstrap for iOS/Android.
 * No-ops safely when running in a browser during local checks.
 */
@Injectable({ providedIn: 'root' })
export class NativePlatformService {
  private readonly notifications = inject(NotificationService);

  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    try {
      await StatusBar.setStyle({ style: Style.Dark });
      if (Capacitor.getPlatform() === 'android') {
        await StatusBar.setBackgroundColor({ color: '#F5F6FA' });
      }
    } catch {
      // StatusBar may be unavailable on some simulators
    }

    try {
      // Ionic resize keeps ion-content scrollable above the keyboard on
      // fullscreen auth screens (body resize alone often covers OTP fields).
      await Keyboard.setResizeMode({ mode: KeyboardResize.Ionic });
      void Keyboard.addListener('keyboardWillShow', () => {
        this.scrollFocusedFieldIntoView();
      });
      void Keyboard.addListener('keyboardDidShow', () => {
        this.scrollFocusedFieldIntoView();
      });
    } catch {
      // Keyboard plugin optional on webview variants
    }

    try {
      await SplashScreen.hide();
    } catch {
      // ignore
    }

    void App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        void App.exitApp();
      }
    });

    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        void this.notifications.refreshForCurrentUser();
      }
    });
  }

  get isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  get platform(): string {
    return Capacitor.getPlatform();
  }

  /** Keep the active input visible above the keyboard on auth/form screens. */
  private scrollFocusedFieldIntoView(): void {
    window.setTimeout(() => {
      const el = document.activeElement;
      if (!(el instanceof HTMLElement)) {
        return;
      }
      if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') {
        return;
      }
      el.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: 'smooth',
      });
    }, 50);
  }
}
