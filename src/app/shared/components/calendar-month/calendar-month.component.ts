import {
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  signal,
} from '@angular/core';

/** Day marker / chip status for ride calendar. */
export type CalendarDayMark = 'unclaimed' | 'needs_confirm' | 'claimed';

export interface CalendarDayEvent {
  id: string;
  title: string;
  mark: CalendarDayMark;
}

export interface CalendarDayCell {
  date: string | null;
  dayNumber: number;
  inMonth: boolean;
  selected: boolean;
  isToday: boolean;
  isSunday: boolean;
  events: CalendarDayEvent[];
  /** Overflow count when more than maxVisible chips. */
  moreCount: number;
}

const MAX_VISIBLE_CHIPS = 3;

@Component({
  selector: 'app-calendar-month',
  standalone: true,
  template: `
    <div class="calendar-box">
      <div class="cal-header">
        <h2>{{ monthLabel() }}</h2>
        <div class="controls">
          <button
            type="button"
            class="nav ra-reset"
            (click)="shiftMonth(-1)"
            aria-label="Previous month"
          >
            <span class="ra-icon-box" style="width:16px;height:16px">
              <img class="ra-icon" src="assets/icons/chevron-left.svg" alt="" />
            </span>
          </button>
          <button
            type="button"
            class="nav ra-reset"
            (click)="shiftMonth(1)"
            aria-label="Next month"
          >
            <span class="ra-icon-box" style="width:16px;height:16px">
              <img class="ra-icon" src="assets/icons/chevron-right.svg" alt="" />
            </span>
          </button>
        </div>
      </div>

      <div class="dow" aria-hidden="true">
        @for (d of weekdays; track $index) {
          <span [class.sun]="$index === 0">{{ d }}</span>
        }
      </div>

      <div class="grid" role="grid" aria-label="Calendar">
        @for (cell of cells(); track $index) {
          <button
            type="button"
            class="day"
            [class.outside]="!cell.inMonth"
            [class.selected]="cell.selected"
            [class.today]="cell.isToday && !cell.selected"
            [class.has-events]="cell.events.length > 0"
            [disabled]="!cell.inMonth"
            (click)="select(cell)"
            [attr.aria-label]="ariaLabel(cell)"
            [attr.aria-selected]="cell.selected"
          >
            <span class="num" [class.sunday]="cell.isSunday && cell.inMonth">
              {{ cell.dayNumber }}
            </span>
            <span class="chips" aria-hidden="true">
              @for (ev of cell.events; track ev.id) {
                <span class="chip" [attr.data-mark]="ev.mark">{{ ev.title }}</span>
              }
              @if (cell.moreCount > 0) {
                <span class="more">+{{ cell.moreCount }}</span>
              }
            </span>
          </button>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .calendar-box {
        background: var(--ra-surface);
        border: 1px solid var(--ra-border);
        border-radius: var(--ra-card-radius);
        box-shadow: var(--ra-shadow-card);
        padding: var(--ra-card-padding);
        display: flex;
        flex-direction: column;
        gap: var(--ra-card-gap);
      }
      .cal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 6px;
      }
      h2 {
        margin: 0;
        font-family: var(--ra-font-display);
        font-weight: 700;
        font-size: 17px;
        color: var(--ra-ink);
      }
      .controls {
        display: flex;
        gap: 4px;
      }
      .nav {
        width: 32px;
        height: 32px;
        border-radius: 16px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: var(--ra-primary-soft);
      }
      .dow {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 0;
        font-family: var(--ra-font-body);
        font-weight: 600;
        font-size: 10px;
        letter-spacing: 0.04em;
        color: var(--ra-text-muted);
        text-align: center;
        text-transform: uppercase;
        padding: 0 2px 4px;
        border-bottom: 1px solid var(--ra-border);
      }
      .dow .sun {
        color: #e11d48;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 0;
      }
      .day {
        min-height: 72px;
        border: 0;
        border-bottom: 1px solid color-mix(in srgb, var(--ra-border) 80%, transparent);
        border-radius: 0;
        background: transparent;
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 2px;
        padding: 4px 2px 6px;
        cursor: pointer;
        text-align: left;
        min-width: 0;
      }
      .day:nth-child(7n) {
        /* Saturday edge */
      }
      .num {
        align-self: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-family: var(--ra-font-body);
        font-weight: 600;
        font-size: 12px;
        color: var(--ra-ink);
        line-height: 1;
        flex-shrink: 0;
      }
      .num.sunday {
        color: #e11d48;
      }
      .outside .num {
        color: var(--ra-text-muted);
        opacity: 0.55;
      }
      .outside .num.sunday {
        color: color-mix(in srgb, #e11d48 55%, #fff);
      }
      .today .num {
        background: color-mix(in srgb, var(--ra-ink) 10%, transparent);
      }
      .selected {
        background: color-mix(in srgb, var(--ra-primary) 8%, transparent);
      }
      .selected .num {
        background: var(--ra-ink);
        color: #fff;
        font-weight: 700;
      }
      .selected .num.sunday {
        background: #e11d48;
        color: #fff;
      }
      .chips {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        width: 100%;
        flex: 1;
      }
      .chip {
        display: block;
        width: 100%;
        min-width: 0;
        padding: 1px 3px;
        border-radius: 3px;
        font-size: 8px;
        font-weight: 700;
        line-height: 1.25;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: #fff;
      }
      .chip[data-mark='claimed'] {
        background: #10b981;
      }
      .chip[data-mark='needs_confirm'] {
        background: #3b82f6;
      }
      .chip[data-mark='unclaimed'] {
        background: #f59e0b;
      }
      .more {
        font-size: 8px;
        font-weight: 700;
        color: var(--ra-text-muted);
        padding-left: 2px;
        line-height: 1.2;
      }
      .day:disabled {
        cursor: default;
      }
      .outside {
        pointer-events: none;
      }
    `,
  ],
})
export class CalendarMonthComponent {
  readonly weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  private readonly viewMonth = signal(new Date());
  private readonly selectedDate = signal('');
  private readonly eventsByDate = signal<Record<string, CalendarDayEvent[]>>({});

