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
  abilityOptions: PokemonAbilityOptionVM[];
  selectedAbility: PokemonAbilityOptionVM | null;
  heldItem: PokemonItemOptionVM | null;
  moves: PokemonMoveOptionVM[];
  selectedMoves: (PokemonMoveDetailVM | null)[];
}

export interface PokemonAbilityOptionVM {
  name: string;
  label: string;
  url: string;
  isHidden: boolean;
}

export interface PokemonItemOptionVM {
  name: string;
  label: string;
  url: string;
  sprite?: string | null;
}

export interface PokemonMoveOptionVM {
  name: string;
  label: string;
  url: string;
  type: { name: string; url: string } | null;
  power: number | null;
  accuracy: number | null;
  damageClass: string | null;
  effect: string | null;
}

export interface PokemonMoveDetailVM {
  name: string;
  url: string;
  type: { name: string; url: string } | null;
  power: number | null;
  accuracy: number | null;
  damageClass: string | null;
  effect: string | null;
}

export interface PokemonMoveSelectionPayload {
  pokemonId: number;
  slot: number;
  moveUrl: string | null;
}

export interface PokemonAbilitySelectionPayload {
  pokemonId: number;
  abilityUrl: string | null;
}

export interface PokemonItemSelectionPayload {
  pokemonId: number;
  itemUrl: string | null;
}
