import {
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonDatetime,
  IonHeader,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import {
  formatDateLong,
  formatDateTimeLong,
  formatTime12h,
  parseDateKeyFromIso,
  parseTimeKeyFromIso,
  toDateKey,
  toLocalIso,
} from '../../../core/utils/date-time';

export type DateTimeFieldMode = 'date' | 'time' | 'date-time';

@Component({
  selector: 'app-date-time-field',
  standalone: true,
  imports: [
    IonModal,
    IonDatetime,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
  ],
  template: `
    <div class="field">
      @if (label()) {
        <span class="label">{{ label() }}</span>
      }
      <button
        type="button"
        class="trigger ra-reset"
        [disabled]="disabled()"
        [attr.aria-label]="label() || 'Choose date and time'"
        (click)="openPicker()"
      >
        <span class="ra-icon-box" style="width:16px;height:16px">
          <img class="ra-icon" [src]="iconSrc()" alt="" />
        </span>
        <span class="value" [class.placeholder]="!hasValue()">
          {{ display() }}
        </span>
      </button>
    </div>

    <ion-modal
      [isOpen]="isOpen()"
      [initialBreakpoint]="0.65"
      [breakpoints]="[0, 0.65, 0.9]"
      handleBehavior="cycle"
      (didDismiss)="closePicker()"
    >
      <ng-template>
        <ion-header>
          <ion-toolbar>
            <ion-title>{{ pickerTitle() }}</ion-title>
            <ion-buttons slot="end">
              <ion-button (click)="confirm()">Done</ion-button>
            </ion-buttons>
          </ion-toolbar>
        </ion-header>
        <ion-content class="picker-content">
          <ion-datetime
            [presentation]="presentation()"
            [value]="draftIso()"
            [min]="min()"
            [hourCycle]="'h12'"
            [showDefaultButtons]="false"
            preferWheel
            (ionChange)="onDraftChange($any($event).detail.value)"
          />
        </ion-content>
      </ng-template>
    </ion-modal>
  `,
  styles: `
    :host {
      display: block;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .label {
      font-size: 13px;
      font-weight: 600;
      color: var(--ra-ink);
    }

    .trigger {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      height: 44px;
      padding: 0 12px;
      background: var(--ra-surface);
      border: 1px solid var(--ra-border);
      border-radius: 12px;
      text-align: left;
    }

    .trigger:disabled {
      opacity: 0.55;
    }

    .value {
      flex: 1;
      min-width: 0;
      font-family: var(--ra-font-body);
      font-size: 14px;
      color: var(--ra-ink);
    }

    .value.placeholder {
      color: var(--ra-text-secondary);
    }

    .picker-content {
      --background: var(--ra-surface);
    }

    ion-datetime {
      margin: 0 auto;
      max-width: 100%;
    }
  `,
})
export class DateTimeFieldComponent {
  readonly label = input<string>('');
  readonly mode = input<DateTimeFieldMode>('date-time');
  readonly date = input<string>('');
  readonly time = input<string>('');
  readonly min = input<string | undefined>(undefined);
  readonly disabled = input(false);
  readonly placeholder = input('Choose…');
  readonly iconSrc = input('assets/icons/clock.svg');

  readonly dateChange = output<string>();
  readonly timeChange = output<string>();

  readonly isOpen = signal(false);
  readonly draftIso = signal('');

  readonly presentation = computed(() => {
    const mode = this.mode();
    if (mode === 'date') {
      return 'date';
    }
    if (mode === 'time') {
      return 'time';
    }
    return 'date-time';
  });

  readonly pickerTitle = computed(() => {
    const mode = this.mode();
    if (mode === 'date') {
      return 'Choose date';
    }
    if (mode === 'time') {
      return 'Choose time';
    }
    return 'Choose date & time';
  });

  readonly hasValue = computed(() => {
    const mode = this.mode();
    if (mode === 'date') {
      return !!this.date();
    }
    if (mode === 'time') {
      return !!this.time();
    }
    return !!this.date() && !!this.time();
  });

  readonly display = computed(() => {
    if (!this.hasValue()) {
      return this.placeholder();
    }
    const mode = this.mode();
    if (mode === 'date') {
      return formatDateLong(this.date());
    }
    if (mode === 'time') {
      return formatTime12h(this.time());
    }
    return formatDateTimeLong(this.date(), this.time());
  });

  openPicker(): void {
    if (this.disabled()) {
      return;
    }
    const date = this.date() || toDateKey(new Date());
    const time = this.time() || '10:00';
    this.draftIso.set(toLocalIso(date, time));
    this.isOpen.set(true);
  }

  closePicker(): void {
    this.isOpen.set(false);
  }

  onDraftChange(value: string | string[] | null | undefined): void {
    const iso = Array.isArray(value) ? value[0] : value;
    if (iso) {
      this.draftIso.set(iso);
    }
  }

  confirm(): void {
    const iso = this.draftIso();
    const date = parseDateKeyFromIso(iso);
    const time = parseTimeKeyFromIso(iso);
    const mode = this.mode();

    if ((mode === 'date' || mode === 'date-time') && date) {
      this.dateChange.emit(date);
    }
    if ((mode === 'time' || mode === 'date-time') && time) {
      this.timeChange.emit(time);
    }
    this.closePicker();
  }
}
