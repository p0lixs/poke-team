import type {
  Move,
  NamedAPIResource as NamedAPIResourceType,
  NamedAPIResourceList,
  Nature,
  Pokemon,
  PokemonAbility,
} from 'pokenode-ts';

export type PokemonDTO = Pokemon;
export type PokemonAbilityDTO = PokemonAbility;
export type PokemonNameItem = NamedAPIResourceType;
export type PokemonListResponse = NamedAPIResourceList;
export type MoveDTO = Move;
export type ItemListResponse = NamedAPIResourceList;
export type NamedAPIResource = NamedAPIResourceType;
export type NatureDTO = Nature;
export type NatureListResponse = NamedAPIResourceList;
