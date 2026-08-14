import { Component, EventEmitter, Input, Output } from '@angular/core';
import { AngelListItem } from '../../../core/services/ride-angel.service';
import { ProfileAvatarComponent } from '../profile-avatar/profile-avatar.component';

@Component({
  selector: 'app-angel-card',
  standalone: true,
  imports: [ProfileAvatarComponent],
  template: `
    <article class="angel-card">
      <app-profile-avatar
        [src]="item.angel.avatarUrl"
        [name]="item.angel.displayName"
        [size]="40"
        [alt]="item.angel.displayName"
      />
      <div class="info">
        <h3>{{ item.angel.displayName }}</h3>
        <div class="meta">
          <span class="rel">{{ item.relationshipLabel }}</span>
          <span class="ra-icon-box" style="width:3px;height:3px" aria-hidden="true">
            <img class="ra-icon" src="assets/icons/dot-separator.svg" alt="" />
          </span>
          <span class="phone">{{ item.angel.phone }}</span>
        </div>
      </div>
      <button type="button" class="remove ra-reset" (click)="remove.emit(item)" aria-label="Remove Ride Angel">
        <span class="ra-icon-box" style="width:16px;height:16px">
          <img class="ra-icon" src="assets/icons/trash.svg" alt="" />
        </span>
      </button>
    </article>
  `,
  styles: [
    `
      .angel-card {
        display: flex;
        align-items: center;
        gap: var(--ra-card-gap);
        padding: var(--ra-card-padding);
        background: var(--ra-surface);
        border: 1px solid var(--ra-border);
        border-radius: var(--ra-card-radius);
        box-shadow: var(--ra-shadow-card);
      }
      .info {
        flex: 1;
        min-width: 0;
      }
      h3 {
        margin: 0;
        font-family: var(--ra-font-display);
        font-weight: 700;
        font-size: var(--ra-card-name-size);
        color: var(--ra-ink);
      }
      .meta {
        display: flex;
        align-items: center;
        gap: var(--ra-card-meta-gap);
        margin-top: var(--ra-card-stack-tight);
      }
      .rel {
        font-size: var(--ra-card-meta-size);
        font-weight: 600;
        color: var(--ra-primary);
      }
      .phone {
        font-size: var(--ra-card-meta-size);
        color: var(--ra-text-secondary);
      }
      .remove {
        width: 32px;
        height: 32px;
        border-radius: 16px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
    `,
  ],
})
export class AngelCardComponent {
  @Input({ required: true }) item!: AngelListItem;
  @Output() remove = new EventEmitter<AngelListItem>();
}
