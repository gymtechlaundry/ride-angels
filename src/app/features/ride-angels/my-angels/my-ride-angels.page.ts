import { Component, OnInit, inject } from '@angular/core';
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
import {
  CircleInviteService,
  OutboundCircleInvite,
} from '../../../core/services/circle-invite.service';
import { DomainSyncService } from '../../../core/services/domain-sync.service';
import {
  AngelListItem,
  PendingInviteItem,
  RideAngelService,
} from '../../../core/services/ride-angel.service';
import { formatPhoneDisplay } from '../../../core/utils/phone';
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
export class MyRideAngelsPage implements OnInit {
  private readonly angels = inject(RideAngelService);
  private readonly invites = inject(CircleInviteService);
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
  readonly waitingEmailInvites = this.invites.pendingOutbound;

  ngOnInit(): void {
    void this.invites.refreshOutbound();
  }

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      await Promise.all([
        this.domainSync.refreshForCurrentUser({ force: true }),
        this.invites.refreshOutbound(),
      ]);
    } finally {
      event.target.complete();
    }
  }

  outboundLabel(invite: OutboundCircleInvite): string {
    if (invite.email) {
      return invite.email;
    }
    if (invite.phone) {
      try {
        return formatPhoneDisplay(invite.phone);
      } catch {
        return invite.phone;
      }
    }
    return 'Invite';
  }

  outboundStatusCopy(invite: OutboundCircleInvite): string {
    if (invite.phone && !invite.email) {
      return 'Waiting for them to join';
    }
    return 'Invite sent';
  }

  async addAngel(): Promise<void> {
    const alert = await this.alert.create({
      header: 'Invite Ride Angel',
      message:
        'Enter their email or phone. If they already use Ride Angels, they get an in-app invite. If not, we send a private link (email or text).',
      inputs: [
        {
          name: 'identifier',
          type: 'text',
          placeholder: 'Email or phone',
          attributes: { autocomplete: 'email tel' },
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
          handler: (data: { identifier?: string; relationship?: string }) => {
            void this.sendInvite(
              data.identifier ?? '',
              data.relationship ?? 'Friend',
            );
            return false;
          },
        },
      ],
    });
    await alert.present();
  }

  private async sendInvite(
    identifier: string,
    relationship: string,
  ): Promise<void> {
    try {
      const result = await this.invites.createInvite({
        identifier,
        relationshipLabel: relationship,
      });
      const top = await this.alert.getTop();
      await top?.dismiss();

      if (result.kind === 'existing_user') {
        await this.showToast(
          `Invite sent to ${result.angelDisplayName}.`,
          'primary',
        );
        return;
      }

      if (result.kind === 'phone_invite') {
        const name =
          this.auth.getCurrentUserOrNull()?.displayName?.trim() || 'Someone';
        const shareAlert = await this.alert.create({
          header: 'Invite ready',
          message: `Share the link with ${formatPhoneDisplay(result.phone)} so they can join your circle.`,
          buttons: [
            { text: 'Done', role: 'cancel' },
            {
              text: 'Text link',
              handler: () => {
                this.invites.shareInviteViaSms(
                  result.phone,
                  result.inviteUrl,
                  name,
                );
              },
            },
            {
              text: 'Share…',
              handler: () => {
                void this.shareInvite(result.inviteUrl);
              },
            },
          ],
        });
        await shareAlert.present();
        return;
      }

      const shareAlert = await this.alert.create({
        header: result.emailSent ? 'Invite emailed' : 'Invite ready',
        message: result.emailSent
          ? `We emailed ${result.email}. You can also share the link by text.`
          : `We created an invite for ${result.email}. Share the link so they can join (email send may need Resend configured).`,
        buttons: [
          { text: 'Done', role: 'cancel' },
          {
            text: 'Share link',
            handler: () => {
              void this.shareInvite(result.inviteUrl);
            },
          },
        ],
      });
      await shareAlert.present();
    } catch (err) {
      await this.showToast(
        err instanceof Error ? err.message : 'Could not send invite.',
        'danger',
      );
    }
  }

  async shareInvite(inviteUrl: string): Promise<void> {
    try {
      const name =
        this.auth.getCurrentUserOrNull()?.displayName?.trim() || 'Someone';
      await this.invites.shareInviteUrl(inviteUrl, name);
      await this.showToast('Invite link shared.', 'primary');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not share invite.';
      if (/clipboard|copied|writeText/i.test(message) || message.includes('Sharing is not available')) {
        try {
          await navigator.clipboard.writeText(inviteUrl);
          await this.showToast('Invite link copied.', 'primary');
          return;
        } catch {
          /* fall through */
        }
      }
      await this.showToast(message, 'danger');
    }
  }

  async reshareOutbound(invite: OutboundCircleInvite): Promise<void> {
    if (invite.phone && !invite.email) {
      const name =
        this.auth.getCurrentUserOrNull()?.displayName?.trim() || 'Someone';
      this.invites.shareInviteViaSms(invite.phone, invite.inviteUrl, name);
      return;
    }
    await this.shareInvite(invite.inviteUrl);
  }

  async acceptInvite(item: PendingInviteItem): Promise<void> {
    try {
      await this.angels.acceptInvite(item.connectionId);
      await this.showToast(`You are now helping ${item.rider.displayName}.`, 'primary');
    } catch (err) {
      await this.showToast(
        err instanceof Error ? err.message : 'Could not accept invite.',
        'danger',
      );
    }
  }

  async declineInvite(item: PendingInviteItem): Promise<void> {
    try {
      await this.angels.declineInvite(item.connectionId);
    } catch (err) {
      await this.showToast(
        err instanceof Error ? err.message : 'Could not decline invite.',
        'danger',
      );
    }
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
            void this.angels.removeAngel(item.connectionId);
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
      message: `You will stop seeing ${item.rider.displayName}'s private ride requests.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Leave',
          role: 'destructive',
          handler: () => {
            void this.angels.removeAngel(item.connectionId);
          },
        },
      ],
    });
    await alert.present();
  }

  private async showToast(
    message: string,
    color: 'primary' | 'danger',
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
