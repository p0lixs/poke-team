import type {
  Ability,
  Move,
  NamedAPIResource as NamedAPIResourceType,
  NamedAPIResourceList,
  Nature,
  Pokemon,
  PokemonAbility,
  Type,
} from 'pokenode-ts';

export type PokemonDTO = Pokemon;
export type PokemonAbilityDTO = PokemonAbility;
export type PokemonNameItem = NamedAPIResourceType;
export type PokemonListResponse = NamedAPIResourceList;
export type MoveDTO = Move;
export type AbilityDTO = Ability;
export type ItemListResponse = NamedAPIResourceList;
export type NamedAPIResource = NamedAPIResourceType;
export type NatureDTO = Nature;
export type NatureListResponse = NamedAPIResourceList;
export type TypeDTO = Type;
