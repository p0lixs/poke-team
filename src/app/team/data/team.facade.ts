import { Injectable, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { PokemonApi } from './pokemon.api';
import { PokemonMapper } from './pokemon.mapper';
import {
  PokemonAbilitySelectionPayload,
  PokemonAbilityOptionVM,
  PokemonItemOptionVM,
  PokemonItemSelectionPayload,
  PokemonMoveDetailVM,
  PokemonMoveOptionVM,
  PokemonMoveSelectionPayload,
  PokemonNatureOptionVM,
  PokemonNatureSelectionPayload,
  PokemonLevelChangePayload,
  PokemonStatAllocationPayload,
  PokemonStatVM,
  PokemonVM,
  PokemonTeraTypeSelectionPayload,
} from '../models/view.model';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  Observable,
  catchError,
  debounceTime,
  distinctUntilChanged,
  firstValueFrom,
  forkJoin,
  map,
  of,
  switchMap,
  take,
} from 'rxjs';
import { PokemonDTO } from '../models/pokeapi.dto';
import { TeamRepository } from './team.repository';
import { SavedTeam } from '../models/team.model';
import { STAT_IV_MAX } from '../../shared/util/constants';
import { parseTeamText } from './team-text.parser';
import { ParsedPokemonSet, ParsedStatKey } from './team-text.types';
import { SearchFilters } from '../models/search-filters.model';

const MAX_TEAM = 6;

const STAT_ABBREVIATIONS: Record<ParsedStatKey, string> = {
  hp: 'HP',
  attack: 'Atk',
  defense: 'Def',
  'special-attack': 'SpA',
  'special-defense': 'SpD',
  speed: 'Spe',
};

@Injectable({ providedIn: 'root' })
export class TeamFacade {
  private api = inject(PokemonApi);
  private mapper = inject(PokemonMapper);
  private repository = inject(TeamRepository);
  private readonly teamLoaded = signal(false);
  private readonly lastSynced = signal<Map<string, string>>(new Map());
  private readonly moveDetailsCache = new Map<string, PokemonMoveDetailVM>();
  private readonly pendingAbilityRequests = new Set<number>();
  readonly itemOptions = signal<PokemonItemOptionVM[]>([]);
  readonly natureOptions = signal<PokemonNatureOptionVM[]>([]);
  private readonly newTeamDraft = signal<{ name: string; members: PokemonVM[] }>({
    name: 'New team',
    members: [],
  });

  // --- Search state ---
  readonly searchFilters: WritableSignal<SearchFilters> = signal({
    name: '',
    types: [],
    abilities: [],
    moves: [],
  });
  private readonly allNames = signal<string[] | null>(null);
  readonly typeOptions = signal<string[]>([]);
  readonly abilityOptions = signal<string[]>([]);
  readonly moveOptions = signal<string[]>([]);
  readonly hasActiveFilters = computed(() => this.computeHasActiveFilters(this.searchFilters()));

