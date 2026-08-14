import { AlertController, ToastController } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

/** Two-step confirm, then delete the signed-in Ride Angels account. */
export async function confirmAndDeleteAccount(
  alertCtrl: AlertController,
  toastCtrl: ToastController,
  auth: AuthService,
  router: Router,
): Promise<void> {
  const first = await alertCtrl.create({
    header: 'Delete your account?',
    message:
      'This permanently removes your Ride Angels profile, appointments, trusted circle, and photos. People in your circle will no longer see you in the app. This cannot be undone.',
    buttons: [
      { text: 'Keep account', role: 'cancel' },
      { text: 'Continue', role: 'destructive' },
    ],
  });
  await first.present();
  const firstResult = await first.onDidDismiss();
  if (firstResult.role !== 'destructive') {
    return;
  }

  const second = await alertCtrl.create({
    header: 'Are you sure?',
    message: 'Tap Delete account to confirm. You can create a new account later with the same phone or email.',
    buttons: [
      { text: 'Cancel', role: 'cancel' },
      { text: 'Delete account', role: 'destructive' },
    ],
  });
  await second.present();
  const secondResult = await second.onDidDismiss();
  if (secondResult.role !== 'destructive') {
    return;
  }

  try {
    await auth.deleteAccount();
    await router.navigateByUrl('/auth', { replaceUrl: true });
    const toast = await toastCtrl.create({
      message: 'Your Ride Angels account was deleted.',
      duration: 2800,
      position: 'top',
    });
    await toast.present();
  } catch (err) {
    const toast = await toastCtrl.create({
      message:
        err instanceof Error
          ? err.message
          : 'Could not delete your account. Email support@hyperionappstudio.com.',
      duration: 3200,
      position: 'top',
      color: 'danger',
    });
    await toast.present();
  }
}
