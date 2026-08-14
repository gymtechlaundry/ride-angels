import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-primary-button',
  standalone: true,
  template: `
    <button
      type="button"
      class="primary"
      [class.deep]="variant === 'deep'"
      [class.amber]="variant === 'amber'"
      [class.soft]="variant === 'soft'"
      [disabled]="disabled"
      (click)="pressed.emit()"
    >
      @if (iconSrc) {
        <span class="ra-icon-box" [style.width.px]="iconSize" [style.height.px]="iconSize">
          <img class="ra-icon" [src]="iconSrc" alt="" />
        </span>
      }
      <span>{{ label }}</span>
    </button>
  `,
  styles: [
    `
      .primary {
        width: 100%;
        height: 48px;
        border: 0;
        border-radius: 24px;
        background: var(--ra-primary);
        color: #fff;
        font-family: var(--ra-font-body);
        font-weight: 700;
        font-size: 16px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        box-shadow: var(--ra-shadow-card);
        cursor: pointer;
      }
      .primary:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .deep {
        background: var(--ra-primary-deep);
        border: 1px solid var(--ra-primary-deep);
        border-radius: 999px;
        height: 44px;
        font-size: 13px;
        box-shadow: var(--ra-shadow-claim);
      }
      .amber {
        width: auto;
        height: auto;
        padding: 12px 18px;
        background: var(--ra-accent);
        border-radius: 24px;
        font-size: 14px;
        box-shadow: var(--ra-shadow-fab);
      }
      .soft {
        background: var(--ra-primary-soft);
        color: var(--ra-primary);
        box-shadow: none;
        height: auto;
        padding: 12px;
        border-radius: 16px;
        font-size: 14px;
      }
    `,
  ],
})
export class PrimaryButtonComponent {
  @Input({ required: true }) label!: string;
  @Input() iconSrc?: string;
  @Input() iconSize = 16;
  @Input() variant: 'primary' | 'deep' | 'amber' | 'soft' = 'primary';
  @Input() disabled = false;
  @Output() pressed = new EventEmitter<void>();
}
