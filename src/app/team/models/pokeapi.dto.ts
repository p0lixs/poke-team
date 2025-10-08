export interface PokemonDTO {
  id: number;
  name: string;
  sprites: { front_default: string | null };
  types: { slot: number; type: { name: string; url: string } }[];
  stats: { base_stat: number; stat: { name: string } }[];
  moves: { move: { name: string; url: string } }[];
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
  effect_chance: number | null;
  damage_class: { name: string } | null;
  type: { name: string; url: string } | null;
  effect_entries: { effect: string; short_effect: string; language: { name: string } }[];
}
