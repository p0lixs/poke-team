import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TypeIcon } from '../../../../shared/ui/type-icon/type-icon';
import { SearchFilters } from '../../../models/search-filters.model';
import { PokemonVM } from '../../../models/view.model';

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

  trackById(_index: number, pokemon: PokemonVM) {
    return pokemon.id;
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
}
