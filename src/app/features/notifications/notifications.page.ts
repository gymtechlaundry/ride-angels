import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, IonContent, IonRefresher, IonRefresherContent, RefresherCustomEvent } from '@ionic/angular/standalone';
import { AppNotification } from '../../core/models';
import { NotificationService } from '../../core/services/notification.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [IonContent, IonRefresher, IonRefresherContent, PageHeaderComponent],
  templateUrl: './notifications.page.html',
  styleUrl: './notifications.page.scss',
})
export class NotificationsPage {
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly alert = inject(AlertController);

  readonly items = this.notifications.forCurrentUser;
  readonly unread = this.notifications.unreadForCurrentUser;
  readonly readCount = computed(
    () => this.items().filter((n) => n.read).length,
  );

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      await this.notifications.refreshForCurrentUser();
    } finally {
      event.target.complete();
    }
  }

  markAllRead(): void {
    void this.notifications.markAllReadForCurrentUser();
  }

  async clearRead(): Promise<void> {
    if (this.readCount() === 0) {
      return;
    }
    const alert = await this.alert.create({
      header: 'Clear read notifications?',
      message: 'Remove all notifications you’ve already opened.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Clear',
          role: 'destructive',
          handler: () => {
            void this.notifications.clearReadForCurrentUser();
          },
        },
      ],
    });
    await alert.present();
  }

  async dismiss(item: AppNotification, event: Event): Promise<void> {
    event.stopPropagation();
    await this.notifications.delete(item.id);
  }

  open(item: AppNotification): void {
    void this.notifications.markRead(item.id);
    if (item.relatedAppointmentId) {
      void this.router.navigate([
        '/tabs/home/appointment',
        item.relatedAppointmentId,
      ]);
      return;
    }
    if (
      item.type === 'discussion_posted' ||
      item.type === 'discussion_reply'
    ) {
      void this.router.navigate(['/tabs/profile/discussion']);
      return;
    }
    if (
      item.type === 'angel_invited' ||
      item.type === 'angel_accepted' ||
      item.type === 'circle_removed'
    ) {
      void this.router.navigate(['/tabs/ride-angels']);
    }
  }
}
