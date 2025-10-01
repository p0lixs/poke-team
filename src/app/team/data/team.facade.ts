import { Injectable, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { PokemonApi } from './pokemon.api';
import { PokemonMapper } from './pokemon.mapper';
import { PokemonMoveDetailVM, PokemonMoveSelectionPayload, PokemonVM } from '../models/view.model';
import { toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, filter, forkJoin, map, of, switchMap, take, tap } from 'rxjs';
import { PokemonDTO } from '../models/pokeapi.dto';
import { TeamRepository } from './team.repository';
import { SavedTeam } from '../models/team.model';

const MAX_TEAM = 6;

@Injectable({ providedIn: 'root' })
export class TeamFacade {
  private api = inject(PokemonApi);
  private mapper = inject(PokemonMapper);
  private repository = inject(TeamRepository);
  private readonly teamLoaded = signal(false);
  private readonly lastSynced = signal<Map<string, string>>(new Map());
  private readonly moveDetailsCache = new Map<string, PokemonMoveDetailVM>();
  private readonly newTeamDraft = signal<{ name: string; members: PokemonVM[] }>({
    name: 'Nuevo equipo',
    members: [],
  });

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
  readonly teamName = signal('Nuevo equipo');
  readonly savedTeams = signal<SavedTeam[]>([]);
  readonly selectedTeamId = signal<string | null>(null);
  readonly canAdd = computed(() => this.team().length < MAX_TEAM);
  readonly hasSavedTeams = computed(() => this.savedTeams().length > 0);
  readonly isExistingTeam = computed(() => this.selectedTeamId() !== null);

  constructor() {
    // Boot: load all names once
    this.api
      .getAllNames()
      .pipe(take(1))
      .subscribe({
        next: (names) => this.allNames.set(names),
        error: () => this.error.set('No se pudo cargar la lista de Pokémon'),
      });

    // Load saved teams once
    this.repository
      .loadTeams()
      .then((teams) => {
        const normalizedTeams = teams.map((team) => ({
          ...team,
          members: this.normalizeTeamMembers(team.members ?? []),
        }));

        this.savedTeams.set(normalizedTeams);
        if (normalizedTeams.length) {
          const first = normalizedTeams[0];
          this.selectedTeamId.set(first.id);
          this.teamName.set(first.name);
          this.team.set(this.normalizeTeamMembers(first.members));
          this.updateLastSynced(first.id, first.name, first.members);
        } else {
          this.selectedTeamId.set(null);
          const draft = this.newTeamDraft();
          this.teamName.set(draft.name);
          this.team.set(this.normalizeTeamMembers(draft.members));
        }
      })
      .catch((error) => {
        console.error(error);
      })
      .finally(() => {
        this.teamLoaded.set(true);
      });

    // Persist updates to the active saved team
    effect(() => {
      if (!this.teamLoaded()) return;
      const id = this.selectedTeamId();
      if (!id) return;

      const currentName = this.teamName();
      const normalizedName = this.normalizeName(currentName);
      if (normalizedName !== currentName) {
        queueMicrotask(() => this.teamName.set(normalizedName));
        return;
      }

      const members = this.normalizeTeamMembers(this.team());
      const serialized = this.serialize(normalizedName, members);
      const last = this.lastSynced().get(id);
      if (last === serialized) return;

      void this.repository
        .updateTeam(id, { name: normalizedName, members })
        .then(() => {
          this.updateLastSynced(id, normalizedName, members);
          this.savedTeams.update((list) =>
            list.map((team) =>
              team.id === id
                ? { ...team, name: normalizedName, members: this.normalizeTeamMembers(members) }
                : team
            )
          );
        })
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
          const list = Array.isArray(dtos) ? dtos.map((dto) => this.mapper.toVM(dto)) : [];
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
    const pokemon = this.mapper.normalizeVM(p);
    this.team.update((arr) => {
      const next = [...arr, pokemon];
      this.syncDraftMembers(next);
      return next;
    });
  }

  removeFromTeam(id: number) {
    this.team.update((arr) => {
      const next = arr.filter((x) => x.id !== id);
      this.syncDraftMembers(next);
      return next;
    });
  }

  clearTeam() {
    this.team.set([]);
    this.syncDraftMembers([]);
  }

  setTeamName(name: string) {
    this.teamName.set(name);
    if (!this.selectedTeamId()) {
      this.newTeamDraft.update((draft) => ({ ...draft, name }));
    }
  }

  selectTeam(id: string | null) {
    if (this.selectedTeamId() === id) return;

    const currentId = this.selectedTeamId();
    if (!currentId) {
      this.newTeamDraft.set({
        name: this.teamName(),
        members: this.normalizeTeamMembers(this.team()),
      });
    }

    if (id === null) {
      const draft = this.newTeamDraft();
      this.selectedTeamId.set(null);
      this.teamName.set(draft.name);
      this.team.set(this.normalizeTeamMembers(draft.members));
      return;
    }

    const target = this.savedTeams().find((team) => team.id === id);
    if (!target) return;

    this.selectedTeamId.set(id);
    this.teamName.set(target.name);
    this.team.set(this.normalizeTeamMembers(target.members));
    this.updateLastSynced(id, target.name, target.members);
  }

  async createCurrentTeam() {
    const rawName = this.teamName();
    const normalizedName = this.normalizeName(rawName);
    const members = this.normalizeTeamMembers(this.team());
    if (normalizedName !== rawName) {
      this.teamName.set(normalizedName);
    }

    try {
      const id = await this.repository.createTeam(normalizedName, members);
      const newTeam: SavedTeam = {
        id,
        name: normalizedName,
        members,
      };
      this.savedTeams.update((list) => [...list, newTeam]);
      this.selectedTeamId.set(id);
      this.updateLastSynced(id, normalizedName, members);
      this.newTeamDraft.set({ name: 'Nuevo equipo', members: [] });
    } catch (error) {
      console.error(error);
    }
  }

  private syncDraftMembers(members: PokemonVM[]) {
    if (this.selectedTeamId()) return;
    this.newTeamDraft.update((draft) => ({
      ...draft,
      members: this.normalizeTeamMembers(members),
    }));
  }

  private updateLastSynced(id: string, name: string, members: PokemonVM[]) {
    const serialized = this.serialize(name, members);
    this.lastSynced.update((map) => {
      const next = new Map(map);
      next.set(id, serialized);
      return next;
    });
  }

  private serialize(name: string, members: PokemonVM[]) {
    return JSON.stringify({ name, members });
  }

  changePokemonMove(change: PokemonMoveSelectionPayload) {
    const slot = Math.min(Math.max(change.slot, 0), 3);
    const moveUrl = change.moveUrl?.trim() ? change.moveUrl : null;
    const target = this.team().find((pokemon) => pokemon.id === change.pokemonId);
    if (!target) {
      return;
    }
    const existing = target.selectedMoves?.[slot] ?? null;

    if (!moveUrl && !existing) {
      return;
    }

    if (existing && existing.url === moveUrl) {
      return;
    }

    const option = moveUrl ? target.moves.find((move) => move.url === moveUrl) : undefined;

    const placeholder = moveUrl ? this.mapper.createMovePlaceholder(option, moveUrl) : null;
    this.updatePokemonMoveSlot(change.pokemonId, slot, placeholder);

    if (!moveUrl) {
      return;
    }

    const cached = this.moveDetailsCache.get(moveUrl);
    if (cached) {
      this.updatePokemonMoveSlot(change.pokemonId, slot, cached);
      return;
    }

    this.api
      .getMoveByUrl(moveUrl)
      .pipe(take(1))
      .subscribe({
        next: (dto) => {
          const detail = this.mapper.moveDetailFromDto(dto, moveUrl);
          this.moveDetailsCache.set(moveUrl, detail);
          this.updatePokemonMoveSlot(change.pokemonId, slot, detail);
        },
        error: (error) => {
          console.error('Error loading move details', error);
        },
      });
  }

  private updatePokemonMoveSlot(
    pokemonId: number,
    slot: number,
    detail: PokemonMoveDetailVM | null
  ) {
    this.team.update((current) => {
      const index = current.findIndex((pokemon) => pokemon.id === pokemonId);
      if (index === -1) {
        return current;
      }

      const nextTeam = [...current];
      const pokemon = this.mapper.normalizeVM(nextTeam[index]);
      const selectedMoves = [...pokemon.selectedMoves];
      const normalizedDetail = this.mapper.normalizeMoveDetail(detail);
      selectedMoves[slot] = normalizedDetail;
      if (normalizedDetail?.url && (normalizedDetail.type || normalizedDetail.power !== null)) {
        pokemon.moves = pokemon.moves.map((move) =>
          move.url === normalizedDetail.url
            ? {
                ...move,
                type: normalizedDetail.type,
                power: normalizedDetail.power,
              }
            : move
        );
      }
      pokemon.selectedMoves = selectedMoves;
      nextTeam[index] = pokemon;
      this.syncDraftMembers(nextTeam);
      return nextTeam;
    });
  }

  private normalizeTeamMembers(members: PokemonVM[]): PokemonVM[] {
    return (members ?? []).map((member) => this.mapper.normalizeVM(member));
  }

  private normalizeName(name: string) {
    const trimmed = name.trim();
    return trimmed.length ? trimmed : 'Equipo sin nombre';
  }
}
