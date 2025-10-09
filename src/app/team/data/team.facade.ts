import { Injectable, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { PokemonApi } from './pokemon.api';
import { PokemonMapper } from './pokemon.mapper';
import {
  PokemonAbilitySelectionPayload,
  PokemonItemOptionVM,
  PokemonItemSelectionPayload,
  PokemonMoveDetailVM,
  PokemonMoveSelectionPayload,
  PokemonNatureOptionVM,
  PokemonNatureSelectionPayload,
  PokemonLevelChangePayload,
  PokemonStatAllocationPayload,
  PokemonStatVM,
  PokemonVM,
} from '../models/view.model';
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
  private readonly pendingAbilityRequests = new Set<number>();
  readonly itemOptions = signal<PokemonItemOptionVM[]>([]);
  readonly natureOptions = signal<PokemonNatureOptionVM[]>([]);
  private readonly newTeamDraft = signal<{ name: string; members: PokemonVM[] }>({
    name: 'New team',
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
          this.error.set('Search error');
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

      pokemon.level = level;
      nextTeam[index] = pokemon;
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

      pokemon.selectedNature = nextNature;
      nextTeam[index] = pokemon;
      this.syncDraftMembers(nextTeam);
      return nextTeam;
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
