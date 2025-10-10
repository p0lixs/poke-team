import { ParsedPokemonSet, ParsedStatKey } from './team-text.types';

const STAT_TOKEN_MAP: Record<string, ParsedStatKey> = {
  hp: 'hp',
  atk: 'attack',
  attack: 'attack',
  def: 'defense',
  defense: 'defense',
  spa: 'special-attack',
  spatk: 'special-attack',
  spaatk: 'special-attack',
  spattack: 'special-attack',
  spc: 'special-attack',
  spd: 'special-defense',
  spdef: 'special-defense',
  spadef: 'special-defense',
  spdefense: 'special-defense',
  spe: 'speed',
  speed: 'speed',
};

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function parseStatAllocations(line: string): Partial<Record<ParsedStatKey, number>> {
  const result: Partial<Record<ParsedStatKey, number>> = {};
  const [, rawValues] = line.split(/:/, 2);
  if (!rawValues) {
    return result;
  }

  const segments = rawValues.split('/');
  for (const segment of segments) {
    const trimmed = normalizeLine(segment);
    if (!trimmed) continue;

    const match = trimmed.match(/^(\d+)\s+(.+)$/);
    if (!match) {
      continue;
    }

    const value = Number(match[1]);
    if (!Number.isFinite(value)) {
      continue;
    }

    const token = normalizeToken(match[2]);
    const stat = STAT_TOKEN_MAP[token];
    if (!stat) {
      continue;
    }

    result[stat] = value;
  }

  return result;
}

function extractSpeciesCandidate(header: string): string {
  const cleaned = header.replace(/\s*@.*$/, '').trim();
  if (!cleaned) {
    return '';
  }

  const matches = [...cleaned.matchAll(/\(([^)]+)\)/g)].map((match) => match[1]?.trim()).filter(Boolean);
  if (matches.length) {
    let candidate = matches[matches.length - 1] ?? '';
    if (/^[mf]$/i.test(candidate) && matches.length > 1) {
      candidate = matches[matches.length - 2] ?? candidate;
    }
    if (candidate) {
      return candidate.replace(/\s*\((?:M|F|N)\)\s*$/i, '').trim();
    }
  }

  return cleaned.replace(/\s*\((?:M|F|N)\)\s*$/i, '').trim();
}

function parseHeader(line: string): { raw: string; species: string; item: string | null } | null {
  const normalized = normalizeLine(line);
  if (!normalized) {
    return null;
  }

  const [rawLead, rawItem] = normalized.split(/@/, 2);
  const species = extractSpeciesCandidate(rawLead ?? '');
  const item = rawItem?.trim() ? rawItem.trim() : null;
  return { raw: normalized, species, item };
}

export function parseTeamText(text: string): ParsedPokemonSet[] {
  if (!text) {
    return [];
  }

  const normalized = text.replace(/\r\n?/g, '\n');
  const blocks = normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const result: ParsedPokemonSet[] = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((line) => normalizeLine(line))
      .filter(Boolean);

    if (!lines.length) {
      continue;
    }

    const header = parseHeader(lines[0]);
    if (!header || !header.species) {
      continue;
    }

    const pokemon: ParsedPokemonSet = {
      rawName: header.raw,
      species: header.species,
      item: header.item,
      ability: null,
      level: null,
      teraType: null,
      nature: null,
      evs: {},
      ivs: {},
      moves: [],
    };

    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line) continue;

      if (/^ability:/i.test(line)) {
        pokemon.ability = line.split(/:/, 2)[1]?.trim() || null;
        continue;
      }

      if (/^level:/i.test(line)) {
        const value = Number(line.split(/:/, 2)[1]?.trim());
        pokemon.level = Number.isFinite(value) ? value : pokemon.level;
        continue;
      }

      if (/^tera type:/i.test(line)) {
        pokemon.teraType = line.split(/:/, 2)[1]?.trim() || null;
        continue;
      }

      if (/^evs:/i.test(line)) {
        pokemon.evs = parseStatAllocations(line);
        continue;
      }

      if (/^ivs:/i.test(line)) {
        pokemon.ivs = parseStatAllocations(line);
        continue;
      }

      if (/nature$/i.test(line)) {
        pokemon.nature = line.replace(/\s*Nature$/i, '').trim();
        continue;
      }

      if (/^-/i.test(line)) {
        const move = line.replace(/^-/i, '').trim();
        if (move) {
          pokemon.moves.push(move);
        }
        continue;
      }
    }

    result.push(pokemon);
  }

  return result;
}
