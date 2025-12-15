import { PokemonVM } from '../../../models/view.model';

export interface WeaknessCell {
  type: string;
  multiplier: number;
  label: string;
  isImmune: boolean;
  isResist: boolean;
  isQuarterResist: boolean;
  isNeutral: boolean;
  isWeak: boolean;
  isQuadWeak: boolean;
}

export interface WeaknessRow {
  pokemon: PokemonVM;
  cells: WeaknessCell[];
  teraType: string | null;
  useTera: boolean;
}

export interface WeaknessSummaryRow {
  type: string;
  count: number;
}

export interface WeaknessTable {
  rows: WeaknessRow[];
  summary: WeaknessSummaryRow[];
}
