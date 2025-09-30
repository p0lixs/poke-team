import { Injectable, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { PokemonApi } from './pokemon.api';
import { PokemonMapper } from './pokemon.mapper';
import { PokemonVM } from '../models/view.model';
import { toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, filter, forkJoin, map, of, switchMap, take, tap } from 'rxjs';
import { PokemonDTO } from '../models/pokeapi.dto';
import { TeamRepository } from './team.repository';

const MAX_TEAM = 6;

@Injectable({ providedIn: 'root' })
export class TeamFacade {
  private api = inject(PokemonApi);
  private mapper = inject(PokemonMapper);
  private repository = inject(TeamRepository);
  private readonly teamLoaded = signal(false);
  private readonly lastSynced = signal<string | null>(null);

  // --- Search state ---
  readonly query: WritableSignal<string> = signal('');
  private readonly allNames = signal<string[] | null>(null);

  readonly filteredNames = computed(() => {
    const q = this.query().trim().toLowerCase();
    const all = this.allNames();
    if (!q || !all) return [] as string[];
    return all.filter((n) => n.includes(q)).slice(0, 20);
  });

  readonly results = signal<PokemonVM[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // --- Team state ---
  readonly team = signal<PokemonVM[]>([]);
  readonly canAdd = computed(() => this.team().length < MAX_TEAM);

  constructor() {
    // Boot: load all names once
    this.api
      .getAllNames()
      .pipe(take(1))
      .subscribe({
        next: (names) => this.allNames.set(names),
        error: () => this.error.set('No se pudo cargar la lista de Pokémon'),
      });

    // Load team from Firebase once
    this.repository
      .loadTeam()
      .then((members) => {
        this.team.set(Array.isArray(members) ? members : []);
        this.lastSynced.set(JSON.stringify(this.team()));
      })
      .catch((error) => {
        console.error(error);
        this.lastSynced.set(JSON.stringify(this.team()));
      })
      .finally(() => {
        this.teamLoaded.set(true);
      });

    // Persist team updates to Firebase
    effect(() => {
      if (!this.teamLoaded()) return;
      const current = this.team();
      const serialized = JSON.stringify(current);
      if (this.lastSynced() === serialized) return;
      void this.repository
        .saveTeam(current)
        .then(() => this.lastSynced.set(serialized))
        .catch((error) => console.error(error));
    });

    // Reactive search using signals→observable
    toObservable(this.query)
      .pipe(
        map((q) => q.trim().toLowerCase()),
        debounceTime(250),
        distinctUntilChanged(),
        tap(() => {
          this.loading.set(true);
          this.error.set(null);
          this.results.set([]);
        }),
        filter((q) => q.length >= 2),
        switchMap((q) => {
          const candidates = this.filteredNames();
          if (!candidates.length) return of<PokemonDTO[]>([]);
          // fetch details for up to 20 matches in parallel
          return forkJoin(
            candidates.map((name) => this.api.getPokemonByName(name).pipe(take(1)))
          );
        })
      )
      .subscribe({
        next: (dtos: PokemonDTO[]) => {
          const list = Array.isArray(dtos) ? dtos.map(this.mapper.toVM) : [];
          this.results.set(list);
          this.loading.set(false);
        },
        error: (err) => {
          console.error(err);
          this.error.set('Error de búsqueda');
          this.loading.set(false);
        },
      });
  }

  async addToTeam(p: PokemonVM) {
    if (!this.canAdd()) return;
    const exists = this.team().some((x) => x.id === p.id);
    if (exists) return; // evitar duplicados
    this.team.update((arr) => [...arr, p]);
  }

  removeFromTeam(id: number) {
    this.team.update((arr) => arr.filter((x) => x.id !== id));
  }

  clearTeam() {
    this.team.set([]);
  }
}
