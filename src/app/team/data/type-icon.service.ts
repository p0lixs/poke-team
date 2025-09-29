// type-icon.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, shareReplay } from 'rxjs/operators';
import { Observable, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TypeIconService {
  private cache = new Map<string, Observable<string | null>>();

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

  /** Selecciona la mejor URL de icono dentro de `sprites` (estructura no documentada). */
  private pickIconUrl(sprites: any): string | null {
    if (!sprites) return null;

    // 1) Si existen claves que sugieran Gen 9 / SV, dales prioridad
    const preferKeys = ['generation-ix', 'scarlet-violet', 'sv', 'gen9', 'home'];
    for (const k of preferKeys) {
      const found = this.findFirstImageUrl(sprites[k]);
      if (found) return found;
    }

    // 2) Fallback: recorre todo el objeto y devuelve el primer SVG/PNG que encuentre
    return this.findFirstImageUrl(sprites);
  }

  /** Busca recursivamente la primera cadena que parezca URL de imagen. */
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