  readonly results = signal<PokemonVM[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly hasMoreResults = computed(() => this.nextOffset() < this.pendingNames().length);
  private readonly pendingNames = signal<string[]>([]);
  private readonly nextOffset = signal(0);
  private readonly isFetchingMore = signal(false);
  private readonly activeSearchId = signal(0);
  private searchRunId = 0;

  // --- Team state ---
  readonly team = signal<PokemonVM[]>([]);
  readonly teamName = signal('New team');
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
        error: () => this.error.set('Unable to load the Pokémon list'),
      });

    this.api
      .getAllTypeNames()
      .pipe(take(1))
      .subscribe({
        next: (types) => this.typeOptions.set(this.sortOptions(types)),
        error: (error) => console.error('Unable to load types from the API', error),
      });

    this.api
      .getAllAbilityNames()
      .pipe(take(1))
      .subscribe({
        next: (abilities) => this.abilityOptions.set(this.sortOptions(abilities)),
        error: (error) => console.error('Unable to load abilities from the API', error),
      });

    this.api
      .getAllMoveNames()
      .pipe(take(1))
      .subscribe({
        next: (moves) => this.moveOptions.set(this.sortOptions(moves)),
        error: (error) => console.error('Unable to load moves from the API', error),
      });

    this.api
      .getAllItems()
      .pipe(take(1))
      .subscribe({
        next: (items) => {
          const options = (items ?? [])
            .map((item) => this.mapper.itemOptionFromResource(item))
            .filter((option): option is PokemonItemOptionVM => !!option)
            .sort((a, b) => a.label.localeCompare(b.label));
          this.itemOptions.set(options);
        },
        error: (error) => {
          console.error('Unable to load items from the API', error);
        },
      });

    this.api
      .getAllNatures()
      .pipe(take(1))
      .subscribe({
        next: (natures) => {
          const options = (natures ?? [])
            .map((nature) => this.mapper.natureOptionFromDto(nature))
            .filter((option): option is PokemonNatureOptionVM => !!option)
            .sort((a, b) => a.label.localeCompare(b.label));
          this.natureOptions.set(options);
          this.refreshNatureAssignments();
        },
        error: (error) => {
          console.error('Unable to load natures from the API', error);
        },
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
    toObservable(this.searchFilters)
      .pipe(
        map((filters) => this.normalizeFilters(filters)),
        debounceTime(250),
        distinctUntilChanged((a, b) => this.areFiltersEqual(a, b)),
        switchMap((filters) => {
          const searchId = ++this.searchRunId;
          this.activeSearchId.set(searchId);
          this.resetSearchState();

          if (!this.hasSearchCriteria(filters)) {
            this.loading.set(false);
            return of<{ names: string[]; searchId: number }>({ names: [], searchId });
          }

          this.loading.set(true);
          return this.fetchSearchNames(filters).pipe(
            map((names) => ({ names, searchId })),
            catchError((err) => {
              console.error(err);
              this.error.set('Search error');
              this.loading.set(false);
              return of<{ names: string[]; searchId: number }>({ names: [], searchId });
            })
          );
        })
      )
      .subscribe(({ names, searchId }) => {
        if (searchId !== this.activeSearchId()) return;
        this.pendingNames.set(names);
        if (!names.length) {
          this.loading.set(false);
          return;
        }

        this.loadMoreResults(searchId);
      });
  }

  updateSearchFilters(filters: SearchFilters) {
    const normalized = this.normalizeFilters(filters);
    if (this.areFiltersEqual(normalized, this.searchFilters())) {
      return;
    }

    this.searchFilters.set(normalized);
  }

  loadMoreResults(searchId = this.activeSearchId()) {
    if (this.isFetchingMore() || searchId !== this.activeSearchId()) return;

    const names = this.pendingNames();
    const offset = this.nextOffset();
    if (offset >= names.length) {
      this.loading.set(false);
      return;
    }

    const batch = names.slice(offset);
    this.isFetchingMore.set(true);
    this.loading.set(true);

    this.fetchPokemonBatch(batch)
      .pipe(take(1))
      .subscribe({
        next: (dtos) => {
          if (searchId !== this.activeSearchId()) return;

          const list = Array.isArray(dtos) ? dtos.map((dto) => this.mapper.toVM(dto)) : [];
          this.results.update((current) => [...current, ...list]);
          this.nextOffset.update((value) => value + batch.length);
        },
        error: (err) => {
          if (searchId !== this.activeSearchId()) return;
          console.error(err);
          this.error.set('Search error');
          this.isFetchingMore.set(false);
          this.loading.set(false);
        },
        complete: () => {
          if (searchId !== this.activeSearchId()) return;
          this.isFetchingMore.set(false);
          this.loading.set(false);
        },
      });
  }

  async addToTeam(p: PokemonVM) {
    if (!this.canAdd()) return;
    const exists = this.team().some((x) => x.id === p.id);
    if (exists) return; // avoid duplicates
    const pokemon = this.applyNatureToPokemon(this.mapper.normalizeVM(p));
    this.cacheMoveDetailsFromPokemon(pokemon);
    this.team.update((arr) => {
      const next = [...arr, pokemon];
      this.syncDraftMembers(next);
      return next;
    });
    this.applyCachedMoveDetailsToPokemon(pokemon.id);
    this.prefetchAbilityOptionsForPokemon(pokemon);
    this.prefetchMoveDetailsForPokemon(pokemon);
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

  exportTeamAsText(): string {
    const members = this.team().map((member) => this.mapper.normalizeVM(member));
    if (!members.length) {
      return '';
    }

    return members
      .map((pokemon) => this.formatPokemonForExport(pokemon))
      .filter((block) => !!block)
      .join('\n\n');
  }

  async importTeamFromText(text: string): Promise<{ success: boolean; error?: string }> {
    const parsed = parseTeamText(text);
    if (!parsed.length) {
      return { success: false, error: 'No Pokémon found in the provided text.' };
    }

    const limited = parsed.slice(0, MAX_TEAM);
    const pokemonDtos: PokemonDTO[] = [];

    for (const set of limited) {
      const slug = this.slugifyIdentifier(set.species);
      if (!slug) {
        return {
          success: false,
          error: `Unable to determine the Pokémon species for "${set.species}".`,
        };
      }

      try {
        const dto = await firstValueFrom(this.api.getPokemonByName(slug));
        pokemonDtos.push(dto);
      } catch (error) {
        console.error('Import error: unable to load Pokémon details', set.species, error);
        return {
          success: false,
          error: `Unable to load data for "${this.formatSpeciesName(set.species)}".`,
        };
      }
    }

    const importedTeam: PokemonVM[] = [];

    for (let index = 0; index < pokemonDtos.length; index += 1) {
      const dto = pokemonDtos[index];
      const set = limited[index];
      let pokemon = this.mapper.normalizeVM(this.mapper.toVM(dto));
      pokemon = this.applyImportedSet(pokemon, set);
      importedTeam.push(pokemon);
      this.cacheMoveDetailsFromPokemon(pokemon);
      this.prefetchAbilityOptionsForPokemon(pokemon);
      this.prefetchMoveDetailsForPokemon(pokemon);
    }

    this.team.set(importedTeam);
    this.syncDraftMembers(importedTeam);

    return { success: true };
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
      this.newTeamDraft.set({ name: 'New team', members: [] });
    } catch (error) {
      console.error(error);
    }
  }

  private fetchSearchNames(filters: SearchFilters): Observable<string[]> {
    const nameQuery = filters.name.trim().toLowerCase();
    const typeRequests = filters.types.map((type) =>
      this.api
        .getTypeByName(type)
        .pipe(map((dto) => this.uniqueNames(dto.pokemon?.map((entry) => entry.pokemon.name) ?? [])))
    );
    const abilityRequests = filters.abilities.map((ability) =>
      this.api
        .getAbilityByName(ability)
        .pipe(map((dto) => this.uniqueNames(dto.pokemon?.map((entry) => entry.pokemon.name) ?? [])))
    );
    const moveRequests = filters.moves.map((move) =>
      this.api
        .getMoveByName(move)
        .pipe(map((dto) => this.uniqueNames(dto.learned_by_pokemon?.map((entry) => entry.name) ?? [])))
    );

    return forkJoin({
      types: typeRequests.length ? forkJoin(typeRequests) : of<string[][]>([]),
      abilities: abilityRequests.length ? forkJoin(abilityRequests) : of<string[][]>([]),
      moves: moveRequests.length ? forkJoin(moveRequests) : of<string[][]>([]),
    }).pipe(
      map(({ types, abilities, moves }) => {
        const collections = [types, abilities, moves].filter((group) => group.length) as string[][][];

        let pool: string[] | null = null;
        collections.forEach((group) => {
          const merged = this.uniqueNames(group.flat());
          pool = pool === null ? merged : pool.filter((name) => merged.includes(name));
        });

        const basePool = pool ?? this.uniqueNames(this.allNames() ?? []);
        const filteredByName = nameQuery ? basePool.filter((name) => name.includes(nameQuery)) : basePool;

        return this.uniqueNames(filteredByName);
      })
    );
  }

  private fetchPokemonBatch(names: string[]): Observable<PokemonDTO[]> {
    if (!names.length) return of<PokemonDTO[]>([]);

    return forkJoin(names.map((name) => this.api.getPokemonByName(name).pipe(take(1))));
  }

  private resetSearchState() {
    this.results.set([]);
    this.pendingNames.set([]);
    this.nextOffset.set(0);
    this.error.set(null);
    this.isFetchingMore.set(false);
  }

  private uniqueNames(names: string[]): string[] {
    return Array.from(new Set(names.map((name) => name.toLowerCase())));
  }

  private sortOptions(options: string[]): string[] {
    return this.uniqueNames(options).sort((a, b) => a.localeCompare(b));
  }

  private normalizeFilters(filters: SearchFilters): SearchFilters {
    const normalizeList = (list: string[]) => this.sortOptions(list.map((entry) => entry.trim()));

    return {
      name: filters.name.trim().toLowerCase(),
      types: normalizeList(filters.types),
      abilities: normalizeList(filters.abilities),
      moves: normalizeList(filters.moves),
    };
  }

  private areFiltersEqual(a: SearchFilters, b: SearchFilters): boolean {
    return (
      a.name === b.name &&
      a.types.length === b.types.length &&
      a.types.every((value, index) => value === b.types[index]) &&
      a.abilities.length === b.abilities.length &&
      a.abilities.every((value, index) => value === b.abilities[index]) &&
      a.moves.length === b.moves.length &&
      a.moves.every((value, index) => value === b.moves[index])
    );
  }

  private hasSearchCriteria(filters: SearchFilters): boolean {
    const hasExtraFilters =
      filters.types.length > 0 || filters.abilities.length > 0 || filters.moves.length > 0;
    return hasExtraFilters || filters.name.trim().length >= 2;
  }

  private computeHasActiveFilters(filters: SearchFilters): boolean {
    return (
      !!filters.name.trim().length ||
      filters.types.length > 0 ||
      filters.abilities.length > 0 ||
      filters.moves.length > 0
    );
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

  private clampLevel(level: number | null | undefined): number {
    const numeric = typeof level === 'number' ? level : Number(level);
    if (!Number.isFinite(numeric)) {
      return 50;
    }

    return Math.min(100, Math.max(1, Math.round(numeric)));
  }

  private refreshNatureAssignments() {
    const options = this.natureOptions();
    if (!options.length) {
      return;
    }

    this.team.update((current) => this.normalizeTeamMembers(current));
    this.newTeamDraft.update((draft) => ({
      ...draft,
      members: this.normalizeTeamMembers(draft.members),
    }));
    this.savedTeams.update((teams) =>
      teams.map((team) => ({
        ...team,
        members: this.normalizeTeamMembers(team.members),
      }))
    );
  }

  private applyNatureToPokemon(pokemon: PokemonVM): PokemonVM {
    const selectedNature = this.selectNatureOption(pokemon.selectedNature, this.natureOptions());
    if (selectedNature === pokemon.selectedNature) {
      return pokemon;
    }

    return { ...pokemon, selectedNature };
  }

  private selectNatureOption(
    current: PokemonNatureOptionVM | null | undefined,
    options: PokemonNatureOptionVM[]
  ): PokemonNatureOptionVM | null {
    const url = current?.url?.trim();
    if (!url) {
      return null;
    }

    const match = options.find((option) => option.url === url);
    if (match) {
      return match;
    }

    if (current) {
      return {
        name: current.name,
        label: current.label,
        url,
        increasedStat: current.increasedStat ?? null,
        decreasedStat: current.decreasedStat ?? null,
      };
    }

    return this.mapper.natureOptionFromUrl(url);
  }

  private areNaturesEqual(
    a: PokemonNatureOptionVM | null,
    b: PokemonNatureOptionVM | null
  ): boolean {
    if (!a && !b) {
      return true;
    }

    if (!a || !b) {
      return false;
    }

    return (
      a.url === b.url &&
      (a.increasedStat ?? null) === (b.increasedStat ?? null) &&
      (a.decreasedStat ?? null) === (b.decreasedStat ?? null)
    );
  }

  changePokemonAbility(change: PokemonAbilitySelectionPayload) {
    this.team.update((current) => {
      const index = current.findIndex((pokemon) => pokemon.id === change.pokemonId);
      if (index === -1) {
        return current;
      }

      const nextTeam = [...current];
      const pokemon = this.mapper.normalizeVM(nextTeam[index]);
      const normalizedUrl = change.abilityUrl?.trim();

      const selectedAbility = normalizedUrl
        ? pokemon.abilityOptions.find((ability) => ability.url === normalizedUrl) ??
          this.mapper.abilityOptionFromUrl(normalizedUrl)
        : pokemon.abilityOptions[0] ?? null;

      pokemon.selectedAbility = selectedAbility;
      nextTeam[index] = pokemon;
      this.syncDraftMembers(nextTeam);
      return nextTeam;
    });
  }

  changePokemonItem(change: PokemonItemSelectionPayload) {
    const items = this.itemOptions();
    this.team.update((current) => {
      const index = current.findIndex((pokemon) => pokemon.id === change.pokemonId);
      if (index === -1) {
        return current;
      }

      const nextTeam = [...current];
      const pokemon = this.mapper.normalizeVM(nextTeam[index]);
      const normalizedUrl = change.itemUrl?.trim();
      const selectedItem = normalizedUrl
        ? items.find((item) => item.url === normalizedUrl) ?? this.mapper.itemOptionFromUrl(normalizedUrl) ?? null
        : null;

      pokemon.heldItem = selectedItem;
      nextTeam[index] = pokemon;
      this.syncDraftMembers(nextTeam);
      return nextTeam;
    });
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

  changePokemonLevel(change: PokemonLevelChangePayload) {
    const level = this.clampLevel(change.level);
    this.team.update((current) => {
      const index = current.findIndex((pokemon) => pokemon.id === change.pokemonId);
      if (index === -1) {
        return current;
      }

      const nextTeam = [...current];
      const pokemon = this.applyNatureToPokemon(this.mapper.normalizeVM(nextTeam[index]));
      if (pokemon.level === level) {
        return current;
      }

      const updated = this.recalculatePokemonStats({ ...pokemon, level });
      nextTeam[index] = updated;
      this.syncDraftMembers(nextTeam);
      return nextTeam;
    });
  }

  changePokemonStats(change: PokemonStatAllocationPayload) {
    this.team.update((current) => {
      const index = current.findIndex((pokemon) => pokemon.id === change.pokemonId);
      if (index === -1) {
        return current;
      }

      const nextTeam = [...current];
      const pokemon = this.mapper.normalizeVM(nextTeam[index]);
      const stats = pokemon.stats.map((stat) =>
        stat.name === change.statName ? { ...stat, iv: change.iv, ev: change.ev } : { ...stat }
      );

      const updated = this.applyNatureToPokemon(this.mapper.normalizeVM({ ...pokemon, stats }));

      if (this.areStatsEqual(updated.stats, pokemon.stats)) {
        return current;
      }

      nextTeam[index] = updated;
      this.syncDraftMembers(nextTeam);
      return nextTeam;
    });
  }

  changePokemonTeraType(change: PokemonTeraTypeSelectionPayload) {
    const nextType = this.normalizeTeraType(change.teraType);
    this.team.update((current) => {
      const index = current.findIndex((pokemon) => pokemon.id === change.pokemonId);
      if (index === -1) {
        return current;
      }

      const nextTeam = [...current];
      const pokemon = this.mapper.normalizeVM(nextTeam[index]);
      if (pokemon.teraType === nextType) {
        return current;
      }

      pokemon.teraType = nextType;
      nextTeam[index] = pokemon;
      this.syncDraftMembers(nextTeam);
      return nextTeam;
    });
  }

  changePokemonNature(change: PokemonNatureSelectionPayload) {
    const options = this.natureOptions();
    this.team.update((current) => {
      const index = current.findIndex((pokemon) => pokemon.id === change.pokemonId);
      if (index === -1) {
        return current;
      }

      const nextTeam = [...current];
      const pokemon = this.applyNatureToPokemon(this.mapper.normalizeVM(nextTeam[index]));
      const normalizedUrl = change.natureUrl?.trim() || null;
      const previousNature = pokemon.selectedNature ?? null;
      const nextNature =
        normalizedUrl === null
          ? null
          : options.find((nature) => nature.url === normalizedUrl) ??
            (previousNature?.url === normalizedUrl ? previousNature : this.mapper.natureOptionFromUrl(normalizedUrl));

      if (this.areNaturesEqual(previousNature, nextNature)) {
        return current;
      }

      const updated = this.recalculatePokemonStats({ ...pokemon, selectedNature: nextNature });
      nextTeam[index] = updated;
      this.syncDraftMembers(nextTeam);
      return nextTeam;
    });
  }

  private applyImportedSet(pokemon: PokemonVM, set: ParsedPokemonSet): PokemonVM {
    const level = typeof set.level === 'number' ? this.clampLevel(set.level) : pokemon.level;
    const ability = set.ability ? this.resolveAbility(pokemon, set.ability) : pokemon.selectedAbility;
    const nature = set.nature ? this.resolveNature(set.nature) : pokemon.selectedNature;
    const heldItem = this.resolveItem(set.item);
    const teraType =
      this.normalizeTeraType(set.teraType) ?? pokemon.teraType ?? this.inferDefaultTeraType(pokemon);

    const stats = pokemon.stats.map((stat) => {
      const key = stat.name as ParsedStatKey;
      const nextEv = set.evs[key];
      const nextIv = set.ivs[key];
      return {
        ...stat,
        ev: typeof nextEv === 'number' ? nextEv : stat.ev,
        iv: typeof nextIv === 'number' ? nextIv : stat.iv,
      } satisfies PokemonStatVM;
    });

    const { moves, selectedMoves } = this.buildImportedMoves(
      { ...pokemon, moves: pokemon.moves.map((move) => ({ ...move })) },
      set.moves
    );

    const normalized = this.mapper.normalizeVM({
      ...pokemon,
      level,
      stats,
      moves,
      selectedMoves,
      selectedAbility: ability ?? pokemon.selectedAbility,
      selectedNature: nature ?? null,
      heldItem,
      teraType,
    });

    return this.applyNatureToPokemon(normalized);
  }

  private buildImportedMoves(
    pokemon: PokemonVM,
    moveNames: string[]
  ): { moves: PokemonMoveOptionVM[]; selectedMoves: (PokemonMoveDetailVM | null)[] } {
    let moves = Array.isArray(pokemon.moves) ? pokemon.moves.map((move) => ({ ...move })) : [];
    const selected: (PokemonMoveDetailVM | null)[] = Array.from({ length: 4 }, () => null);
    const limited = Array.isArray(moveNames) ? moveNames.slice(0, 4) : [];

    limited.forEach((moveName, index) => {
      const slug = this.slugifyIdentifier(moveName);
      if (!slug) {
        return;
      }

      const matchIndex = moves.findIndex(
        (move) =>
          this.slugifyIdentifier(move.name) === slug ||
          this.slugifyIdentifier(move.label ?? move.name) === slug
      );

      let option: PokemonMoveOptionVM;
      if (matchIndex >= 0) {
        option = { ...moves[matchIndex] };
        moves[matchIndex] = option;
      } else {
        option = {
          name: slug,
          label: this.formatMoveLabel(moveName),
          url: this.buildResourceUrl('move', slug),
          type: null,
          power: null,
          accuracy: null,
          damageClass: null,
          effect: null,
        };
        moves = [...moves, option];
      }

      const detail = this.mapper.normalizeMoveDetail({
        name: option.label ?? this.formatMoveLabel(moveName),
        url: option.url,
        type: option.type,
        power: option.power,
        accuracy: option.accuracy,
        damageClass: option.damageClass,
        effect: option.effect,
      });

      selected[index] = detail;
    });

    return { moves, selectedMoves: selected };
  }

  private resolveAbility(pokemon: PokemonVM, abilityName: string): PokemonAbilityOptionVM | null {
    const slug = this.slugifyIdentifier(abilityName);
    if (!slug) {
      return pokemon.selectedAbility ?? pokemon.abilityOptions[0] ?? null;
    }

    const match =
      pokemon.abilityOptions.find(
        (ability) =>
          this.slugifyIdentifier(ability.name) === slug ||
          this.slugifyIdentifier(ability.label) === slug
      ) ?? null;

    if (match) {
      return match;
    }

    return this.mapper.abilityOptionFromUrl(this.buildResourceUrl('ability', slug));
  }

  private resolveItem(name: string | null): PokemonItemOptionVM | null {
    if (name === null) {
      return null;
    }

    const normalized = name.trim();
    if (!normalized || /^none$/i.test(normalized)) {
      return null;
    }

    const slug = this.slugifyIdentifier(normalized);
    if (!slug) {
      return null;
    }

    const items = this.itemOptions();
    const match =
      items.find(
        (item) =>
          this.slugifyIdentifier(item.name) === slug ||
          this.slugifyIdentifier(item.label ?? item.name) === slug
      ) ?? null;

    if (match) {
      return match;
    }

    return this.mapper.itemOptionFromUrl(this.buildResourceUrl('item', slug));
  }

  private resolveNature(name: string | null): PokemonNatureOptionVM | null {
    if (name === null) {
      return null;
    }

    const slug = this.slugifyIdentifier(name);
    if (!slug) {
      return null;
    }

    const options = this.natureOptions();
    const match =
      options.find(
        (nature) =>
          this.slugifyIdentifier(nature.name) === slug ||
          this.slugifyIdentifier(nature.label) === slug
      ) ?? null;

    if (match) {
      return match;
    }

    return this.mapper.natureOptionFromUrl(this.buildResourceUrl('nature', slug));
  }

  private normalizeTeraType(value: string | null): string | null {
    const formatted = this.formatTitle(value);
    if (!formatted) {
      return null;
    }

    const slug = formatted.replace(/\s+/g, '').toLowerCase();
    if (slug === 'terastellar' || slug === 'stellar') {
      return 'Tera Stellar';
    }

    return formatted;
  }

  private inferDefaultTeraType(pokemon: PokemonVM): string | null {
    const type = pokemon.typeDetails?.[0]?.name ?? pokemon.types?.[0] ?? null;
    return type ? this.formatTitle(type) : null;
  }

  private formatPokemonForExport(pokemon: PokemonVM): string {
    const lines: string[] = [];
    const displayName = this.formatSpeciesName(pokemon.name);
    const item = pokemon.heldItem?.label ?? null;

    lines.push(item ? `${displayName} @ ${item}` : displayName);

    if (pokemon.selectedAbility?.label) {
      lines.push(`Ability: ${pokemon.selectedAbility.label}`);
    }

    lines.push(`Level: ${this.clampLevel(pokemon.level)}`);

    const teraType = pokemon.teraType?.trim()
      ? this.formatTitle(pokemon.teraType)
      : this.inferDefaultTeraType(pokemon);
    if (teraType) {
      lines.push(`Tera Type: ${teraType}`);
    }

    const evLine = this.formatEvLine(pokemon.stats);
    if (evLine) {
      lines.push(evLine);
    }

    const ivLine = this.formatIvLine(pokemon.stats);
    if (ivLine) {
      lines.push(ivLine);
    }

    const natureLabel = pokemon.selectedNature?.label ?? 'Serious';
    lines.push(`${natureLabel} Nature`);

    pokemon.selectedMoves
      ?.filter((move): move is PokemonMoveDetailVM => !!move)
      .forEach((move) => {
        lines.push(`- ${move.name}`);
      });

    return lines.join('\n');
  }

  private formatEvLine(stats: PokemonStatVM[]): string | null {
    const parts = stats
      .filter((stat) => stat.ev > 0)
      .map((stat) => `${stat.ev} ${this.getStatAbbreviation(stat.name)}`);
    return parts.length ? `EVs: ${parts.join(' / ')}` : null;
  }

  private formatIvLine(stats: PokemonStatVM[]): string | null {
    const parts = stats
      .filter((stat) => stat.iv !== STAT_IV_MAX)
      .map((stat) => `${stat.iv} ${this.getStatAbbreviation(stat.name)}`);
    return parts.length ? `IVs: ${parts.join(' / ')}` : null;
  }

  private getStatAbbreviation(name: string): string {
    const key = name.toLowerCase() as ParsedStatKey;
    return STAT_ABBREVIATIONS[key] ?? this.formatTitle(name);
  }

  private formatSpeciesName(value: string): string {
    return this.formatTitle(value);
  }

  private formatMoveLabel(value: string): string {
    return this.formatTitle(value);
  }

  private formatTitle(value: string | null | undefined): string {
    const normalized = (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[_]+/g, ' ')
      .trim();

    if (!normalized) {
      return '';
    }

    return normalized
      .split(/\s+/)
      .map((word) =>
        word
          .split('-')
          .map((segment) => (segment ? segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase() : segment))
          .join('-')
      )
      .join(' ');
  }

  private slugifyIdentifier(value: string | null | undefined): string | null {
    const normalized = (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s\-']/g, '')
      .replace(/[']/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return normalized || null;
  }

  private buildResourceUrl(
    resource: 'ability' | 'item' | 'move' | 'nature' | 'pokemon',
    slug: string
  ): string {
    return `https://pokeapi.co/api/v2/${resource}/${slug}/`;
  }

  private recalculatePokemonStats(pokemon: PokemonVM): PokemonVM {
    const normalized = this.mapper.normalizeVM(pokemon);
    return this.applyNatureToPokemon(normalized);
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
      if (normalizedDetail?.url) {
        pokemon.moves = pokemon.moves.map((move) =>
          move.url === normalizedDetail.url
            ? {
                ...move,
                type: normalizedDetail.type,
                power: normalizedDetail.power,
                accuracy: normalizedDetail.accuracy,
                damageClass: normalizedDetail.damageClass,
                effect: normalizedDetail.effect,
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
    const natureOptions = this.natureOptions();
    return (members ?? []).map((member) => {
      const normalized = this.mapper.normalizeVM(member);
      const selectedNature = this.selectNatureOption(normalized.selectedNature, natureOptions);
      const result = selectedNature === normalized.selectedNature ? normalized : { ...normalized, selectedNature };
      this.cacheMoveDetailsFromPokemon(result);
      this.prefetchAbilityOptionsForPokemon(result);
      return result;
    });
  }

  private areStatsEqual(a: PokemonStatVM[], b: PokemonStatVM[]): boolean {
    if (a.length !== b.length) {
      return false;
    }

    const lookup = new Map<string, PokemonStatVM>();
    b.forEach((stat) => lookup.set(stat.name, stat));

    return a.every((stat) => {
      const other = lookup.get(stat.name);
      if (!other) {
        return false;
      }

      return (
        stat.value === other.value &&
        stat.iv === other.iv &&
        stat.ev === other.ev &&
        stat.baseValue === other.baseValue &&
        stat.label === other.label
      );
    });
  }

  private normalizeName(name: string) {
    const trimmed = name.trim();
    return trimmed.length ? trimmed : 'Unnamed team';
  }

  private cacheMoveDetailsFromPokemon(pokemon: PokemonVM) {
    pokemon.selectedMoves
      ?.filter((move): move is PokemonMoveDetailVM => !!move?.url)
      .forEach((move) => {
        const detail = this.mapper.normalizeMoveDetail(move);
        if (this.hasMoveDetailInfo(detail)) {
          this.moveDetailsCache.set(detail.url, detail);
        }
      });

    pokemon.moves
      ?.filter((move) => !!move?.url)
      .forEach((move) => {
        const detail = this.mapper.normalizeMoveDetail({
          name: move.label ?? move.name,
          url: move.url,
          type: move.type,
          power: move.power,
          accuracy: move.accuracy,
          damageClass: move.damageClass,
          effect: move.effect,
        });

        if (this.hasMoveDetailInfo(detail)) {
          this.moveDetailsCache.set(detail.url, detail);
        }
      });
  }

  private applyCachedMoveDetailsToPokemon(pokemonId: number) {
    this.team.update((current) => {
      const index = current.findIndex((pokemon) => pokemon.id === pokemonId);
      if (index === -1) {
        return current;
      }

      const nextTeam = [...current];
      const pokemon = this.mapper.normalizeVM(nextTeam[index]);
      pokemon.moves = pokemon.moves.map((move) => {
        const detail = this.moveDetailsCache.get(move.url);
        if (!detail) {
          return move;
        }

        return {
          ...move,
          type: detail.type,
          power: detail.power,
          accuracy: detail.accuracy,
          damageClass: detail.damageClass,
          effect: detail.effect,
        };
      });

      pokemon.selectedMoves = pokemon.selectedMoves.map((move) => {
        if (!move?.url) {
          return move;
        }

        const detail = this.moveDetailsCache.get(move.url) ?? move;
        return this.mapper.normalizeMoveDetail(detail);
      });

      nextTeam[index] = pokemon;
      this.syncDraftMembers(nextTeam);
      return nextTeam;
    });
  }

  private prefetchMoveDetailsForPokemon(pokemon: PokemonVM) {
    const moves = pokemon.moves ?? [];
    const missingUrls = moves
      .map((move) => move.url)
      .filter((url) => !!url && !this.moveDetailsCache.has(url));

    if (!missingUrls.length) {
      return;
    }

    forkJoin(
      missingUrls.map((url) =>
        this.api
          .getMoveByUrl(url)
          .pipe(take(1), map((dto) => this.mapper.moveDetailFromDto(dto, url)))
      )
    ).subscribe({
      next: (details) => {
        details.forEach((detail) => {
          if (this.hasMoveDetailInfo(detail)) {
            this.moveDetailsCache.set(detail.url, detail);
          }
        });
        this.applyCachedMoveDetailsToPokemon(pokemon.id);
      },
      error: (error) => {
        console.error('Error preloading move details', error);
      },
    });
  }

  private hasMoveDetailInfo(
    detail: PokemonMoveDetailVM | null | undefined
  ): detail is PokemonMoveDetailVM {
    if (!detail) {
      return false;
    }

    return (
      !!detail.type ||
      detail.power !== null ||
      detail.accuracy !== null ||
      !!detail.damageClass ||
      !!detail.effect
    );
  }

  private prefetchAbilityOptionsForPokemon(pokemon: PokemonVM) {
    if (!pokemon || pokemon.abilityOptions.length) {
      return;
    }

    if (this.pendingAbilityRequests.has(pokemon.id)) {
      return;
    }

    this.pendingAbilityRequests.add(pokemon.id);

    this.api
      .getPokemonByName(String(pokemon.id))
      .pipe(take(1))
      .subscribe({
        next: (dto: PokemonDTO) => {
          const mapped = this.mapper.toVM(dto);
          const abilityOptions = mapped.abilityOptions ?? [];
          const fallbackAbility = mapped.selectedAbility ?? abilityOptions[0] ?? null;

          if (!abilityOptions.length) {
            return;
          }

          this.team.update((current) => {
            const index = current.findIndex((member) => member.id === pokemon.id);
            if (index === -1) {
              return current;
            }

            const nextTeam = [...current];
            const existing = this.mapper.normalizeVM(nextTeam[index]);
            const selectedUrl = existing.selectedAbility?.url ?? null;

            const selectedAbility = selectedUrl
              ? abilityOptions.find((option) => option.url === selectedUrl) ??
                this.mapper.abilityOptionFromUrl(selectedUrl)
              : fallbackAbility;

            const updated = this.mapper.normalizeVM({
              ...existing,
              abilityOptions,
              selectedAbility,
            });

            nextTeam[index] = updated;
            this.syncDraftMembers(nextTeam);
            return nextTeam;
          });
        },
        error: (error) => {
          console.error('Error preloading ability options', error);
          this.pendingAbilityRequests.delete(pokemon.id);
        },
        complete: () => {
          this.pendingAbilityRequests.delete(pokemon.id);
        },
      });
  }
}
