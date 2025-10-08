import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TypeIcon } from '../../../shared/ui/type-icon/type-icon';
import { STAT_MAX_VALUES } from '../../../shared/util/constants';
import { PokemonApi } from '../../data/pokemon.api';
import { PokemonMapper } from '../../data/pokemon.mapper';
import { TypeIconService } from '../../data/type-icon.service';
import {
  PokemonMoveDetailVM,
  PokemonMoveOptionVM,
  PokemonMoveSelectionPayload,
  PokemonStatVM,
  PokemonVM,
} from '../../models/view.model';
import { finalize, take } from 'rxjs/operators';

@Component({
  selector: 'app-pokemon',
  imports: [CommonModule, FormsModule, TypeIcon],
  templateUrl: './pokemon.component.html',
  styleUrl: './pokemon.component.scss',
})
export class PokemonComponent {
  private _pokemon!: PokemonVM;
  readonly moveSlots = [0, 1, 2, 3];
  private moveIconUrls: Record<string, string | null> = {};
  moveOptions: PokemonMoveOptionVM[] = [];
  filteredMoves: PokemonMoveOptionVM[] = [];
  pendingSelectedMoves: (PokemonMoveDetailVM | null)[] = [null, null, null, null];
  moveSearchTerm = '';
  isMoveModalOpen = false;
  private readonly detailLoading = new Set<string>();
  private readonly detailLoaded = new Set<string>();

  private api = inject(PokemonApi);
  private mapper = inject(PokemonMapper);
  typeIcons = inject(TypeIconService);

  @Input() set pokemon(value: PokemonVM) {
    const normalizedMoves = Array.isArray(value.moves)
      ? value.moves.map((move) => ({ ...move }))
      : [];
    const baseSelected = Array.isArray(value.selectedMoves) ? value.selectedMoves : [];
    const normalizedSelected = Array.from({ length: this.moveSlots.length }, (_, index) => {
      const detail = baseSelected[index] ?? null;
      return detail ? { ...detail } : null;
    });

    this._pokemon = {
      ...value,
      stats: value.stats ?? [],
      moves: normalizedMoves,
      selectedMoves: normalizedSelected,
    };

    this.moveOptions = normalizedMoves.map((move) => ({ ...move }));
    this.pendingSelectedMoves = normalizedSelected.map((move) => (move ? { ...move } : null));
    this.moveIconUrls = {};
    this.detailLoading.clear();
    this.detailLoaded.clear();
    this.moveOptions.forEach((move) => {
      if (
        move.type ||
        move.power !== null ||
        move.accuracy !== null ||
        move.category ||
        (move.effect && move.effect.trim())
      ) {
        this.detailLoaded.add(move.url);
      }
    });
    this._pokemon.selectedMoves.forEach((move) => {
      if (move?.url) {
        this.detailLoaded.add(move.url);
      }
    });
    this.prepareMoveIcons();
    this.updateFilteredMoves();
  }
  get pokemon(): PokemonVM {
    return this._pokemon;
  }

  @Input() showRemove = true;
  @Output() remove = new EventEmitter<number>();
  @Output() moveChange = new EventEmitter<PokemonMoveSelectionPayload>();

  openMovesModal() {
    this.isMoveModalOpen = true;
    this.moveSearchTerm = '';
    this.resetPendingSelection();
    this.updateFilteredMoves();
    this.ensureDetailsForPendingSelection();
  }

  closeMovesModal() {
    this.isMoveModalOpen = false;
    this.resetPendingSelection();
    this.moveSearchTerm = '';
    this.updateFilteredMoves();
  }

  confirmMovesSelection() {
    this.moveSlots.forEach((slot) => {
      const current = this.pokemon.selectedMoves[slot];
      const next = this.pendingSelectedMoves[slot];
      const currentUrl = current?.url ?? null;
      const nextUrl = next?.url ?? null;

      if (currentUrl !== nextUrl) {
        this.emitMoveChange(slot, nextUrl);
      }
    });

    this.closeMovesModal();
  }

  onSearchTermChange(term: string) {
    this.moveSearchTerm = term ?? '';
    this.updateFilteredMoves();
  }

  get hasSelectedMoves(): boolean {
    return this.pokemon.selectedMoves.some((move) => !!move);
  }

  get pendingSelectedMovesCount(): number {
    return this.pendingSelectedMoves.filter((move) => !!move).length;
  }

  canSelectMoreMoves(): boolean {
    return this.pendingSelectedMovesCount < this.moveSlots.length;
  }

  isMoveSelected(move: PokemonMoveOptionVM): boolean {
    return this.pendingSelectedMoves.some((selected) => selected?.url === move.url);
  }

  onMoveRowClick(move: PokemonMoveOptionVM) {
    if (this.isMoveSelected(move)) {
      this.removeMoveByUrl(move.url);
      return;
    }

    if (!this.canSelectMoreMoves()) {
      return;
    }

    this.addMoveToPending(move);
  }

  removePendingMove(slot: number) {
    if (slot < 0 || slot >= this.pendingSelectedMoves.length) {
      return;
    }

    if (!this.pendingSelectedMoves[slot]) {
      return;
    }

    const next = [...this.pendingSelectedMoves];
    next[slot] = null;
    this.pendingSelectedMoves = next;
  }

