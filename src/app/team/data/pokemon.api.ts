import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { PokemonDTO, PokemonListResponse } from '../models/pokeapi.dto';

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
}
