/** A doodle catalog entry, matching doodle-library.json's shape (§9.1). */
export interface DoodleInput {
  id: string;
  name: string;
  category: string;
  description: string;
  asset_status: string;
}

/** A doodle ready to persist, with the uploaded SVG's bucket path attached. */
export interface DoodleRow extends DoodleInput {
  svg_path: string;
}

function fail(index: number, message: string): never {
  throw new Error(`doodle-library[${index}]: ${message}`);
}

function nonEmptyString(value: unknown, index: number, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(index, `\`${field}\` must be a non-empty string`);
  }
  return value;
}

/**
 * Validates and normalizes one raw doodle metadata entry. The SVG artwork lives
 * in a separate file per id (e.g. person_a.svg); this only covers the metadata.
 */
export function parseDoodle(raw: unknown, index: number): DoodleInput {
  if (typeof raw !== 'object' || raw === null) fail(index, 'must be an object');
  const r = raw as Record<string, unknown>;
  return {
    id: nonEmptyString(r.id, index, 'id'),
    name: nonEmptyString(r.name, index, 'name'),
    category: nonEmptyString(r.category, index, 'category'),
    description: nonEmptyString(r.description, index, 'description'),
    // Default to 'complete' — every current asset is baked and final (§9.1).
    asset_status: typeof r.asset_status === 'string' ? r.asset_status : 'complete',
  };
}