  onRemove() {
    this.remove.emit(this.pokemon.id);
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

  private emitMoveChange(slot: number, moveUrl: string | null) {
    const normalized = moveUrl?.trim() ? moveUrl : null;

    this.moveChange.emit({
      pokemonId: this.pokemon.id,
      slot,
      moveUrl: normalized,
    });
  }

  private resetPendingSelection() {
    this.pendingSelectedMoves = this._pokemon.selectedMoves.map((move) =>
      move ? { ...move } : null
    );
  }

  private addMoveToPending(move: PokemonMoveOptionVM) {
    const index = this.pendingSelectedMoves.findIndex((item) => item === null);
    if (index === -1) {
      return;
    }

    const detail = this.toMoveDetail(move);
    const next = [...this.pendingSelectedMoves];
    next[index] = detail;
    this.pendingSelectedMoves = next;
  }

  private removeMoveByUrl(url: string) {
    let changed = false;
    const next = this.pendingSelectedMoves.map((selected) => {
      if (selected?.url === url) {
        changed = true;
        return null;
      }
      return selected;
    });

    if (changed) {
      this.pendingSelectedMoves = next;
    }
  }

  private toMoveDetail(move: PokemonMoveOptionVM): PokemonMoveDetailVM {
    return {
      name: move.label ?? move.name,
      url: move.url,
      type: move.type ?? null,
      power: move.power ?? null,
      accuracy: move.accuracy ?? null,
      category: move.category ?? null,
      effect: move.effect ?? null,
    };
  }

  private updateFilteredMoves() {
    const term = this.moveSearchTerm.trim().toLowerCase();
    const base = [...this.moveOptions].sort((a, b) => a.label.localeCompare(b.label));
    const filtered =
      term.length === 0
        ? base
        : base.filter((move) => {
            const label = move.label.toLowerCase();
            const raw = move.name.toLowerCase();
            return label.includes(term) || raw.includes(term);
          });

    this.filteredMoves = filtered;

    this.filteredMoves.forEach((move) => {
      if (!this.detailLoaded.has(move.url)) {
        this.ensureMoveDetail(move.url);
      }
    });
  }

  private ensureMoveDetail(url: string) {
    if (!url || this.detailLoaded.has(url) || this.detailLoading.has(url)) {
      return;
    }

    const exists = this.moveOptions.some((move) => move.url === url);
    if (!exists) {
      return;
    }

    this.detailLoading.add(url);

    this.api
      .getMoveByUrl(url)
      .pipe(
        take(1),
        finalize(() => {
          this.detailLoading.delete(url);
        })
      )
      .subscribe({
        next: (dto) => {
          const detail = this.mapper.moveDetailFromDto(dto, url);
          const normalized = this.mapper.normalizeMoveDetail(detail);
          if (normalized) {
            this.detailLoaded.add(normalized.url);
            this.applyMoveDetail(normalized);
          }
        },
        error: (error) => {
          console.error('Error al cargar el movimiento', error);
        },
      });
  }

  private applyMoveDetail(detail: PokemonMoveDetailVM) {
    let updated = false;
    const nextOptions = this.moveOptions.map((option) => {
      if (option.url !== detail.url) {
        return option;
      }

      updated = true;
      return {
        ...option,
        name: detail.name ?? option.name,
        label: detail.name ?? option.label,
        type: detail.type ?? option.type,
        power: detail.power ?? option.power,
        accuracy: detail.accuracy ?? option.accuracy ?? null,
        category: detail.category ?? option.category ?? null,
        effect: detail.effect ?? option.effect ?? null,
      };
    });

    if (!updated) {
      return;
    }

    const nextSelected = this._pokemon.selectedMoves.map((selected) =>
      selected?.url === detail.url
        ? {
            ...selected,
            name: detail.name ?? selected.name,
            type: detail.type ?? selected.type,
            power: detail.power ?? selected.power,
            accuracy: detail.accuracy ?? selected.accuracy,
            category: detail.category ?? selected.category,
            effect: detail.effect ?? selected.effect,
          }
        : selected
    );

    this.moveOptions = nextOptions;
    this._pokemon = {
      ...this._pokemon,
      moves: nextOptions.map((option) => ({ ...option })),
      selectedMoves: nextSelected,
    };

    this.pendingSelectedMoves = this.pendingSelectedMoves.map((selected) =>
      selected?.url === detail.url
        ? {
            ...selected,
            name: detail.name ?? selected.name,
            type: detail.type ?? selected.type,
            power: detail.power ?? selected.power,
            accuracy: detail.accuracy ?? selected.accuracy,
            category: detail.category ?? selected.category,
            effect: detail.effect ?? selected.effect,
          }
        : selected
    );

    this.prepareMoveIcons();

    if (this.isMoveModalOpen) {
      this.updateFilteredMoves();
    }
  }

  private ensureDetailsForPendingSelection() {
    this.pendingSelectedMoves.forEach((move) => {
      if (move?.url) {
        this.ensureMoveDetail(move.url);
      }
    });
  }

  private prepareMoveIcons() {
    const optionMoves = this.moveOptions ?? [];
    const selectedMoves = (this._pokemon?.selectedMoves ?? []).filter(
      (move): move is PokemonMoveDetailVM => !!move
    );

    const moves: (PokemonMoveOptionVM | PokemonMoveDetailVM)[] = [...optionMoves, ...selectedMoves];
    const moveUrls = new Set(moves.map((move) => move.url));

    Object.keys(this.moveIconUrls).forEach((url) => {
      if (!moveUrls.has(url)) {
        delete this.moveIconUrls[url];
      }
    });

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
}
