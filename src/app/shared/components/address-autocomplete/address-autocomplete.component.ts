import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  PlaceSuggestion,
  ResolvedPlace,
} from '../../../core/services/places.models';
import { PlacesService } from '../../../core/services/places.service';

@Component({
  selector: 'app-address-autocomplete',
  standalone: true,
  imports: [FormsModule],
  // One Places session per field (also avoids root-injector timing issues on live reload).
  providers: [PlacesService],
  templateUrl: './address-autocomplete.component.html',
  styleUrl: './address-autocomplete.component.scss',
})
export class AddressAutocompleteComponent implements OnDestroy {
  private readonly places = inject(PlacesService);
  private readonly host = inject(ElementRef<HTMLElement>);

  @Input() label = 'Address';
  @Input() placeholder = 'Start typing an address';
  @Input() iconSrc = 'assets/icons/map-pin.svg';
  @Input() autocompleteAttr: string = 'street-address';
  @Input() set value(v: string) {
    if (v !== this.query()) {
      this.query.set(v ?? '');
    }
  }

  @Output() valueChange = new EventEmitter<string>();
  @Output() placeSelected = new EventEmitter<ResolvedPlace>();

  @ViewChild('inputEl') inputEl?: ElementRef<HTMLInputElement>;

  readonly query = signal('');
  readonly suggestions = signal<PlaceSuggestion[]>([]);
  readonly open = signal(false);
  readonly loading = signal(false);
  readonly resolving = signal(false);

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private requestSeq = 0;

  ngOnDestroy(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.open.set(false);
    }
  }

  onFocus(): void {
    this.places.refreshSession();
    if (this.suggestions().length) {
      this.open.set(true);
    }
  }

  onInput(raw: string): void {
    this.query.set(raw);
    this.valueChange.emit(raw);

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    const seq = ++this.requestSeq;
    this.debounceTimer = setTimeout(() => {
      void this.runSuggest(raw, seq);
    }, 280);
  }

  async onSelect(suggestion: PlaceSuggestion): Promise<void> {
    this.open.set(false);
    this.resolving.set(true);
    try {
      const place = await this.places.resolve(suggestion.placeId);
      if (place?.formattedAddress) {
        this.query.set(place.formattedAddress);
        this.valueChange.emit(place.formattedAddress);
        this.placeSelected.emit(place);
        this.suggestions.set([]);
        return;
      }
      // Fallback: use prediction text if details fail.
      const fallback = suggestion.fullText || suggestion.primaryText;
      this.query.set(fallback);
      this.valueChange.emit(fallback);
      this.placeSelected.emit({
        placeId: suggestion.placeId,
        formattedAddress: fallback,
        displayName: suggestion.primaryText,
        line1: suggestion.primaryText,
      });
      this.suggestions.set([]);
    } finally {
      this.resolving.set(false);
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.open.set(false);
    }
  }

  private async runSuggest(raw: string, seq: number): Promise<void> {
    const q = raw.trim();
    if (q.length < 2) {
      this.suggestions.set([]);
      this.open.set(false);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    try {
      const list = await this.places.suggest(q);
      if (seq !== this.requestSeq) return;
      this.suggestions.set(list);
      this.open.set(list.length > 0);
    } finally {
      if (seq === this.requestSeq) {
        this.loading.set(false);
      }
    }
  }
}
