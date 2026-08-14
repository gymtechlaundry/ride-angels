import { Component, ViewChild, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonLabel,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/angular/standalone';
import { AuthService } from '../core/services/auth.service';
import { ClaimBoardService } from '../core/services/claim-board.service';
import { NotificationService } from '../core/services/notification.service';
import { RideAngelService } from '../core/services/ride-angel.service';

const TAB_ROOTS: Record<string, string> = {
  home: '/tabs/home',
  calendar: '/tabs/calendar',
  'ride-angels': '/tabs/ride-angels',
  profile: '/tabs/profile',
};

type IonContentEl = HTMLElement & {
  scrollToTop?: (duration?: number) => Promise<void>;
  getScrollElement?: () => Promise<HTMLElement>;
};

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrl: 'tabs.page.scss',
  imports: [IonTabs, IonTabBar, IonTabButton, IonLabel],
})
export class TabsPage {
  @ViewChild(IonTabs) private readonly tabs?: IonTabs;

  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly angels = inject(RideAngelService);
  private readonly board = inject(ClaimBoardService);
  private readonly router = inject(Router);

  private selectedTab: string | null = null;

  readonly persona = this.auth.activePersona;
  readonly unread = this.notifications.unreadForCurrentUser;
  readonly inviteCount = computed(() =>
    this.persona() === 'angel' ? this.angels.pendingIncoming().length : 0,
  );
  readonly openRequestCount = computed(() =>
    this.persona() === 'angel' ? this.board.allOpenBoardItems().length : 0,
  );
  readonly angelsTabLabel = computed(() =>
    this.persona() === 'angel' ? 'Circle' : 'Ride Angels',
  );

  /**
   * Angular IonTabs emits `{ tab }`, not a DOM CustomEvent.
   * Switching tabs starts at the top; in-stack Back keeps prior scroll.
   */
  onTabsDidChange(event: { tab: string }): void {
    const tab = event?.tab ?? this.tabs?.getSelected() ?? null;
    if (!tab) {
      return;
    }

    const switched = this.selectedTab !== null && this.selectedTab !== tab;
    this.selectedTab = tab;

    if (switched) {
      void this.scrollActiveTabToTop();
    }
  }

  /**
   * Re-tapping the current tab: Ionic pops nested screens to the tab root;
   * if already on the root, scroll to top.
   */
  onTabButtonClick(tab: string): void {
    const current = this.selectedTab ?? this.tabs?.getSelected() ?? null;
    if (current !== tab) {
      return;
    }

    const root = TAB_ROOTS[tab];
    if (!root) {
      return;
    }

    const url = this.router.url.split('?')[0];
    if (url === root || !url.startsWith(`${root}/`)) {
      void this.scrollActiveTabToTop();
    }
  }

  private async scrollActiveTabToTop(): Promise<void> {
    // Let the destination tab page finish becoming visible.
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => window.setTimeout(resolve, 50));
    });

    const contents = Array.from(
      document.querySelectorAll<IonContentEl>('ion-tabs ion-content'),
    ).filter((el) => {
      const page = el.closest('.ion-page');
      if (page?.classList.contains('ion-page-hidden')) {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    await Promise.all(
      contents.map(async (content) => {
        try {
          if (content.scrollToTop) {
            await content.scrollToTop(0);
            return;
          }
        } catch {
          // Fall through to raw scroll element.
        }

        try {
          const scrollEl = await content.getScrollElement?.();
          scrollEl?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        } catch {
          // Ignore pages without a scroll host.
        }
      }),
    );
  }
}
