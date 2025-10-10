import { Injectable } from '@angular/core';
import {
  STAT_EV_MAX,
  STAT_EV_MIN,
  STAT_IV_MAX,
  STAT_IV_MIN,
  STAT_LABELS,
  STAT_TOTAL_EV_MAX,
} from '../../shared/util/constants';
import { MoveDTO, NatureDTO, PokemonAbilityDTO, PokemonDTO, NamedAPIResource } from '../models/pokeapi.dto';
import {
  PokemonAbilityOptionVM,
  PokemonItemOptionVM,
  PokemonMoveDetailVM,
  PokemonMoveOptionVM,
  PokemonNatureOptionVM,
  PokemonStatVM,
  PokemonVM,
} from '../models/view.model';

@Injectable({ providedIn: 'root' })
export class PokemonMapper {
  toVM(dto: PokemonDTO): PokemonVM {
    const abilityOptions = (dto.abilities ?? [])
      .slice()
      .sort((a, b) => a.slot - b.slot)
      .map((ability) => this.abilityOptionFromDto(ability))
      .filter((ability): ability is PokemonAbilityOptionVM => !!ability);

    const defaultAbility = abilityOptions.find((option) => !option.isHidden) ?? abilityOptions[0] ?? null;

    const base: PokemonVM = {
      id: dto.id,
      name: dto.name,
      sprite: dto.sprites.front_default,
      types: dto.types.sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
      typeDetails: dto.types
        .sort((a, b) => a.slot - b.slot)
        .map((t) => ({ name: t.type.name, url: t.type.url })),
      stats: this.normalizeStats(
        dto.stats?.map((stat) => ({
          name: stat.stat.name,
          label: STAT_LABELS[stat.stat.name] ?? this.toTitleCase(stat.stat.name.replace(/-/g, ' ')),
          baseValue: stat.base_stat,
          value: stat.base_stat,
          iv: STAT_IV_MIN,
          ev: STAT_EV_MIN,
        })) ?? []
      ),
      level: 50,
      abilityOptions,
      selectedAbility: defaultAbility,
      heldItem: null,
      selectedNature: null,
      moves:
        dto.moves?.map((move) => ({
          name: move.move.name,
          label: this.formatMoveName(move.move.name),
          url: move.move.url,
          type: null,
          power: null,
          accuracy: null,
          damageClass: null,
          effect: null,
        })) ?? [],
      selectedMoves: [],
    };

    return this.normalizeVM(base);
  }

  normalizeVM(value: PokemonVM): PokemonVM {
    const abilityOptions = this.normalizeAbilityOptions(value.abilityOptions);
    const selectedAbility =
      this.selectAbilityOption(abilityOptions, value.selectedAbility?.url ?? null) ??
      (!value.selectedAbility && abilityOptions.length ? abilityOptions[0] : null);
    const heldItem = this.normalizeItemOption(value.heldItem);
    const level = this.normalizeLevel(value.level);
    const selectedNature = this.normalizeNatureOption(value.selectedNature);
    const normalizedStats = this.normalizeStats(value.stats);
    const stats = this.calculateStatValues(normalizedStats, level, selectedNature);

    return {
      ...value,
      types: Array.isArray(value.types) ? [...value.types] : [],
      typeDetails: Array.isArray(value.typeDetails)
        ? value.typeDetails.map((type) => ({ name: type.name, url: type.url }))
        : [],
      stats,
      level,
      abilityOptions,
      selectedAbility,
      heldItem,
      moves: this.normalizeMoveOptions(value.moves),
      selectedNature,
      selectedMoves: this.normalizeSelectedMoves(value.selectedMoves),
    };
  }

  moveDetailFromDto(dto: MoveDTO, url: string): PokemonMoveDetailVM {
    return {
      name: this.formatMoveName(dto.name),
      url,
      type: dto.type && dto.type.url ? { name: dto.type.name, url: dto.type.url } : null,
      power: dto.power ?? null,
      accuracy: dto.accuracy ?? null,
      damageClass: dto.damage_class?.name ?? null,
      effect: this.formatEffectText(dto),
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
      damageClass: null,
      effect: null,
    };
  }

  normalizeMoveDetail(detail: PokemonMoveDetailVM | null): PokemonMoveDetailVM | null {
    if (!detail || typeof detail.url !== 'string' || !detail.url.trim()) {
      return null;
    }

    const type = detail.type && detail.type.url ? { name: detail.type.name, url: detail.type.url } : null;

    return {
      name: this.formatMoveName(detail.name ?? this.extractNameFromUrl(detail.url)),
      url: detail.url,
      type,
      power: detail.power ?? null,
      accuracy: detail.accuracy ?? null,
      damageClass: detail.damageClass ?? null,
      effect: detail.effect ?? null,
    };
  }

