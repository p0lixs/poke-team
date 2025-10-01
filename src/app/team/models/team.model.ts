import { PokemonVM } from './view.model';

export interface SavedTeam {
  id: string;
  name: string;
  members: PokemonVM[];
}
