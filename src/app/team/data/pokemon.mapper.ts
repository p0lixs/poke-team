import { Injectable } from '@angular/core';
import { STAT_LABELS } from '../../shared/util/constants';
import { MoveDTO, PokemonDTO } from '../models/pokeapi.dto';
import {
  PokemonMoveDetailVM,
  PokemonMoveOptionVM,
  PokemonVM,
} from '../models/view.model';

@Injectable({ providedIn: 'root' })
export class PokemonMapper {
  toVM(dto: PokemonDTO): PokemonVM {
    const base: PokemonVM = {
      id: dto.id,
      name: dto.name,
      sprite: dto.sprites.front_default,
      types: dto.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
      typeDetails: dto.types
        .sort((a, b) => a.slot - b.slot)
        .map((t) => ({ name: t.type.name, url: t.type.url })),
      stats:
        dto.stats?.map((stat) => ({
          name: stat.stat.name,
          label: STAT_LABELS[stat.stat.name] ?? this.toTitleCase(stat.stat.name.replace(/-/g, ' ')),
          value: stat.base_stat,
        })) ?? [],
      moves:
        dto.moves?.map((move) => ({
          name: move.move.name,
          label: this.formatMoveName(move.move.name),
          url: move.move.url,
          type: null,
          power: null,
          accuracy: null,
          category: null,
          effect: null,
        })) ?? [],
      selectedMoves: [],
    };

    return this.normalizeVM(base);
  }

  normalizeVM(value: PokemonVM): PokemonVM {
    return {
      ...value,
      types: Array.isArray(value.types) ? [...value.types] : [],
      typeDetails: Array.isArray(value.typeDetails)
        ? value.typeDetails.map((type) => ({ name: type.name, url: type.url }))
        : [],
      stats: Array.isArray(value.stats)
        ? value.stats.map((stat) => ({
            name: stat.name,
            label:
              stat.label ??
              STAT_LABELS[stat.name] ??
              this.toTitleCase(stat.name.replace(/-/g, ' ')),
            value: stat.value ?? 0,
          }))
        : [],
      moves: this.normalizeMoveOptions(value.moves),
      selectedMoves: this.normalizeSelectedMoves(value.selectedMoves),
    };
  }

  moveDetailFromDto(dto: MoveDTO, url: string): PokemonMoveDetailVM {
    const type = dto.type && dto.type.url ? { name: dto.type.name, url: dto.type.url } : null;
    const category = dto.damage_class?.name
      ? this.toTitleCase(dto.damage_class.name.replace(/-/g, ' '))
      : null;
    const effect = this.extractEffectText(dto.effect_entries, dto.effect_chance);

    return {
      name: this.formatMoveName(dto.name),
      url,
      type,
      power: dto.power ?? null,
      accuracy: dto.accuracy ?? null,
      category,
      effect,
    };
  }

  createMovePlaceholder(option: PokemonMoveOptionVM | undefined, url: string): PokemonMoveDetailVM {
    const baseName = option?.label ?? option?.name ?? this.extractNameFromUrl(url);
    return {
      name: this.formatMoveName(baseName),
      url,
      type: null,
      power: null,
      accuracy: null,
      category: null,
      effect: null,
    };
  }

  normalizeMoveDetail(detail: PokemonMoveDetailVM | null): PokemonMoveDetailVM | null {
    if (!detail || typeof detail.url !== 'string' || !detail.url.trim()) {
      return null;
    }

    const type = detail.type && detail.type.url ? { name: detail.type.name, url: detail.type.url } : null;
    const category = detail.category ? this.toTitleCase(detail.category.replace(/-/g, ' ')) : null;
    const effect = this.normalizeEffect(detail.effect);

    return {
      name: this.formatMoveName(detail.name ?? this.extractNameFromUrl(detail.url)),
      url: detail.url,
      type,
      power: detail.power ?? null,
      accuracy: detail.accuracy ?? null,
      category,
      effect,
    };
  }

  private extractEffectText(
    entries: MoveDTO['effect_entries'] | undefined,
    chance: number | null
  ): string | null {
    if (!Array.isArray(entries) || !entries.length) {
      return null;
    }

    const preferred =
      entries.find((entry) => entry.language?.name === 'es') ??
      entries.find((entry) => entry.language?.name === 'en');

    const raw = preferred?.short_effect ?? preferred?.effect ?? '';
    if (!raw.trim()) {
      return null;
    }

    const normalizedChance = typeof chance === 'number' ? String(chance) : '';
    const withChance = raw.replace(/\$effect_chance/gi, normalizedChance);

    return this.normalizeEffect(withChance);
  }

  private normalizeEffect(effect: string | null | undefined): string | null {
    if (!effect) {
      return null;
    }

    const normalized = effect
      .replace(/[\u000b\u000c]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return normalized.length ? normalized : null;
  }

  private toTitleCase(value: string): string {
    return value.replace(/\w\S*/g, (txt) => txt[0].toUpperCase() + txt.substring(1).toLowerCase());
  }

  private formatMoveName(value: string | undefined | null): string {
    const normalized = (value ?? '').trim();
    if (!normalized) return 'Movimiento';
    return this.toTitleCase(normalized.replace(/-/g, ' '));
  }

  private normalizeMoveOptions(options: PokemonMoveOptionVM[] | undefined): PokemonMoveOptionVM[] {
    if (!Array.isArray(options)) {
      return [];
    }

    return options
      .filter((option): option is PokemonMoveOptionVM => !!option && typeof option.url === 'string' && !!option.url.trim())
      .map((option) => ({
        name: option.name,
        label: option.label ?? this.formatMoveName(option.name),
        url: option.url,
        type: option.type && option.type.url ? { name: option.type.name, url: option.type.url } : null,
        power: option.power ?? null,
        accuracy: option.accuracy ?? null,
        category: option.category ? this.toTitleCase(option.category.replace(/-/g, ' ')) : null,
        effect: this.normalizeEffect(option.effect),
      }));
  }

  private normalizeSelectedMoves(
    moves: (PokemonMoveDetailVM | null)[] | undefined
  ): (PokemonMoveDetailVM | null)[] {
    const base = Array.isArray(moves) ? moves : [];

    return Array.from({ length: 4 }, (_, index) => {
      const detail = base[index] ?? null;
      return this.normalizeMoveDetail(detail);
    });
  }

  private extractNameFromUrl(url: string | undefined): string {
    if (!url) return '';
    const segments = url.split('/').filter(Boolean);
    return segments[segments.length - 1] ?? '';
  }
}
