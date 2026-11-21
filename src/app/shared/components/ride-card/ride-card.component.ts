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
            <span class="source">
              Trusted circle
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
          Pickup at {{ ride.timeLabel }}
        </span>
        @if (!hideDate) {
          <span class="date">{{ ride.dateLabel }}</span>
        }
      </div>

      <div class="route" aria-label="Route from {{ ride.fromLabel }} to {{ ride.toLabel }}">
        <div class="stop">
          <span class="pin" aria-hidden="true">
            <img class="ra-icon" src="assets/icons/map-pin-pickup.svg" alt="" />
          </span>
          <div class="stop-text">
            <span class="stop-label">From</span>
            <span class="stop-value">{{ ride.fromLabel }}</span>
          </div>
        </div>
        <div class="route-rail" aria-hidden="true"></div>
        <div class="stop">
          <span class="pin" aria-hidden="true">
            <img class="ra-icon" src="assets/icons/map-pin-destination.svg" alt="" />
          </span>
          <div class="stop-text">
            <span class="stop-label">To</span>
            <span class="stop-value">{{ ride.toLabel }}</span>
          </div>
        </div>
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
        flex-direction: column;
        gap: 0;
        padding: 10px 12px;
        background: var(--ra-primary-soft);
        border-radius: 12px;
      }
      .stop {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        min-width: 0;
      }
      .pin {
        flex: 0 0 auto;
        width: 14px;
        height: 14px;
        margin-top: 2px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .pin .ra-icon {
        width: 14px;
        height: 14px;
      }
      .stop-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
      }
      .stop-label {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--ra-text-muted);
        line-height: 1.2;
      }
      .stop-value {
        font-family: var(--ra-font-body);
        font-size: 13px;
        font-weight: 600;
        color: var(--ra-ink);
        line-height: 1.35;
        overflow-wrap: anywhere;
      }
      .route-rail {
        width: 2px;
        height: 12px;
        margin: 4px 0 4px 6px;
        border-radius: 1px;
        background: color-mix(in srgb, var(--ra-primary) 28%, transparent);
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
