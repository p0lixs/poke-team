export interface PokemonStatVM {
  name: string;
  label: string;
  value: number;
}

export interface PokemonVM {
  id: number;
  name: string;
  sprite: string | null;
  types: string[];
  typeDetails: { name: string; url: string }[];
  stats: PokemonStatVM[];
}
