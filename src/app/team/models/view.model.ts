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
  moves: PokemonMoveOptionVM[];
  selectedMoves: (PokemonMoveDetailVM | null)[];
}

export interface PokemonMoveOptionVM {
  name: string;
  label: string;
  url: string;
}

export interface PokemonMoveDetailVM {
  name: string;
  url: string;
  type: { name: string; url: string } | null;
  power: number | null;
}

export interface PokemonMoveSelectionPayload {
  pokemonId: number;
  slot: number;
  moveUrl: string | null;
}