  abilityOptionFromUrl(url: string, isHidden = false): PokemonAbilityOptionVM {
    const name = this.extractNameFromUrl(url);
    return this.normalizeAbilityOption({
      name,
      label: this.formatAbilityName(name),
      url,
      isHidden,
    });
  }

  itemOptionFromResource(resource: NamedAPIResource): PokemonItemOptionVM | null {
    if (!resource?.url) {
      return null;
    }

    return this.normalizeItemOption({
      name: resource.name,
      label: this.formatItemName(resource.name),
      url: resource.url,
      sprite: this.buildItemSpriteUrl(resource.name),
    });
  }

  itemOptionFromUrl(url: string): PokemonItemOptionVM | null {
    const name = this.extractNameFromUrl(url);
    return this.normalizeItemOption({
      name,
      label: this.formatItemName(name),
      url,
      sprite: this.buildItemSpriteUrl(name),
    });
  }

  natureOptionFromDto(dto: NatureDTO & { url: string }): PokemonNatureOptionVM {
    return this.normalizeNatureOption({
      name: dto.name,
      label: this.formatNatureName(dto.name),
      url: dto.url,
      increasedStat: dto.increased_stat?.name ?? null,
      decreasedStat: dto.decreased_stat?.name ?? null,
    })!;
  }

  natureOptionFromUrl(url: string): PokemonNatureOptionVM {
    const name = this.extractNameFromUrl(url);
    return this.normalizeNatureOption({
      name,
      label: this.formatNatureName(name),
      url,
      increasedStat: null,
      decreasedStat: null,
    })!;
  }

  private abilityOptionFromDto(ability: PokemonAbilityDTO | undefined): PokemonAbilityOptionVM | null {
    if (!ability?.ability?.url) {
      return null;
    }

    const url = ability.ability.url;
    const name = ability.ability.name ?? this.extractNameFromUrl(url);

    return this.normalizeAbilityOption({
      name,
      label: this.formatAbilityName(name),
      url,
      isHidden: !!ability.is_hidden,
    });
  }

  private normalizeAbilityOptions(
    options: PokemonAbilityOptionVM[] | undefined
  ): PokemonAbilityOptionVM[] {
    if (!Array.isArray(options)) {
      return [];
    }

    return options
      .filter(
        (option): option is PokemonAbilityOptionVM =>
          !!option && typeof option.url === 'string' && !!option.url.trim()
      )
      .map((option) => this.normalizeAbilityOption(option));
  }

  private normalizeAbilityOption(option: {
    name?: string;
    label?: string;
    url: string;
    isHidden?: boolean;
  }): PokemonAbilityOptionVM {
    const url = (option.url ?? '').trim();
    const baseName = (option.name ?? this.extractNameFromUrl(url)).trim();
    const label = (option.label ?? this.formatAbilityName(baseName)).trim();

    return {
      name: baseName,
      label: label || this.formatAbilityName(baseName),
      url,
      isHidden: !!option.isHidden,
    };
  }

  private selectAbilityOption(
    options: PokemonAbilityOptionVM[],
    url: string | null
  ): PokemonAbilityOptionVM | null {
    const normalized = url?.trim();
    if (!normalized) {
      return null;
    }

    const match = options.find((option) => option.url === normalized);
    if (match) {
      return this.normalizeAbilityOption(match);
    }

    return this.abilityOptionFromUrl(normalized);
  }

  private normalizeItemOption(
    option: PokemonItemOptionVM | (Partial<PokemonItemOptionVM> & { url?: string }) | null | undefined
  ): PokemonItemOptionVM | null {
    if (!option || typeof option.url !== 'string') {
      return null;
    }

    const url = option.url.trim();
    if (!url) {
      return null;
    }

    const baseName = (option.name ?? this.extractNameFromUrl(url)).trim();
    const label = (option.label ?? this.formatItemName(baseName)).trim();

    return {
      name: baseName,
      label: label || this.formatItemName(baseName),
      url,
      sprite: option.sprite ?? this.buildItemSpriteUrl(baseName),
    };
  }

