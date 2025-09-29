import { Injectable } from '@angular/core';
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
    };
  }
}
