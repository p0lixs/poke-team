import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TypeIcon } from '../../../shared/ui/type-icon/type-icon';
import { STAT_MAX_VALUES } from '../../../shared/util/constants';
import { TypeIconService } from '../../data/type-icon.service';
import {
  PokemonMoveDetailVM,
  PokemonMoveOptionVM,
  PokemonMoveSelectionPayload,
  PokemonStatVM,
  PokemonVM,
} from '../../models/view.model';
import { take } from 'rxjs/operators';
import { NgSelectModule } from '@ng-select/ng-select';

@Component({
  selector: 'app-pokemon',
  imports: [CommonModule, FormsModule, TypeIcon, NgSelectModule],
  templateUrl: './pokemon.component.html',
  styleUrl: './pokemon.component.scss',
})
export class PokemonComponent {
  private _pokemon!: PokemonVM;
  readonly moveSlots = [0, 1, 2, 3];
  private moveIconUrls: Record<string, string | null> = {};

  @Input() set pokemon(value: PokemonVM) {
    this._pokemon = {
      ...value,
      stats: value.stats ?? [],
      moves: value.moves ?? [],
      selectedMoves: Array.isArray(value.selectedMoves)
        ? value.selectedMoves
        : [null, null, null, null],
    };
    this.prepareMoveIcons();
  }
  get pokemon(): PokemonVM {
    return this._pokemon;
  }

  @Input() showRemove = true; // por si quieres ocultar el botón en otros contextos
  @Output() remove = new EventEmitter<number>();
  @Output() moveChange = new EventEmitter<PokemonMoveSelectionPayload>();

  typeIcons = inject(TypeIconService);

  private prepareMoveIcons() {
    const moves = this._pokemon?.moves ?? [];
    const moveUrls = new Set(moves.map((move) => move.url));

    for (const url of Object.keys(this.moveIconUrls)) {
      if (!moveUrls.has(url)) {
        delete this.moveIconUrls[url];
      }
    }

    moves.forEach((move) => {
      const typeUrl = move.type?.url;
      if (!typeUrl || this.moveIconUrls[move.url] !== undefined) {
        return;
      }

      this.typeIcons
        .getIconByTypeUrl(typeUrl)
        .pipe(take(1))
        .subscribe((iconUrl) => {
          this.moveIconUrls = {
            ...this.moveIconUrls,
            [move.url]: iconUrl,
          };
        });
    });
  }

  onRemove() {
    this.remove.emit(this.pokemon.id);
  }

  onMoveSelect(slot: number, moveUrl: string | null) {
    const normalized = moveUrl?.trim() ? moveUrl : null;
    this.moveChange.emit({
      pokemonId: this.pokemon.id,
      slot,
      moveUrl: normalized,
    });
  }

  getMoveIcon(move: PokemonMoveOptionVM | PokemonMoveDetailVM | null): string | null {
    if (!move) {
      return null;
    }

    return this.moveIconUrls[move.url] ?? null;
  }

  formatTypeName(value: string): string {
    return value
      .split(/[-\s]+/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }

  getStatPercentage(stat: PokemonStatVM): number {
    const maxStatValue = STAT_MAX_VALUES[stat.name] ?? 0;

    if (!maxStatValue) {
      return 0;
    }

    const percentage = (stat.value / maxStatValue) * 100;
    return Math.min(100, Math.round(percentage));
  }

  getStatGradient(stat: PokemonStatVM): string {
    const percentage = this.getStatPercentage(stat);
    const hue = Math.round((percentage / 100) * 240);
    const startColor = `hsl(${hue}, 85%, 55%)`;
    const endColor = `hsl(${hue}, 85%, 45%)`;

    return `linear-gradient(90deg, ${startColor} 0%, ${endColor} 100%)`;
  }
}
