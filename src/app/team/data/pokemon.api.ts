import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, of, switchMap } from 'rxjs';
import {
  ItemListResponse,
  MoveDTO,
  PokemonDTO,
  PokemonListResponse,
  NamedAPIResource,
  NatureDTO,
  NatureListResponse,
} from '../models/pokeapi.dto';

const API = 'https://pokeapi.co/api/v2';

@Injectable({ providedIn: 'root' })
export class PokemonApi {
  private http = inject(HttpClient);

  getAllNames(): Observable<string[]> {
    // PokeAPI doesn't offer substring search; pull all names once (cached by facade)
    return this.http
      .get<PokemonListResponse>(`${API}/pokemon?limit=2000&offset=0`)
      .pipe(map((r) => r.results.map((x) => x.name)));
  }

  getPokemonByName(name: string): Observable<PokemonDTO> {
    return this.http.get<PokemonDTO>(`${API}/pokemon/${name.toLowerCase()}`);
  }

  getMoveByUrl(url: string): Observable<MoveDTO> {
    return this.http.get<MoveDTO>(url);
  }

  getAllItems(): Observable<NamedAPIResource[]> {
    return this.http
      .get<ItemListResponse>(`${API}/item?limit=1000&offset=0`)
      .pipe(map((response) => response.results ?? []));
  }

  getAllNatures(): Observable<(NatureDTO & { url: string })[]> {
    return this.http.get<NatureListResponse>(`${API}/nature?limit=100&offset=0`).pipe(
      switchMap((response) => {
        const results = response.results ?? [];
        if (!results.length) {
          return of<(NatureDTO & { url: string })[]>([]);
        }

        return forkJoin(
          results.map((resource) =>
            this.http
              .get<NatureDTO>(resource.url)
              .pipe(map((dto) => ({ ...dto, url: resource.url })))
          )
        );
      })
    );
  }
}
