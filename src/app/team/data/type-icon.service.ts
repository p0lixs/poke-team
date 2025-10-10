// type-icon.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, shareReplay } from 'rxjs/operators';
import { Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TypeIconService {
  private cache = new Map<string, Observable<string | null>>();
  private readonly teraIconBaseUrl = 'https://play.pokemonshowdown.com/sprites/types/';
  private readonly teraIconMap: Record<string, string> = {
    normal: 'TeraNormal.png',
    fire: 'TeraFire.png',
    water: 'TeraWater.png',
    electric: 'TeraElectric.png',
    grass: 'TeraGrass.png',
    ice: 'TeraIce.png',
    fighting: 'TeraFighting.png',
    poison: 'TeraPoison.png',
    ground: 'TeraGround.png',
    flying: 'TeraFlying.png',
    psychic: 'TeraPsychic.png',
    bug: 'TeraBug.png',
    rock: 'TeraRock.png',
    ghost: 'TeraGhost.png',
    dragon: 'TeraDragon.png',
    dark: 'TeraDark.png',
    steel: 'TeraSteel.png',
    fairy: 'TeraFairy.png',
  };

  constructor(private http: HttpClient) {}

  getIconByTypeUrl(typeUrl: string): Observable<string | null> {
    if (!typeUrl) return of(null);
    if (this.cache.has(typeUrl)) return this.cache.get(typeUrl)!;

    const req$ = this.http.get<any>(typeUrl).pipe(
      map((typeResp) => this.pickIconUrl(typeResp?.sprites)),
      shareReplay(1)
    );

    this.cache.set(typeUrl, req$);
    return req$;
  }

  getTeraIconByName(typeName: string | null | undefined): string | null {
    if (!typeName) return null;

    const normalized = typeName.trim();
    if (!normalized) {
      return null;
    }

    const file = this.teraIconMap[normalized];
    if (file) {
      return `${this.teraIconBaseUrl}${file}`;
    }

    const fallback = `Tera${normalized}.png`;
    return `${this.teraIconBaseUrl}${fallback}`;
  }

  /** Selects the best icon URL within `sprites` (undocumented structure). */
  private pickIconUrl(sprites: any): string | null {
    if (!sprites) return null;

    // 1) If there are keys that suggest Gen 9 / SV, give them priority
    const preferKeys = ['generation-ix', 'scarlet-violet', 'sv', 'gen9', 'home'];
    for (const k of preferKeys) {
      const found = this.findFirstImageUrl(sprites[k]);
      if (found) return found;
    }

    // 2) Fallback: walk the entire object and return the first SVG/PNG that appears
    return this.findFirstImageUrl(sprites);
  }

  /** Recursively searches for the first string that looks like an image URL. */
  private findFirstImageUrl(node: any): string | null {
    if (!node) return null;
    if (typeof node === 'string' && /\.(svg|png|webp)(\?|$)/i.test(node)) return node;
    if (Array.isArray(node)) {
      for (const v of node) {
        const found = this.findFirstImageUrl(v);
        if (found) return found;
      }
      return null;
    }
    if (typeof node === 'object') {
      for (const key of Object.keys(node)) {
        const found = this.findFirstImageUrl(node[key]);
        if (found) return found;
      }
    }
    return null;
  }
}
