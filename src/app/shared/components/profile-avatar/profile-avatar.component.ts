import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-profile-avatar',
  standalone: true,
  template: `
    <div class="avatar" [style.width.px]="size" [style.height.px]="size" [attr.aria-label]="alt">
      @if (src) {
        <img [src]="src" [alt]="alt" />
      } @else {
        <span class="initials">{{ initials }}</span>
      }
    </div>
  `,
  styles: [
    `
      .avatar {
        border-radius: 50%;
        overflow: hidden;
        flex-shrink: 0;
        background: var(--ra-primary-soft);
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .initials {
        font-family: var(--ra-font-display);
        font-weight: 700;
        font-size: 0.45em;
        color: var(--ra-primary);
      }
    `,
  ],
})
export class ProfileAvatarComponent {
  @Input() src?: string | null;
  @Input() alt = 'Profile photo';
  @Input() size = 48;
  @Input() name = '';

  get initials(): string {
    return this.name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');
  }
}
