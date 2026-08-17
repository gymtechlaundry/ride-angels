import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  AlertController,
  IonContent,
  IonHeader,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent,
  ToastController,
} from '@ionic/angular/standalone';
import { AuthService } from '../../../core/services/auth.service';
import { DomainSyncService } from '../../../core/services/domain-sync.service';
import {
  AngelListItem,
  PendingInviteItem,
  RideAngelService,
} from '../../../core/services/ride-angel.service';
import { AngelCardComponent } from '../../../shared/components/angel-card/angel-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PrimaryButtonComponent } from '../../../shared/components/primary-button/primary-button.component';
import { ProfileAvatarComponent } from '../../../shared/components/profile-avatar/profile-avatar.component';
import { User } from '../../../core/models';

type RiderHelpItem = {
  connectionId: string;
  rider: User;
  relationshipLabel: string;
};

@Component({
  selector: 'app-my-ride-angels-page',
  standalone: true,
  imports: [
    IonHeader,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    PageHeaderComponent,
    PrimaryButtonComponent,
    AngelCardComponent,
    ProfileAvatarComponent,
  ],
  templateUrl: './my-ride-angels.page.html',
  styleUrl: './my-ride-angels.page.scss',
})
export class MyRideAngelsPage {
  private readonly angels = inject(RideAngelService);
  private readonly auth = inject(AuthService);
  private readonly domainSync = inject(DomainSyncService);
  private readonly router = inject(Router);
  private readonly alert = inject(AlertController);
  private readonly toast = inject(ToastController);

  readonly persona = this.auth.activePersona;
  readonly items = this.angels.myAngels;
  readonly pendingOutgoing = this.angels.pendingOutgoing;
  readonly pendingIncoming = this.angels.pendingIncoming;
  readonly ridersIHelp = this.angels.ridersIHelp;

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      await this.domainSync.refreshForCurrentUser({ force: true });
    } finally {
      event.target.complete();
    }
  }

  async addAngel(): Promise<void> {
    const alert = await this.alert.create({
      header: 'Invite Ride Angel',
      message:
        'Enter the verified email of someone who already has a Ride Angels account (they must have completed signup and added that email).',
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'Email',
          attributes: { autocomplete: 'email' },
        },
        {
          name: 'relationship',
          type: 'text',
          placeholder: 'Relationship (e.g. Neighbor)',
          value: 'Friend',
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Send invite',
          handler: (data: { email?: string; relationship?: string }) => {
            void this.sendInvite(data.email ?? '', data.relationship ?? 'Friend');
            return false;
          },
        },
      ],
    });
    await alert.present();
  }

  private async sendInvite(email: string, relationship: string): Promise<void> {
    try {
      const connection = await this.angels.inviteByEmail({
        email,
        relationshipLabel: relationship,
      });
      const angel = this.auth.getUserById(connection.angelId);
      const toast = await this.toast.create({
        message: `Invite sent to ${angel?.displayName ?? email}.`,
        duration: 2000,
        position: 'top',
        color: 'primary',
      });
      await toast.present();
      const top = await this.alert.getTop();
      await top?.dismiss();
    } catch (err) {
      const toast = await this.toast.create({
        message: err instanceof Error ? err.message : 'Could not send invite.',
        duration: 2600,
        position: 'top',
        color: 'danger',
      });
      await toast.present();
    }
  }

  async acceptInvite(item: PendingInviteItem): Promise<void> {
    await this.angels.acceptInvite(item.connectionId);
    const toast = await this.toast.create({
      message: `You're now a Ride Angel for ${item.rider.displayName}.`,
      duration: 2000,
      position: 'top',
      color: 'primary',
    });
    await toast.present();
  }

  async declineInvite(item: PendingInviteItem): Promise<void> {
    await this.angels.declineInvite(item.connectionId);
    const toast = await this.toast.create({
      message: 'Invite declined.',
      duration: 1600,
      position: 'top',
    });
    await toast.present();
  }

  async removeAngel(item: AngelListItem): Promise<void> {
    const alert = await this.alert.create({
      header: 'Remove Ride Angel?',
      message: `${item.angel.displayName} will no longer see your private ride requests.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Remove',
          role: 'destructive',
          handler: () => {
            void this.angels.removeAngel(item.connectionId).then(async () => {
              const toast = await this.toast.create({
                message: `${item.angel.displayName} removed.`,
                duration: 1800,
                position: 'top',
              });
              await toast.present();
            });
          },
        },
      ],
    });
    await alert.present();
  }

  openRider(item: RiderHelpItem): void {
    void this.router.navigate(['/tabs/ride-angels/rider', item.rider.id]);
  }

  async leaveRider(item: RiderHelpItem, event: Event): Promise<void> {
    event.stopPropagation();
    const alert = await this.alert.create({
      header: 'Leave this circle?',
      message: `You will no longer see ${item.rider.displayName}'s private ride requests.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Leave',
          role: 'destructive',
          handler: () => {
            void this.angels.removeAngel(item.connectionId).then(async () => {
              const toast = await this.toast.create({
                message: `Left ${item.rider.displayName}'s circle.`,
                duration: 1800,
                position: 'top',
              });
              await toast.present();
            });
          },
        },
      ],
    });
    await alert.present();
  }
}