  private buildItemSpriteUrl(name: string | undefined | null): string | null {
    const normalized = (name ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '');

    if (!normalized) {
      return null;
    }

    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/${normalized}.png`;
  }

  private normalizeStats(stats: PokemonStatVM[] | undefined | null): PokemonStatVM[] {
    const normalizedStats: PokemonStatVM[] = Array.isArray(stats)
      ? stats.map((stat) => {
          const name = (stat?.name ?? '').toString();
          const label = stat?.label ?? STAT_LABELS[name] ?? this.toTitleCase(name.replace(/-/g, ' '));
          const baseValue = this.clampBaseStat((stat as PokemonStatVM | undefined)?.baseValue ?? stat?.value);
          const value = this.clampBaseStat(stat?.value ?? baseValue);
          const iv = this.clampInteger(stat?.iv, STAT_IV_MIN, STAT_IV_MAX);
          const ev = this.clampInteger(stat?.ev, STAT_EV_MIN, STAT_EV_MAX);

          return {
            name,
            label,
            baseValue,
            value,
            iv,
            ev,
          } satisfies PokemonStatVM;
        })
      : [];

    let totalEv = normalizedStats.reduce((sum, stat) => sum + stat.ev, 0);
    if (totalEv <= STAT_TOTAL_EV_MAX) {
      return normalizedStats;
    }

    let overflow = totalEv - STAT_TOTAL_EV_MAX;
    for (let index = normalizedStats.length - 1; index >= 0 && overflow > 0; index -= 1) {
      const stat = normalizedStats[index];
      const reduction = Math.min(stat.ev, overflow);
      stat.ev -= reduction;
      overflow -= reduction;
    }

    if (overflow > 0 && normalizedStats.length) {
      normalizedStats[0].ev = Math.max(STAT_EV_MIN, normalizedStats[0].ev - overflow);
    }

    return normalizedStats;
  }

  private calculateStatValues(
    stats: PokemonStatVM[],
    level: number,
    nature: PokemonNatureOptionVM | null
  ): PokemonStatVM[] {
    const increased = nature?.increasedStat ?? null;
    const decreased = nature?.decreasedStat ?? null;

    return stats.map((stat) => {
      const evContribution = Math.floor(stat.ev / 4);
      const baseComponent = Math.floor(((stat.baseValue * 2 + stat.iv + evContribution) * level) / 100);
      const natureMultiplier = this.getNatureMultiplier(stat.name, increased, decreased);
      const calculated = Math.floor((baseComponent + 5) * natureMultiplier);

      return {
        ...stat,
        value: Math.max(0, calculated),
      } satisfies PokemonStatVM;
    });
  }

  private getNatureMultiplier(
    statName: string,
    increased: string | null,
    decreased: string | null
  ): number {
    if (increased && statName === increased) {
      return 1.1;
    }

    if (decreased && statName === decreased) {
      return 0.9;
    }

    return 1;
  }

  private clampInteger(value: unknown, min: number, max: number): number {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) {
      return min;
    }

    const rounded = Math.floor(numeric);
    return Math.min(max, Math.max(min, rounded));
  }

  private clampBaseStat(value: unknown): number {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) {
      return 0;
    }

    return Math.max(0, Math.round(numeric));
  }

  private normalizeLevel(level: number | null | undefined): number {
    const numeric = typeof level === 'number' ? level : Number(level);
    if (!Number.isFinite(numeric)) {
      return 50;
    }

    return Math.min(100, Math.max(1, Math.round(numeric)));
  }

  private normalizeNatureOption(
    option:
      | PokemonNatureOptionVM
      | null
      | undefined
      | {
          name?: string;
          label?: string;
          url?: string;
          increasedStat?: string | null;
          decreasedStat?: string | null;
        }
  ): PokemonNatureOptionVM | null {
    if (!option) {
      return null;
    }

    const url = option.url?.trim();
    if (!url) {
      return null;
    }

    const name = option.name ?? this.extractNameFromUrl(url);

    return {
      name,
      label: option.label ?? this.formatNatureName(name),
      url,
      increasedStat: option.increasedStat ?? null,
      decreasedStat: option.decreasedStat ?? null,
    };
  }

  private formatNatureName(value: string): string {
    return this.toTitleCase((value ?? '').replace(/-/g, ' '));
  }

  private toTitleCase(value: string): string {
    return value.replace(/\w\S*/g, (txt) => txt[0].toUpperCase() + txt.substring(1).toLowerCase());
  }

  private formatMoveName(value: string | undefined | null): string {
    const normalized = (value ?? '').trim();
    if (!normalized) return 'Move';
    return this.toTitleCase(normalized.replace(/-/g, ' '));
  }

  private formatAbilityName(value: string | undefined | null): string {
    const normalized = (value ?? '').trim();
    if (!normalized) return 'Ability';
    return this.toTitleCase(normalized.replace(/-/g, ' '));
  }

  private formatItemName(value: string | undefined | null): string {
    const normalized = (value ?? '').trim();
    if (!normalized) return 'Item';
    return this.toTitleCase(normalized.replace(/-/g, ' '));
  }

  private formatEffectText(dto: MoveDTO): string | null {
    const entries = dto.effect_entries ?? [];
    if (!entries.length) {
      return null;
    }

    const preferred =
      entries.find((entry) => entry.language?.name === 'en') ??
      entries.find((entry) => entry.language?.name === 'es') ??
      entries[0];

    if (!preferred) {
      return null;
    }

    const base = preferred.short_effect || preferred.effect;
    if (!base) {
      return null;
    }

    const effectChance = dto.effect_chance ?? null;
    const normalized = effectChance === null || effectChance === undefined
      ? base
      : base.replace(/\$effect_chance/g, String(effectChance));

    return normalized.replace(/\s+/g, ' ').trim();
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
        damageClass: option.damageClass ?? null,
        effect: option.effect ?? null,
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
