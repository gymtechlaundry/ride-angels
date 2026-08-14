import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AlertController,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent,
  ToastController,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { Capacitor } from '@capacitor/core';
import {
  Camera,
  CameraResultType,
  CameraSource,
} from '@capacitor/camera';
import { AuthService } from '../../core/services/auth.service';
import {
  FeedbackKind,
  FeedbackPost,
  FeedbackReply,
  FeedbackService,
} from '../../core/services/feedback.service';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { PrimaryButtonComponent } from '../../shared/components/primary-button/primary-button.component';
import { ProfileAvatarComponent } from '../../shared/components/profile-avatar/profile-avatar.component';

type PendingShot = {
  id: string;
  file: File;
  previewUrl: string;
};

@Component({
  selector: 'app-discussion-page',
  standalone: true,
  imports: [
    IonContent,
    IonRefresher,
    IonRefresherContent,
    ReactiveFormsModule,
    PageHeaderComponent,
    PrimaryButtonComponent,
    ProfileAvatarComponent,
  ],
  templateUrl: './discussion.page.html',
  styleUrl: './discussion.page.scss',
})
export class DiscussionPage implements OnInit, ViewWillEnter {
  private readonly feedback = inject(FeedbackService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastController);
  private readonly alert = inject(AlertController);
  private readonly fb = inject(FormBuilder);

  readonly posts = this.feedback.items;
  readonly loading = this.feedback.isLoading;
  readonly submitting = signal(false);
  readonly replyBusyId = signal<string | null>(null);
  readonly composing = signal(false);
  readonly pendingShots = signal<PendingShot[]>([]);
  readonly replyDrafts = signal<Record<string, string>>({});
  readonly expandedReplyFor = signal<string | null>(null);
  readonly isNative = Capacitor.isNativePlatform();
  readonly currentUserId = computed(
    () => this.auth.getCurrentUserOrNull()?.id ?? null,
  );
  readonly isModerator = computed(() => this.auth.isAppCreator());

  readonly form = this.fb.nonNullable.group({
    kind: ['feature' as FeedbackKind, Validators.required],
    title: ['', [Validators.required, Validators.maxLength(120)]],
    body: ['', [Validators.required, Validators.maxLength(4000)]],
  });

  async ngOnInit(): Promise<void> {
    await this.feedback.refresh();
  }

  ionViewWillEnter(): void {
    void this.feedback.refresh();
  }

  async onRefresh(event: RefresherCustomEvent): Promise<void> {
    try {
      await this.feedback.refresh();
    } finally {
      event.target.complete();
    }
  }

  isMine(authorId: string): boolean {
    return this.currentUserId() === authorId;
  }

  canDelete(authorId: string): boolean {
    return this.isMine(authorId) || this.isModerator();
  }

  startCompose(): void {
    this.composing.set(true);
  }

  cancelCompose(): void {
    this.composing.set(false);
    this.form.reset({ kind: 'feature', title: '', body: '' });
    this.clearPendingShots();
  }

  kindLabel(kind: FeedbackKind): string {
    switch (kind) {
      case 'feature':
        return 'Feature idea';
      case 'bug':
        return 'Bug report';
      default:
        return 'General';
    }
  }

