import { Component, EventEmitter, Output, computed, signal } from '@angular/core';
import { SearchMode } from '../../models/search-mode.type';

@Component({
  standalone: true,
  selector: 'app-search-box',
  templateUrl: './search-box.component.html',
  styleUrls: ['./search-box.component.scss'],
})
export class SearchBoxComponent {
  public value = signal('');
  public mode = signal<SearchMode>('name');
  readonly placeholder = computed(() => {
    switch (this.mode()) {
      case 'type':
        return 'Search by type (fire, water...)';
      case 'ability':
        return 'Search by ability (levitate, overgrow...)';
      case 'move':
        return 'Search by move (flamethrower, surf...)';
      default:
        return 'Search Pokémon by name...';
    }
  });
  @Output() valueChange = new EventEmitter<string>();
  @Output() modeChange = new EventEmitter<SearchMode>();

  onInput(v: string) {
    this.value.set(v);
    this.valueChange.emit(v);
  }

  onModeChange(mode: SearchMode) {
    this.mode.set(mode);
    this.modeChange.emit(mode);
    this.valueChange.emit(this.value());
  }
}
