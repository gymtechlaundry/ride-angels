import { Component, Input } from '@angular/core';

/**
 * Standard screen title block used across tabs and stack pages.
 * Titles: sentence case. Always prefer a short subtitle on informational screens.
 * Tab roots: wrap in ion-header.ra-chrome. Stack screens: place at top of ion-content with showBack.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  template: `
    <header
      class="page-header"
      [class.ra-page-pad]="!embed"
      [class.has-back]="showBack"
      [class.embed]="embed"
    >
      <div class="nav-row">
        @if (showBack) {
          <button
            type="button"
            class="back ra-reset"
            (click)="onBack()"
            [attr.aria-label]="backLabel"
          >
            <span class="ra-icon-box" style="width:16px;height:16px">
              <img class="ra-icon" src="assets/icons/chevron-left.svg" alt="" />
            </span>
          </button>
        }
        <h1 class="title">{{ title }}</h1>
        <ng-content select="[headerEnd]"></ng-content>
      </div>
      @if (subtitle) {
        <p class="subtitle">{{ subtitle }}</p>
      }
    </header>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .page-header {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-top: max(12px, calc(var(--ra-safe-top) + 4px));
        padding-bottom: 12px;
        background: var(--ra-bg);
      }
      .page-header.embed {
        padding-top: 0;
        padding-left: 0;
        padding-right: 0;
        background: transparent;
      }
      .nav-row {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
      }
      .back {
        width: 32px;
        height: 32px;
        border-radius: 16px;
        background: var(--ra-primary-soft);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .title {
        margin: 0;
        flex: 1;
        font-family: var(--ra-font-display);
        font-weight: 700;
        font-size: 24px;
        color: var(--ra-ink);
        line-height: 1.2;
        letter-spacing: -0.01em;
      }
      .subtitle {
        margin: 0;
        font-size: 14px;
        line-height: 1.35;
        color: var(--ra-text-secondary);
      }
      .has-back .subtitle {
        padding-left: 44px;
      }
    `,
  ],
})
export class PageHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() subtitle?: string;
  @Input() showBack = false;
  @Input() backLabel = 'Go back';
  /**
   * Parent already applies page padding + safe area (auth shells).
   * Skips horizontal pad and top safe inset on the header itself.
   */
  @Input() embed = false;

  onBack(): void {
    history.back();
  }
}
