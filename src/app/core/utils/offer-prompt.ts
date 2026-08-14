import { AlertController } from '@ionic/angular/standalone';
import { ClaimBoardItem } from '../models';

/** Ask for an optional note when offering to drive (private or public). */
export async function promptOfferNote(
  alertCtrl: AlertController,
  item: ClaimBoardItem,
): Promise<string | null | undefined> {
  return new Promise((resolve) => {
    void alertCtrl
      .create({
        header: 'Send ride offer',
        message: `Add a short note for ${item.riderName.split(' ')[0] ?? 'the rider'} (optional).`,
        inputs: [
          {
            name: 'message',
            type: 'textarea',
            placeholder: 'e.g. I can pick you up in a blue Honda.',
            attributes: {
              maxlength: 280,
              rows: 3,
            },
          },
        ],
        buttons: [
          {
            text: 'Cancel',
            role: 'cancel',
            handler: () => {
              resolve(null);
            },
          },
          {
            text: 'Send offer',
            handler: (data: { message?: string }) => {
              resolve(data.message?.trim() ?? '');
              return true;
            },
          },
        ],
      })
      .then((alert) => {
        void alert.present();
      });
  });
}

/** Require a short reason when withdrawing a pending offer. */
export async function promptWithdrawOfferReason(
  alertCtrl: AlertController,
  onEmpty?: () => void,
): Promise<string | null> {
  return new Promise((resolve) => {
    void alertCtrl
      .create({
        header: 'Remove offer?',
        message:
          'Share a short reason for the rider. You can offer again later if the ride is still open.',
        inputs: [
          {
            name: 'reason',
            type: 'textarea',
            placeholder: 'e.g. Something came up and I am no longer available.',
            attributes: { maxlength: 280, rows: 3 },
          },
        ],
        buttons: [
          {
            text: 'Keep offer',
            role: 'cancel',
            handler: () => {
              resolve(null);
            },
          },
          {
            text: 'Remove offer',
            role: 'destructive',
            handler: (data: { reason?: string }) => {
              const reason = data.reason?.trim() ?? '';
              if (!reason) {
                onEmpty?.();
                return false;
              }
              resolve(reason);
              return true;
            },
          },
        ],
      })
      .then((alert) => {
        void alert.present();
      });
  });
}

/** @deprecated Prefer promptOfferNote — private rides also use the offer flow. */
export const promptPublicOfferNote = promptOfferNote;
