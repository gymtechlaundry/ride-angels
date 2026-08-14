import { Component, Input } from '@angular/core';
import { RideStatusLabel } from '../../../core/models';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `
    <span
      class="badge"
      [class.claimed]="status === 'Claimed'"
      [class.unclaimed]="status === 'Unclaimed'"
      [class.needs-confirm]="status === 'Needs confirm'"
      [class.awaiting-confirm]="status === 'Awaiting confirm'"
      [class.completed]="status === 'Completed'"
      [class.cancelled]="status === 'Cancelled'"
      [attr.aria-label]="'Status: ' + status"
    >
      <span class="dot" aria-hidden="true"></span>
      <span class="text">{{ status }}</span>
    </span>
  `,
  styles: [
    `
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 12px;
        flex-shrink: 0;
      }
      .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
      }
      .text {
        font-family: var(--ra-font-body);
        font-weight: 700;
        font-size: 11px;
        text-transform: uppercase;
        line-height: normal;
      }
      .claimed {
        background: var(--ra-success-bg);
      }
      .claimed .dot {
        background: var(--ra-success-text);
      }
      .claimed .text {
        color: var(--ra-success-text);
      }
      /* Warm amber — open / no driver yet */
      .unclaimed {
        background: #fff7ed;
      }
      .unclaimed .dot {
        background: #ea580c;
      }
      .unclaimed .text {
        color: #c2410c;
      }
      /* Cool blue — rider action needed (offers or reconfirm) */
      .needs-confirm {
        background: #eff6ff;
      }
      .needs-confirm .dot {
        background: #1d4ed8;
      }
      .needs-confirm .text {
        color: #1e40af;
      }
      /* Soft indigo — angel waiting on rider */
      .awaiting-confirm {
        background: #eef2ff;
      }
      .awaiting-confirm .dot {
        background: #4338ca;
      }
      .awaiting-confirm .text {
        color: #3730a3;
      }
      .completed {
        background: #ecfdf5;
      }
      .completed .dot {
        background: var(--ra-success-text);
      }
      .completed .text {
        color: var(--ra-success-text);
      }
      .cancelled {
        background: #f3f4f6;
      }
      .cancelled .dot {
        background: var(--ra-text-muted);
      }
      .cancelled .text {
        color: var(--ra-text-muted);
      }
    `,
  ],
})
export class StatusBadgeComponent {
  @Input({ required: true }) status!: RideStatusLabel;
}
