import { Injectable } from '@angular/core';
import { STAT_LABELS } from '../../shared/util/constants';
import { MoveDTO, PokemonAbilityDTO, PokemonDTO, NamedAPIResource } from '../models/pokeapi.dto';
import {
  PokemonAbilityOptionVM,
  PokemonItemOptionVM,
  PokemonMoveDetailVM,
  PokemonMoveOptionVM,
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
      stats:
        dto.stats?.map((stat) => ({
          name: stat.stat.name,
          label: STAT_LABELS[stat.stat.name] ?? this.toTitleCase(stat.stat.name.replace(/-/g, ' ')),
          value: stat.base_stat,
        })) ?? [],
      abilityOptions,
      selectedAbility: defaultAbility,
      heldItem: null,
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
      abilityOptions,
      selectedAbility,
      heldItem,
      moves: this.normalizeMoveOptions(value.moves),
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
