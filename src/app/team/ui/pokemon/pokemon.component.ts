import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, Subscription, Observable } from 'rxjs';
import { catchError, finalize, map, take, tap } from 'rxjs/operators';

import { TypeIcon } from '../../../shared/ui/type-icon/type-icon';
import { STAT_MAX_VALUES } from '../../../shared/util/constants';
import { PokemonApi } from '../../data/pokemon.api';
import { PokemonMapper } from '../../data/pokemon.mapper';
import { TypeIconService } from '../../data/type-icon.service';
import {
  PokemonAbilityOptionVM,
  PokemonAbilitySelectionPayload,
  PokemonItemOptionVM,
  PokemonItemSelectionPayload,
  PokemonMoveDetailVM,
  PokemonMoveOptionVM,
  PokemonMoveSelectionPayload,
  PokemonStatVM,
  PokemonVM,
} from '../../models/view.model';

type MoveTableRow = {
  url: string;
  label: string;
  type: { name: string; url: string } | null;
  typeIcon: string | null;
  power: number | null;
  accuracy: number | null;
  damageClass: string | null;
  effect: string | null;
  loading: boolean;
  searchIndex: string;
};

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
  private moveDetailCache: Record<string, PokemonMoveDetailVM> = {};
  private pendingDetailRequests = new Set<string>();
  private moveModalPreparationSub: Subscription | null = null;

  isMoveModalOpen = false;
  moveSearchTerm = '';
  moveTableRows: MoveTableRow[] = [];
  filteredMoveRows: MoveTableRow[] = [];
  pendingSelection: (PokemonMoveDetailVM | null)[] = [null, null, null, null];
  selectedAbilityUrl = '';
  selectedItemUrl = '';

  private readonly typeIcons = inject(TypeIconService);
  private readonly api = inject(PokemonApi);
  private readonly mapper = inject(PokemonMapper);

  @Input() set pokemon(value: PokemonVM) {
    this._pokemon = {
      ...value,
      stats: value.stats ?? [],
      moves: value.moves ?? [],
      selectedMoves: Array.isArray(value.selectedMoves)
        ? value.selectedMoves
        : [null, null, null, null],
    };
    this.pendingSelection = this._pokemon.selectedMoves.map((move) => (move ? { ...move } : null));
    this.selectedAbilityUrl = this._pokemon.selectedAbility?.url ?? '';
    this.selectedItemUrl = this._pokemon.heldItem?.url ?? '';
    this.initializeMoveDetailCache();
    this.prepareMoveIcons();
    this.ensureAllMoveDetailsLoaded().subscribe(() => {
      if (this.isMoveModalOpen) {
        this.initializeMoveTableRows();
      }
    });
  }
  get pokemon(): PokemonVM {
    return this._pokemon;
  }

  @Input() showRemove = true;
  @Input() items: PokemonItemOptionVM[] = [];
  @Output() remove = new EventEmitter<number>();
  @Output() moveChange = new EventEmitter<PokemonMoveSelectionPayload>();
  @Output() abilityChange = new EventEmitter<PokemonAbilitySelectionPayload>();
  @Output() itemChange = new EventEmitter<PokemonItemSelectionPayload>();

  onRemove() {
    this.remove.emit(this.pokemon.id);
  }

  openMoveModal() {
    if (this.moveModalPreparationSub) {
      this.moveModalPreparationSub.unsubscribe();
      this.moveModalPreparationSub = null;
    }

    this.pendingSelection = this.pokemon.selectedMoves.map((move) => (move ? { ...move } : null));
    this.moveSearchTerm = '';
    this.moveModalPreparationSub = this.ensureAllMoveDetailsLoaded().subscribe({
      next: () => {
        this.isMoveModalOpen = true;
        this.initializeMoveTableRows();
      },
      complete: () => {
        this.moveModalPreparationSub = null;
      },
    });
  }

  closeMoveModal() {
    if (this.moveModalPreparationSub) {
      this.moveModalPreparationSub.unsubscribe();
      this.moveModalPreparationSub = null;
    }
    this.isMoveModalOpen = false;
    this.moveTableRows = [];
    this.filteredMoveRows = [];
  }

  onSearchTermChange() {
    this.refreshFilteredMoveRows();
  }

  toggleMoveSelection(row: MoveTableRow) {
    if (this.isMoveSelected(row.url)) {
      this.removeMoveFromPending(row.url);
      return;
    }

    if (this.pendingSelectionCount >= this.moveSlots.length) {
      return;
    }

    const detail = this.getMoveDetailForRow(row);
    const emptyIndex = this.pendingSelection.findIndex((move) => move === null);
    if (emptyIndex === -1) {
      return;
    }

    this.pendingSelection = this.pendingSelection.map((move, index) =>
      index === emptyIndex ? detail : move
    );
  }

  removeSelectedMove(index: number) {
    if (index < 0 || index >= this.pendingSelection.length) {
      return;
    }

    this.pendingSelection = this.pendingSelection.map((move, current) =>
      current === index ? null : move
    );
  }

  saveMoveSelection() {
    this.pendingSelection.forEach((move, index) => {
      const previous = this.pokemon.selectedMoves[index];
      const previousUrl = previous?.url ?? null;
      const nextUrl = move?.url ?? null;

      if (previousUrl !== nextUrl) {
        this.onMoveSelect(index, nextUrl);
      }
    });

    this.closeMoveModal();
  }

  onMoveSelect(slot: number, moveUrl: string | null) {
    const normalized = moveUrl?.trim() ? moveUrl : null;
    this.moveChange.emit({
      pokemonId: this.pokemon.id,
      slot,
      moveUrl: normalized,
    });
  }

  handleAbilityChange(url: string) {
    const normalized = url?.trim() ?? '';
    this.selectedAbilityUrl = normalized;
    this.abilityChange.emit({
      pokemonId: this.pokemon.id,
      abilityUrl: normalized || null,
    });
  }

  handleItemChange(url: string) {
    const normalized = url?.trim() ?? '';
    if (normalized === '__loading') {
      return;
    }
    this.selectedItemUrl = normalized;
    this.itemChange.emit({
      pokemonId: this.pokemon.id,
      itemUrl: normalized || null,
    });
  }

  get pendingSelectionCount(): number {
    return this.pendingSelection.filter((move) => !!move).length;
  }

  isMoveSelected(url: string): boolean {
    return this.pendingSelection.some((move) => move?.url === url);
  }

  getMoveIcon(move: PokemonMoveOptionVM | PokemonMoveDetailVM | null): string | null {
    if (!move) {
      return null;
    }

    return this.moveIconUrls[move.url] ?? null;
  }

  formatTypeName(value: string): string {
    return this.toTitleCase(value);
  }

  formatCategory(value: string | null): string {
    if (!value) {
      return '—';
    }

    return this.toTitleCase(value);
  }

  formatAbilityLabel(option: PokemonAbilityOptionVM): string {
    const base = option.label;
    return option.isHidden ? `${base} (Hidden)` : base;
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

  private initializeMoveDetailCache() {
    const selectedMoves = this._pokemon?.selectedMoves ?? [];
    selectedMoves.forEach((move) => {
      if (move?.url) {
        this.moveDetailCache[move.url] = move;
      }
    });

    const availableMoves = this._pokemon?.moves ?? [];
    availableMoves.forEach((move) => {
      if (!move?.url) {
        return;
      }

      if (this.moveDetailCache[move.url]) {
        return;
      }

      const detail = this.mapper.normalizeMoveDetail({
        name: move.label,
        url: move.url,
        type: move.type,
        power: move.power,
        accuracy: move.accuracy,
        damageClass: move.damageClass,
        effect: move.effect,
      });

      if (detail) {
        this.moveDetailCache[move.url] = detail;
      }
    });
  }

  private initializeMoveTableRows() {
    const rows: MoveTableRow[] = (this.pokemon.moves ?? []).map((move) => ({
      url: move.url,
      label: move.label,
      type: move.type,
      typeIcon: this.moveIconUrls[move.url] ?? null,
      power: move.power ?? null,
      accuracy: move.accuracy ?? null,
      damageClass: move.damageClass ?? null,
      effect: move.effect ?? null,
      loading: false,
      searchIndex: this.buildSearchIndex(move.label, move.damageClass, move.effect),
    }));

    this.moveTableRows = rows;
    rows.forEach((row) => this.ensureMoveIcon(row.type?.url ?? null, row.url));
    this.refreshFilteredMoveRows();
  }

  private refreshFilteredMoveRows() {
    if (!this.isMoveModalOpen) {
      this.filteredMoveRows = [];
      return;
    }

    const term = this.moveSearchTerm.trim().toLowerCase();
    if (!term) {
      this.filteredMoveRows = [...this.moveTableRows];
    } else {
      this.filteredMoveRows = this.moveTableRows.filter((row) => row.searchIndex.includes(term));
    }
    this.prefetchMoveDetailsForRows(this.filteredMoveRows);
  }

  private prefetchMoveDetailsForRows(rows: MoveTableRow[]) {
    if (!this.isMoveModalOpen) {
      return;
    }

    rows.forEach((row) => this.ensureMoveDetail(row));
  }

  private ensureMoveDetail(row: MoveTableRow) {
    const cached = this.moveDetailCache[row.url];

    if (cached) {
      if (this.rowNeedsDetailUpdate(row, cached)) {
        this.applyDetailToRow(cached);
      }
      this.ensureMoveIcon(cached.type?.url ?? null, cached.url);
      return;
    }

    if (this.pendingDetailRequests.has(row.url)) {
      return;
    }

    this.pendingDetailRequests.add(row.url);
    this.updateMoveRow(row.url, { loading: true });

    this.api
      .getMoveByUrl(row.url)
      .pipe(
        take(1),
        finalize(() => {
          this.pendingDetailRequests.delete(row.url);
          this.updateMoveRow(row.url, { loading: false });
        })
      )
      .subscribe({
        next: (dto) => {
          const detail = this.mapper.moveDetailFromDto(dto, row.url);
          this.moveDetailCache[row.url] = detail;
          this.applyDetailToRow(detail);
          this.updateMoveOptionWithDetail(detail);
          this.ensureMoveIcon(detail.type?.url ?? null, detail.url);
        },
        error: (error) => {
          console.error('Error loading move details', error);
        },
      });
  }

  private updateMoveRow(url: string, changes: Partial<MoveTableRow>) {
    if (!this.isMoveModalOpen) {
      return;
    }

    const index = this.moveTableRows.findIndex((row) => row.url === url);
    if (index === -1) {
      return;
    }

    const current = this.moveTableRows[index];
    const updated: MoveTableRow = {
      ...current,
      ...changes,
      searchIndex: this.buildSearchIndex(
        changes.label ?? current.label,
        changes.damageClass ?? current.damageClass,
        changes.effect ?? current.effect
      ),
    };

    this.moveTableRows = [
      ...this.moveTableRows.slice(0, index),
      updated,
      ...this.moveTableRows.slice(index + 1),
    ];
    this.refreshFilteredMoveRows();
  }

  private updateMoveOptionWithDetail(detail: PokemonMoveDetailVM) {
    this._pokemon.moves = this._pokemon.moves.map((move) =>
      move.url === detail.url
        ? {
            ...move,
            type: detail.type,
            power: detail.power,
            accuracy: detail.accuracy,
            damageClass: detail.damageClass,
            effect: detail.effect,
          }
        : move
    );
    this.prepareMoveIcons();
  }

  private applyDetailToRow(detail: PokemonMoveDetailVM) {
    this.updateMoveRow(detail.url, {
      type: detail.type,
      power: detail.power,
      accuracy: detail.accuracy,
      damageClass: detail.damageClass,
      effect: detail.effect,
      loading: false,
      typeIcon: this.moveIconUrls[detail.url] ?? null,
    });
  }

  private rowNeedsDetailUpdate(
    row: MoveTableRow,
    detail: PokemonMoveDetailVM
  ): boolean {
    if (row.loading) {
      return true;
    }

    return (
      (row.type?.name ?? null) !== (detail.type?.name ?? null) ||
      row.power !== detail.power ||
      row.accuracy !== detail.accuracy ||
      row.damageClass !== detail.damageClass ||
      row.effect !== detail.effect
    );
  }

  private ensureMoveIcon(typeUrl: string | null, moveUrl: string) {
    if (!typeUrl) {
      return;
    }

    if (this.moveIconUrls[moveUrl] !== undefined) {
      return;
    }

    this.typeIcons
      .getIconByTypeUrl(typeUrl)
      .pipe(take(1))
      .subscribe((iconUrl) => {
        this.moveIconUrls = {
          ...this.moveIconUrls,
          [moveUrl]: iconUrl,
        };
        this.updateMoveRow(moveUrl, { typeIcon: iconUrl });
      });
  }

  private prepareMoveIcons() {
    const moveSources: (PokemonMoveOptionVM | PokemonMoveDetailVM)[] = [
      ...(this._pokemon?.moves ?? []),
      ...((this._pokemon?.selectedMoves ?? []).filter(
        (move): move is PokemonMoveDetailVM => !!move
      ) ?? []),
    ];

    const moveUrls = new Set(moveSources.map((move) => move.url));
    Object.keys(this.moveIconUrls).forEach((url) => {
      if (!moveUrls.has(url)) {
        delete this.moveIconUrls[url];
      }
    });

    moveSources.forEach((move) => {
      this.ensureMoveIcon(move.type?.url ?? null, move.url);
    });
  }

  private ensureAllMoveDetailsLoaded(): Observable<void> {
    const moves = this._pokemon?.moves ?? [];
    const missingUrls = moves
      .map((move) => move.url)
      .filter((url): url is string => !!url)
      .filter((url) => !this.hasMoveDetailInfo(this.moveDetailCache[url]))
      .filter((url) => !this.pendingDetailRequests.has(url));

    if (!missingUrls.length) {
      return of(void 0);
    }

    missingUrls.forEach((url) => this.pendingDetailRequests.add(url));

    return forkJoin(
      missingUrls.map((url) =>
        this.api
          .getMoveByUrl(url)
          .pipe(
            take(1),
            map((dto) => this.mapper.moveDetailFromDto(dto, url)),
            tap((detail) => {
              this.moveDetailCache[url] = detail;
              this.updateMoveOptionWithDetail(detail);
              this.ensureMoveIcon(detail.type?.url ?? null, detail.url);
              if (this.isMoveModalOpen) {
                this.applyDetailToRow(detail);
              }
            }),
            catchError((error) => {
              console.error('Error loading move details', error);
              const placeholder = this.mapper.createMovePlaceholder(undefined, url);
              this.moveDetailCache[url] = placeholder;
              return of(placeholder);
            })
          )
      )
    ).pipe(
      tap(() => this.prepareMoveIcons()),
      finalize(() => {
        missingUrls.forEach((url) => this.pendingDetailRequests.delete(url));
      }),
      map(() => void 0)
    );
  }

  private hasMoveDetailInfo(detail: PokemonMoveDetailVM | null | undefined): boolean {
    if (!detail) {
      return false;
    }

    return (
      !!detail.type ||
      detail.power !== null ||
      detail.accuracy !== null ||
      !!detail.damageClass ||
      !!detail.effect
    );
  }

  private buildSearchIndex(
    label: string | null | undefined,
    damageClass: string | null,
    effect: string | null
  ): string {
    return [label ?? '', damageClass ?? '', effect ?? '']
      .join(' ')
      .toLowerCase();
  }

  private removeMoveFromPending(url: string) {
    const index = this.pendingSelection.findIndex((move) => move?.url === url);
    if (index === -1) {
      return;
    }

    this.removeSelectedMove(index);
  }

  private getMoveDetailForRow(row: MoveTableRow): PokemonMoveDetailVM {
    const cached = this.moveDetailCache[row.url];
    if (cached) {
      return cached;
    }

    this.ensureMoveDetail(row);
    const normalized =
      this.mapper.normalizeMoveDetail({
        name: row.label,
        url: row.url,
        type: row.type,
        power: row.power,
        accuracy: row.accuracy,
        damageClass: row.damageClass,
        effect: row.effect,
      });

    if (normalized) {
      this.moveDetailCache[row.url] = normalized;
      return normalized;
    }

    const placeholder = this.mapper.createMovePlaceholder(undefined, row.url);
    this.moveDetailCache[row.url] = placeholder;
    return placeholder;
  }

  private toTitleCase(value: string): string {
    return value
      .split(/[-\s]+/)
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }
}