  @Input() set dayEvents(
    value: Record<string, CalendarDayEvent[]> | null | undefined,
  ) {
    this.eventsByDate.set(value ?? {});
  }

  /** Highest-priority mark per day — kept for callers that only need dots. */
  @Input() set dayMarks(value: Record<string, CalendarDayMark> | null | undefined) {
    if (!value) {
      return;
    }
    // Only apply when dayEvents was never provided (empty map stays empty).
    const existing = this.eventsByDate();
    if (Object.keys(existing).length > 0) {
      return;
    }
    const next: Record<string, CalendarDayEvent[]> = {};
    for (const [date, mark] of Object.entries(value)) {
      next[date] = [{ id: `${date}-${mark}`, title: labelForMark(mark), mark }];
    }
    this.eventsByDate.set(next);
  }

  /** @deprecated Prefer dayEvents. */
  @Input() set appointmentDates(dates: string[] | Set<string>) {
    const next: Record<string, CalendarDayEvent[]> = {};
    const list = dates instanceof Set ? Array.from(dates) : dates;
    for (const date of list) {
      next[date] = [
        { id: `${date}-claimed`, title: 'Claimed', mark: 'claimed' },
      ];
    }
    this.eventsByDate.set(next);
  }

  @Input() set selected(date: string) {
    if (date) {
      this.selectedDate.set(date);
      const d = new Date(`${date}T12:00:00`);
      this.viewMonth.set(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }

  @Output() dateSelected = new EventEmitter<string>();

  readonly monthLabel = computed(() =>
    this.viewMonth().toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    }),
  );

  readonly cells = computed(() => this.buildCells());

  shiftMonth(delta: number): void {
    const current = this.viewMonth();
    this.viewMonth.set(
      new Date(current.getFullYear(), current.getMonth() + delta, 1),
    );
  }

  select(cell: CalendarDayCell): void {
    if (!cell.date || !cell.inMonth) {
      return;
    }
    this.selectedDate.set(cell.date);
    this.dateSelected.emit(cell.date);
  }

  ariaLabel(cell: CalendarDayCell): string | undefined {
    if (!cell.date) {
      return undefined;
    }
    if (!cell.events.length) {
      return cell.date;
    }
    const titles = cell.events.map((e) => e.title).join(', ');
    const extra =
      cell.moreCount > 0 ? ` and ${cell.moreCount} more` : '';
    return `${cell.date}, ${titles}${extra}`;
  }

  private buildCells(): CalendarDayCell[] {
    const month = this.viewMonth();
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const first = new Date(year, monthIndex, 1);
    const startPad = first.getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const prevDays = new Date(year, monthIndex, 0).getDate();
    const selected = this.selectedDate();
    const eventsByDate = this.eventsByDate();
    const todayKey = toLocalDateKey(new Date());
    const cells: CalendarDayCell[] = [];

    for (let i = 0; i < startPad; i++) {
      const dayNumber = prevDays - startPad + i + 1;
      cells.push({
        date: null,
        dayNumber,
        inMonth: false,
        selected: false,
        isToday: false,
        isSunday: i % 7 === 0,
        events: [],
        moreCount: 0,
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const all = eventsByDate[date] ?? [];
      const visible = all.slice(0, MAX_VISIBLE_CHIPS);
      cells.push({
        date,
        dayNumber: day,
        inMonth: true,
        selected: date === selected,
        isToday: date === todayKey,
        isSunday: new Date(`${date}T12:00:00`).getDay() === 0,
        events: visible,
        moreCount: Math.max(0, all.length - visible.length),
      });
    }

    while (cells.length % 7 !== 0) {
      const idx = cells.length;
      cells.push({
        date: null,
        dayNumber: cells.length - (startPad + daysInMonth) + 1,
        inMonth: false,
        selected: false,
        isToday: false,
        isSunday: idx % 7 === 0,
        events: [],
        moreCount: 0,
      });
    }

    return cells;
  }
}

function labelForMark(mark: CalendarDayMark): string {
  switch (mark) {
    case 'unclaimed':
      return 'Unclaimed';
    case 'needs_confirm':
      return 'Confirm';
    default:
      return 'Claimed';
  }
}

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
