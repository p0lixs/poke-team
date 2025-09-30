import { Injectable } from '@angular/core';
import { STAT_LABELS } from '../../shared/util/constants';
import { PokemonDTO } from '../models/pokeapi.dto';
import { PokemonVM } from '../models/view.model';

@Injectable({ providedIn: 'root' })
export class PokemonMapper {
  toVM(dto: PokemonDTO): PokemonVM {
    return {
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
    };
  }

  private toTitleCase(value: string): string {
    return value.replace(/\w\S*/g, (txt) => txt[0].toUpperCase() + txt.substring(1).toLowerCase());
  }
}
