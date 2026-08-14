import { Component, Input } from '@angular/core';

export type BrandLogoVariant =
  | 'splash'
  | 'horizontal-light'
  | 'horizontal-dark'
  | 'vertical'
  | 'mark'
  | 'mark-purple-card'
  | 'mark-light-card';

const LOGO_SRC: Record<BrandLogoVariant, string> = {
  /** Clean vertical lockup matching the iOS splash (transparent on #F5F6FA). */
  splash: 'assets/branding/logos/ride-angels-splash-lockup.png',
  'horizontal-light':
    'assets/branding/logos/ride-angels-horizontal-light-approved.png',
  'horizontal-dark':
    'assets/branding/logos/ride-angels-horizontal-dark-approved.png',
  vertical: 'assets/branding/logos/ride-angels-vertical-approved.png',
  mark: 'assets/branding/logos/ride-angels-mark-approved.png',
  'mark-purple-card':
    'assets/branding/logos/ride-angels-mark-purple-card-approved.png',
  'mark-light-card':
    'assets/branding/logos/ride-angels-mark-light-card-approved.png',
};

/**
 * Renders approved Ride Angels raster brand assets only.
 * Preserve aspect ratio — never stretch or crop lockups.
 */
@Component({
  selector: 'app-brand-logo',
  standalone: true,
  template: `
    <img
      class="brand-logo"
      [class.horizontal]="isHorizontal"
      [class.vertical]="isVertical"
      [class.mark]="isMark"
      [src]="src"
      [alt]="alt"
      [style.max-width]="maxWidth || null"
    />
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        justify-content: center;
        line-height: 0;
        max-width: 100%;
      }
      .brand-logo {
        display: block;
        width: auto;
        height: auto;
        max-width: 100%;
        margin-inline: auto;
        object-fit: contain;
        object-position: center;
        image-rendering: auto;
        background: transparent;
      }
      .horizontal {
        max-height: 72px;
        width: auto;
      }
      .vertical {
        max-height: 220px;
        width: auto;
      }
      .mark {
        max-height: 72px;
        width: auto;
      }
    `,
  ],
})
export class BrandLogoComponent {
  @Input() variant: BrandLogoVariant = 'splash';
  @Input() alt = 'Ride Angels';
  @Input() maxWidth?: string;

  get src(): string {
    return LOGO_SRC[this.variant];
  }

  get isHorizontal(): boolean {
    return this.variant.startsWith('horizontal');
  }

  get isVertical(): boolean {
    return this.variant === 'vertical' || this.variant === 'splash';
  }

  get isMark(): boolean {
    return this.variant.startsWith('mark');
  }
}
