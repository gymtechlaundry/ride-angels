import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RideCardView } from '../../../core/models';
import { ProfileAvatarComponent } from '../profile-avatar/profile-avatar.component';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';

@Component({
  selector: 'app-ride-card',
  standalone: true,
  imports: [StatusBadgeComponent, ProfileAvatarComponent],
  template: `
    <article class="ride-card" role="button" tabindex="0" (click)="open.emit(ride)" (keyup.enter)="open.emit(ride)">
      <header class="header">
        <div class="title-block">
          <h3 class="title">{{ ride.title }}</h3>
          @if (ride.viewAs === 'angel' && ride.visibility) {
            <span class="source" [class.public]="ride.visibility === 'public'">
              {{ ride.visibility === 'public' ? 'Community' : 'Trusted circle' }}
            </span>
          }
        </div>
        <app-status-badge [status]="ride.statusLabel" />
      </header>

      <div class="meta">
        <span class="time-pill">
          <span class="ra-icon-box" style="width:12px;height:12px">
            <img class="ra-icon" src="assets/icons/clock.svg" alt="" />
          </span>
          {{ ride.timeLabel }}
        </span>
        @if (!hideDate) {
          <span class="date">{{ ride.dateLabel }}</span>
        }
      </div>

      <div class="route">
        <span class="from">{{ ride.fromLabel }}</span>
        <span class="ra-icon-box" style="width:12px;height:12px" aria-hidden="true">
          <img class="ra-icon" src="assets/icons/arrow-right.svg" alt="" />
        </span>
        <span class="to">{{ ride.toLabel }}</span>
      </div>

      @if (ride.viewAs === 'angel' && ride.riderName) {
        <div class="driver">
          <p class="driver-text">
            Driving for <strong>{{ ride.riderName }}</strong>
          </p>
        </div>
      } @else if (ride.claimedByName) {
        <div class="driver">
          <app-profile-avatar
            [src]="ride.claimedByAvatarUrl"
            [name]="ride.claimedByName"
            [size]="24"
            [alt]="ride.claimedByName"
          />
          <p class="driver-text">
            Claimed by <strong>{{ ride.claimedByName }}</strong>
          </p>
        </div>
      }
    </article>
  `,
  styles: [
    `
      .ride-card {
        background: var(--ra-surface);
        border: 1px solid var(--ra-border);
        border-radius: var(--ra-card-radius);
        box-shadow: var(--ra-shadow-card);
        padding: var(--ra-card-padding);
        display: flex;
        flex-direction: column;
        gap: var(--ra-card-gap);
        width: 100%;
        text-align: left;
      }
      .header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--ra-card-gap);
      }
      .title-block {
        display: flex;
        flex-direction: column;
        gap: var(--ra-card-meta-gap);
        min-width: 0;
      }
      .title {
        margin: 0;
        font-family: var(--ra-font-display);
        font-weight: 700;
        font-size: var(--ra-card-title-size);
        color: var(--ra-ink);
      }
      .source {
        align-self: flex-start;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        padding: 3px 8px;
        border-radius: 8px;
        background: var(--ra-primary-soft);
        color: var(--ra-primary);
      }
      .source.public {
        background: var(--ra-warning-bg);
        color: var(--ra-warning-text);
      }
      .meta {
        display: flex;
        align-items: center;
        gap: var(--ra-card-gap);
      }
      .time-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--ra-primary-soft);
        border-radius: 8px;
        padding: 4px 8px;
        font-family: var(--ra-font-body);
        font-weight: 600;
        font-size: 11px;
        color: var(--ra-primary);
      }
      .date {
        font-size: var(--ra-card-meta-size);
        color: var(--ra-text-secondary);
      }
      .route {
        display: flex;
        align-items: center;
        gap: var(--ra-card-meta-gap);
        font-size: var(--ra-card-body-size);
      }
      .from {
        color: var(--ra-text-secondary);
        font-weight: 500;
      }
      .to {
        color: var(--ra-ink);
        font-weight: 600;
      }
      .driver {
        display: flex;
        align-items: center;
        gap: 8px;
        border-top: 1px solid var(--ra-border);
        padding-top: var(--ra-card-footer-pad);
      }
      .driver-text {
        margin: 0;
        font-size: var(--ra-card-meta-size);
        color: var(--ra-text-secondary);
      }
      .driver-text strong {
        color: var(--ra-primary);
        font-weight: 700;
      }
    `,
  ],
})
export class RideCardComponent {
  @Input({ required: true }) ride!: RideCardView;
  /** When true, omit date text (useful under a day-group heading). */
  @Input() hideDate = false;
  @Output() open = new EventEmitter<RideCardView>();
}
