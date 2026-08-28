import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ClaimBoardItem } from '../../../core/models';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';

@Component({
  selector: 'app-claim-board-card',
  standalone: true,
  imports: [StatusBadgeComponent],
  template: `
    <button type="button" class="card ra-reset" (click)="open.emit(item)">
      <div class="top">
        <div class="rider-info">
          <p class="rider">{{ item.riderName }} ({{ item.riderRelationship }})</p>
          <h3>{{ item.title }}</h3>
        </div>
        @if (item.claimedByCurrentUser) {
          <span class="tag claimed">
            <span class="ra-icon-box" style="width:10px;height:10px">
              <img class="ra-icon" src="assets/icons/check.svg" alt="" />
            </span>
            YOU CLAIMED
          </span>
        } @else if (item.offerPendingByCurrentUser) {
          <app-status-badge status="Awaiting confirm" />
        } @else {
          <span class="tag private">PRIVATE CIRCLE</span>
        }
      </div>

      <div class="meta">
        <div class="row">
          <span class="ra-icon-box" style="width:14px;height:14px">
            <img class="ra-icon" src="assets/icons/calendar.svg" alt="" />
          </span>
          <span>{{ item.whenLabel }}</span>
        </div>
        <div class="row">
          <span class="ra-icon-box" style="width:14px;height:14px">
            <img class="ra-icon" src="assets/icons/map-pin.svg" alt="" />
          </span>
          <span>{{ item.routeLabel }}</span>
        </div>
      </div>

      @if (item.claimedByCurrentUser) {
        <div class="thanks">
          <span class="ra-icon-box" style="width:14px;height:14px">
            <img class="ra-icon" src="assets/icons/smile.svg" alt="" />
          </span>
          <span>Thank you for being {{ firstName }}'s angel!</span>
        </div>
      } @else if (item.offerPendingByCurrentUser) {
        <div class="awaiting">
          Waiting for {{ firstName }} to accept your offer.
        </div>
      }
    </button>
  `,
  styles: [
    `
      .card {
        width: 100%;
        background: var(--ra-surface);
        border: 1px solid var(--ra-border);
        border-radius: var(--ra-card-radius);
        box-shadow: var(--ra-shadow-card);
        padding: var(--ra-card-padding);
        display: flex;
        flex-direction: column;
        gap: var(--ra-card-gap);
        text-align: left;
      }
      .top {
        display: flex;
        justify-content: space-between;
        gap: var(--ra-card-gap);
        align-items: flex-start;
      }
      .rider {
        margin: 0;
        font-size: var(--ra-card-meta-size);
        font-weight: 700;
        color: var(--ra-primary);
      }
      h3 {
        margin: var(--ra-card-stack-tight) 0 0;
        font-family: var(--ra-font-display);
        font-weight: 700;
        font-size: var(--ra-card-title-size);
        color: var(--ra-ink);
      }
      .tag {
        font-size: 10px;
        font-weight: 700;
        border-radius: 8px;
        padding: 4px 8px;
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .private {
        background: var(--ra-primary-soft);
        color: var(--ra-primary);
      }
      .public {
        background: #fff7ed;
        color: #c2410c;
      }
      .claimed {
        background: var(--ra-success-bg);
        color: var(--ra-success-text);
        border-radius: 12px;
        padding: 4px 10px;
      }
      .meta {
        display: flex;
        flex-direction: column;
        gap: var(--ra-card-meta-gap);
      }
      .row {
        display: flex;
        align-items: center;
        gap: var(--ra-card-meta-gap);
        font-size: var(--ra-card-body-size);
        color: var(--ra-text-secondary);
      }
      .thanks {
        display: flex;
        align-items: center;
        gap: 8px;
        border-top: 1px solid var(--ra-border);
        padding-top: var(--ra-card-footer-pad);
        color: var(--ra-success-text);
        font-size: var(--ra-card-meta-size);
      }
      .awaiting {
        border-top: 1px solid var(--ra-border);
        padding-top: var(--ra-card-footer-pad);
        font-size: var(--ra-card-meta-size);
        font-weight: 600;
        line-height: 1.35;
        color: #3730a3;
      }
    `,
  ],
})
export class ClaimBoardCardComponent {
  @Input({ required: true }) item!: ClaimBoardItem;
  @Output() open = new EventEmitter<ClaimBoardItem>();

  get firstName(): string {
    return this.item.riderName.split(' ')[0] ?? this.item.riderName;
  }
}
