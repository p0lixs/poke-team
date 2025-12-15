import { Injectable } from '@angular/core';
import { POKEMON_USAGE } from './pokemon-usage.data';

@Injectable({ providedIn: 'root' })
export class PokemonUsageService {
  private normalizeName(name: string | null | undefined): string | null {
    if (!name) return null;
    const slug = name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
    return slug || null;
  }

  getUsagePercent(name: string | null | undefined): number | null {
    const key = this.normalizeName(name);
    if (!key) return null;
    const value = POKEMON_USAGE[key];
    return typeof value === 'number' ? value : null;
  }
}
