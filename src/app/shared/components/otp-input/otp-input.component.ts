import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  QueryList,
  ViewChildren,
  signal,
} from '@angular/core';

@Component({
  selector: 'app-otp-input',
  standalone: true,
  template: `
    <div class="otp" role="group" [attr.aria-label]="ariaLabel" (paste)="onPaste($event)">
      @for (slot of slots; track $index) {
        <input
          #digit
          class="digit"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          [attr.autocomplete]="$index === 0 ? 'one-time-code' : 'off'"
          [attr.maxlength]="$index === 0 ? length : 1"
          [attr.aria-label]="'Digit ' + ($index + 1)"
          [disabled]="disabled"
          [value]="values()[$index]"
          (focus)="onFocus($event)"
          (input)="onInput($index, $event)"
          (keydown)="onKeydown($index, $event)"
        />
      }
    </div>
  `,
  styles: [
    `
      .otp {
        display: flex;
        gap: 10px;
        justify-content: center;
      }
      .digit {
        width: 48px;
        height: 56px;
        border-radius: 14px;
        border: 1px solid var(--ra-border);
        background: var(--ra-surface);
        text-align: center;
        font-family: var(--ra-font-display);
        font-size: 22px;
        font-weight: 700;
        color: var(--ra-ink);
      }
      .digit:focus {
        outline: 2px solid var(--ra-primary);
        outline-offset: 1px;
      }
      .digit:disabled {
        opacity: 0.6;
      }
    `,
  ],
})
export class OtpInputComponent implements OnInit {
  @Input() length = 6;
  @Input() disabled = false;
  @Input() ariaLabel = 'Verification code';
  @Output() completed = new EventEmitter<string>();
  @Output() changed = new EventEmitter<string>();

  @ViewChildren('digit') digitInputs!: QueryList<ElementRef<HTMLInputElement>>;

  readonly values = signal<string[]>([]);

  get slots(): number[] {
    return Array.from({ length: this.length }, (_, i) => i);
  }

  ngOnInit(): void {
    this.values.set(Array.from({ length: this.length }, () => ''));
  }

  clear(): void {
    this.values.set(Array.from({ length: this.length }, () => ''));
    this.syncDom('');
    this.changed.emit('');
  }

  onFocus(event: FocusEvent): void {
    const el = event.target;
    if (!(el instanceof HTMLElement)) {
      return;
    }
    // Native keyboard can cover OTP boxes; re-align after layout settles.
    window.setTimeout(() => {
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
    }, 80);
  }

  onInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const raw = input.value.replace(/\D/g, '');

    // iOS SMS autofill (and some pastes) deliver the full code into the first box.
    if (raw.length > 1) {
      this.applyCode(raw);
      return;
    }

    const char = raw.slice(-1);
    const next = [...this.values()];
    next[index] = char;
    this.values.set(next);
    input.value = char;
    this.emit();

    if (char && index < this.length - 1) {
      this.focus(index + 1);
    }
  }

  onKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace') {
      const next = [...this.values()];
      if (next[index]) {
        next[index] = '';
        this.values.set(next);
        this.syncDom(next.join(''));
        this.emit();
        return;
      }
      if (index > 0) {
        next[index - 1] = '';
        this.values.set(next);
        this.syncDom(next.join(''));
        this.emit();
        this.focus(index - 1);
      }
    }
  }

  onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const text = event.clipboardData?.getData('text') ?? '';
    this.applyCode(text);
  }

  private applyCode(text: string): void {
    const digits = text.replace(/\D/g, '').slice(0, this.length);
    if (!digits.length) {
      return;
    }
    const next = Array.from({ length: this.length }, (_, i) => digits[i] ?? '');
    this.values.set(next);
    this.syncDom(digits);
    this.emit();
    this.focus(Math.min(digits.length, this.length - 1));
  }

  private syncDom(digits: string): void {
    // Ensure native input values match after autofill / paste (maxlength quirks).
    queueMicrotask(() => {
      this.digitInputs?.forEach((ref, i) => {
        ref.nativeElement.value = digits[i] ?? '';
      });
    });
  }

  private emit(): void {
    const code = this.values().join('');
    this.changed.emit(code);
    if (code.length === this.length && !this.values().includes('')) {
      this.completed.emit(code);
    }
  }

  private focus(index: number): void {
    queueMicrotask(() => {
      const el = this.digitInputs?.get(index)?.nativeElement;
      el?.focus();
      el?.select();
    });
  }
}