  relativeTime(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  toggleReply(postId: string): void {
    this.expandedReplyFor.update((id) => (id === postId ? null : postId));
  }

  onReplyInput(postId: string, event: Event): void {
    const value = (event.target as HTMLTextAreaElement).value;
    this.replyDrafts.update((drafts) => ({ ...drafts, [postId]: value }));
  }

  replyDraft(postId: string): string {
    return this.replyDrafts()[postId] ?? '';
  }

  async submitReply(postId: string): Promise<void> {
    const body = this.replyDraft(postId).trim();
    if (!body || this.replyBusyId()) {
      return;
    }
    this.replyBusyId.set(postId);
    try {
      await this.feedback.createReply(postId, body);
      this.replyDrafts.update((drafts) => ({ ...drafts, [postId]: '' }));
      this.expandedReplyFor.set(postId);
      await this.showToast('Reply posted.');
    } catch (err) {
      await this.showToast(
        err instanceof Error ? err.message : 'Could not reply right now.',
      );
    } finally {
      this.replyBusyId.set(null);
    }
  }

  async confirmDeletePost(post: FeedbackPost): Promise<void> {
    const asMod = this.isModerator() && !this.isMine(post.authorId);
    const alert = await this.alert.create({
      header: asMod ? 'Delete as creator?' : 'Delete discussion?',
      message: asMod
        ? 'You are removing someone else’s discussion and all replies. This can’t be undone.'
        : 'This removes the post and all replies. This can’t be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            void this.deletePost(post.id);
          },
        },
      ],
    });
    await alert.present();
  }

  async confirmDeleteReply(postId: string, reply: FeedbackReply): Promise<void> {
    const asMod = this.isModerator() && !this.isMine(reply.authorId);
    const alert = await this.alert.create({
      header: asMod ? 'Delete as creator?' : 'Delete reply?',
      message: asMod
        ? 'You are removing someone else’s reply. This can’t be undone.'
        : 'This can’t be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            void this.deleteReply(postId, reply.id);
          },
        },
      ],
    });
    await alert.present();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    for (const file of files) {
      await this.addScreenshotFile(file);
    }
  }

  async addScreenshotNative(): Promise<void> {
    try {
      const photo = await Camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
      });
      if (!photo.dataUrl) {
        return;
      }
      const file = await dataUrlToFile(
        photo.dataUrl,
        `screenshot-${Date.now()}.jpg`,
      );
      await this.addScreenshotFile(file);
    } catch (err) {
      const message =
        err instanceof Error && err.message !== 'User cancelled photos app'
          ? err.message
          : null;
      if (message) {
        await this.showToast(message);
      }
    }
  }

  removeShot(id: string): void {
    this.pendingShots.update((list) => {
      const target = list.find((s) => s.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return list.filter((s) => s.id !== id);
    });
  }

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    try {
      const value = this.form.getRawValue();
      await this.feedback.createPost({
        kind: value.kind,
        title: value.title,
        body: value.body,
        screenshots: this.pendingShots().map((s) => s.file),
      });
      this.cancelCompose();
      await this.showToast('Thanks — your post is live.');
    } catch (err) {
      await this.showToast(
        err instanceof Error ? err.message : 'Could not post right now.',
      );
    } finally {
      this.submitting.set(false);
    }
  }

  trackPost(_index: number, post: FeedbackPost): string {
    return post.id;
  }

  trackReply(_index: number, reply: FeedbackReply): string {
    return reply.id;
  }

  private async deletePost(postId: string): Promise<void> {
    try {
      await this.feedback.deletePost(postId);
      await this.showToast('Discussion deleted.');
    } catch (err) {
      await this.showToast(
        err instanceof Error ? err.message : 'Could not delete discussion.',
      );
    }
  }

  private async deleteReply(postId: string, replyId: string): Promise<void> {
    try {
      await this.feedback.deleteReply(postId, replyId);
      await this.showToast('Reply deleted.');
    } catch (err) {
      await this.showToast(
        err instanceof Error ? err.message : 'Could not delete reply.',
      );
    }
  }

  private async addScreenshotFile(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) {
      await this.showToast('Please choose an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      await this.showToast('Screenshots must be under 5 MB.');
      return;
    }
    if (this.pendingShots().length >= 3) {
      await this.showToast('You can attach up to 3 screenshots.');
      return;
    }
    this.pendingShots.update((list) => [
      ...list,
      {
        id: `${Date.now()}-${list.length}`,
        file,
        previewUrl: URL.createObjectURL(file),
      },
    ]);
  }

  private clearPendingShots(): void {
    for (const shot of this.pendingShots()) {
      URL.revokeObjectURL(shot.previewUrl);
    }
    this.pendingShots.set([]);
  }

  private async showToast(message: string): Promise<void> {
    const t = await this.toast.create({
      message,
      duration: 2400,
      position: 'bottom',
    });
    await t.present();
  }
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const mime = blob.type || 'image/jpeg';
  return new File([blob], filename, { type: mime });
}
