export interface PokemonDTO {
  id: number;
  name: string;
  sprites: { front_default: string | null };
  types: { slot: number; type: { name: string; url: string } }[];
  stats: { base_stat: number; stat: { name: string } }[];
}

export interface PokemonNameItem {
  name: string;
  url: string;
}
export interface PokemonListResponse {
  count: number;
  results: PokemonNameItem[];
}
