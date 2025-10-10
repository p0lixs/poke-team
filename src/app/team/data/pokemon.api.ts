import { Injectable } from '@angular/core';
import { ItemClient, MoveClient, PokemonClient } from 'pokenode-ts';
import { Observable, forkJoin, from, map, of, switchMap, throwError } from 'rxjs';
import { MoveDTO, NamedAPIResource, NatureDTO, PokemonDTO } from '../models/pokeapi.dto';

@Injectable({ providedIn: 'root' })
export class PokemonApi {
  private pokemonClient = new PokemonClient();
  private moveClient = new MoveClient();
  private itemClient = new ItemClient();

  getAllNames(): Observable<string[]> {
    // PokeAPI doesn't offer substring search; pull all names once (cached by facade)
    return from(this.pokemonClient.listPokemons(0, 2000)).pipe(
      map((response) => response.results?.map((x) => x.name) ?? [])
    );
  }

  getPokemonByName(name: string): Observable<PokemonDTO> {
    return from(this.pokemonClient.getPokemonByName(name.toLowerCase()));
  }

  getMoveByUrl(url: string): Observable<MoveDTO> {
    const identifier = this.extractResourceIdentifier(url);
    if (identifier === null) {
      return throwError(() => new Error(`Invalid move url: ${url}`));
    }

    return typeof identifier === 'number'
      ? from(this.moveClient.getMoveById(identifier))
      : from(this.moveClient.getMoveByName(identifier));
  }

  getAllItems(): Observable<NamedAPIResource[]> {
    return from(this.itemClient.listItems(0, 2000)).pipe(map((response) => response.results ?? []));
  }

  getAllNatures(): Observable<(NatureDTO & { url: string })[]> {
    return from(this.pokemonClient.listNatures(0, 100)).pipe(
      switchMap((response) => {
        const results = response.results ?? [];
        if (!results.length) {
          return of<(NatureDTO & { url: string })[]>([]);
        }

        return forkJoin(
          results.map((resource) =>
            from(this.pokemonClient.getNatureByName(resource.name)).pipe(
              map((dto) => ({ ...dto, url: resource.url }))
            )
          )
        );
      })
    );
  }

  private extractResourceIdentifier(url: string): string | number | null {
    try {
      const pathname = new URL(url).pathname;
      const segments = pathname.split('/').filter(Boolean);
      const lastSegment = segments.pop();
      if (!lastSegment) {
        return null;
      }

      const numericId = Number(lastSegment);
      return Number.isNaN(numericId) ? lastSegment : numericId;
    } catch {
      return null;
    }
  }
}
