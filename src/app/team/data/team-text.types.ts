export type ParsedStatKey =
  | 'hp'
  | 'attack'
  | 'defense'
  | 'special-attack'
  | 'special-defense'
  | 'speed';

export interface ParsedPokemonSet {
  rawName: string;
  species: string;
  item: string | null;
  ability: string | null;
  level: number | null;
  teraType: string | null;
  nature: string | null;
  evs: Partial<Record<ParsedStatKey, number>>;
  ivs: Partial<Record<ParsedStatKey, number>>;
  moves: string[];
}
