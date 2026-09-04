import { API_URL } from '../api/client';

export interface DoodleCatalogEntry {
  id: string;
  category: string;
  description: string;
  url: string;
}

export type DoodleCatalog = Map<string, DoodleCatalogEntry>;

let catalogPromise: Promise<DoodleCatalog> | null = null;

/** Fetches the doodle catalog once (id → { url, category, ... }) and caches it. */
export function fetchDoodleCatalog(): Promise<DoodleCatalog> {
  if (!catalogPromise) {
    catalogPromise = (async () => {
      const res = await fetch(`${API_URL}/content/doodles`);
      if (!res.ok) throw new Error(`doodle catalog failed: ${res.status}`);
      const body = (await res.json()) as { doodles: DoodleCatalogEntry[] };
      return new Map(body.doodles.map((d) => [d.id, d]));
    })();
  }
  return catalogPromise;
}

const svgCache = new Map<string, Promise<string>>();

/** Fetches raw SVG markup (needed inline so its paths can be animated), cached per URL. */
export function fetchSvgText(url: string): Promise<string> {
  let pending = svgCache.get(url);
  if (!pending) {
    pending = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`svg fetch failed: ${r.status}`);
      return r.text();
    });
    svgCache.set(url, pending);
  }
  return pending;
}
