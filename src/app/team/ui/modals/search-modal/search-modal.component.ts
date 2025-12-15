import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TypeIcon } from '../../../../shared/ui/type-icon/type-icon';
import { STAT_LABELS } from '../../../../shared/util/constants';
import { SearchFilters } from '../../../models/search-filters.model';
import { PokemonVM } from '../../../models/view.model';

const STAT_COLUMN_KEYS = [
  'hp',
  'attack',
  'defense',
  'special-attack',
  'special-defense',
  'speed',
] as const;

type SortDirection = 'asc' | 'desc';
type StatKey = (typeof STAT_COLUMN_KEYS)[number];
type SortableColumn = 'name' | 'types' | 'abilities' | StatKey;

@Component({
  standalone: true,
  selector: 'app-search-modal',
  imports: [CommonModule, FormsModule, TypeIcon],
  templateUrl: './search-modal.component.html',
  styleUrls: ['../modal.styles.scss', './search-modal.component.scss'],
})
export class SearchModalComponent {
  @Input() filters: SearchFilters = { name: '', types: [], abilities: [], moves: [] };
  @Input() typeOptions: string[] = [];
  @Input() abilityOptions: string[] = [];
  @Input() moveOptions: string[] = [];
  @Input() results: PokemonVM[] = [];
  @Input() loading = false;
  @Input() error: string | null = null;
  @Input() hasMore = false;

  @Output() filtersChange = new EventEmitter<SearchFilters>();
  @Output() add = new EventEmitter<PokemonVM>();
  @Output() loadMore = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();

  typeInput = '';
  abilityInput = '';
  moveInput = '';

  readonly statColumns = STAT_COLUMN_KEYS.map((key) => ({ key, label: STAT_LABELS[key] }));

  sort: { key: SortableColumn; direction: SortDirection } = { key: 'name', direction: 'asc' };

  get sortedResults(): PokemonVM[] {
    return [...this.results].sort((a, b) => this.comparePokemon(a, b));
  }

  trackById(_index: number, pokemon: PokemonVM) {
    return pokemon.id;
  }

  setSort(key: SortableColumn) {
    const direction = this.sort.key === key && this.sort.direction === 'asc' ? 'desc' : 'asc';
    this.sort = { key, direction };
  }

  onNameChange(value: string) {
    this.emitFilters({ ...this.filters, name: value });
  }

  addTypeFromInput() {
    this.tryAddFilter('types', this.typeInput, this.typeOptions);
    this.typeInput = '';
  }

  addAbilityFromInput() {
    this.tryAddFilter('abilities', this.abilityInput, this.abilityOptions);
    this.abilityInput = '';
  }

  addMoveFromInput() {
    this.tryAddFilter('moves', this.moveInput, this.moveOptions);
    this.moveInput = '';
  }

  removeFilter(kind: 'types' | 'abilities' | 'moves', value: string) {
    const nextList = this.filters[kind].filter((entry) => entry !== value);
    this.emitFilters({ ...this.filters, [kind]: nextList });
  }

  clearFilters() {
    this.emitFilters({ name: '', types: [], abilities: [], moves: [] });
    this.typeInput = '';
    this.abilityInput = '';
    this.moveInput = '';
  }

  private tryAddFilter(
    kind: 'types' | 'abilities' | 'moves',
    rawValue: string,
    availableOptions: string[]
  ) {
    const value = rawValue.trim().toLowerCase();
    if (!value) {
      return;
    }

    const matchesOption =
      !availableOptions.length || availableOptions.some((option) => option.toLowerCase() === value);

    if (!matchesOption) {
      return;
    }

    const nextList = Array.from(new Set([...this.filters[kind], value]));
    this.emitFilters({ ...this.filters, [kind]: nextList });
  }

  private emitFilters(filters: SearchFilters) {
    this.filtersChange.emit(filters);
  }

  private comparePokemon(a: PokemonVM, b: PokemonVM): number {
    const { key, direction } = this.sort;

    let result = 0;

    if (key === 'name') {
      result = a.name.localeCompare(b.name);
    } else if (key === 'types') {
      result = this.getTypeLabel(a).localeCompare(this.getTypeLabel(b));
    } else if (key === 'abilities') {
      result = this.getAbilitiesLabel(a).localeCompare(this.getAbilitiesLabel(b));
    } else {
      result = this.getStatBaseValue(a, key) - this.getStatBaseValue(b, key);
    }

    return direction === 'asc' ? result : -result;
  }

  private getTypeLabel(pokemon: PokemonVM): string {
    const types = pokemon.typeDetails?.map((type) => type.name) ?? pokemon.types ?? [];
    return types.join(', ');
  }

  private getAbilitiesLabel(pokemon: PokemonVM): string {
    return pokemon.abilityOptions.map((ability) => ability.label).join(', ');
  }

  getStatBaseValue(pokemon: PokemonVM, statName: StatKey): number {
    return pokemon.stats.find((stat) => stat.name === statName)?.baseValue ?? 0;
  }
}
