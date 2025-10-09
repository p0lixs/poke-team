export interface PokemonDTO {
  id: number;
  name: string;
  sprites: { front_default: string | null };
  types: { slot: number; type: { name: string; url: string } }[];
  stats: { base_stat: number; stat: { name: string } }[];
  moves: { move: { name: string; url: string } }[];
  abilities: PokemonAbilityDTO[];
}

export interface PokemonNameItem {
  name: string;
  url: string;
}
export interface PokemonListResponse {
  count: number;
  results: PokemonNameItem[];
}

export interface MoveDTO {
  id: number;
  name: string;
  power: number | null;
  accuracy: number | null;
  damage_class: { name: string } | null;
  type: { name: string; url: string } | null;
  effect_entries?: {
    effect: string;
    short_effect: string;
    language: { name: string };
  }[];
  effect_chance?: number | null;
}

export interface PokemonAbilityDTO {
  ability: { name: string; url: string };
  is_hidden: boolean;
  slot: number;
}

export interface ItemListResponse {
  count: number;
  results: NamedAPIResource[];
}

export interface NamedAPIResource {
  name: string;
  url: string;
}

export interface NatureDTO {
  id: number;
  name: string;
  increased_stat: { name: string; url: string } | null;
  decreased_stat: { name: string; url: string } | null;
}

export interface NatureListResponse {
  count: number;
  results: NamedAPIResource[];
}
