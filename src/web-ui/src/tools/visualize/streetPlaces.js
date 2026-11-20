// Resolve authored public stop names on the publishing host. The reader gets
// the selected coordinates in the SVG and never runs these queries.
const normalized = value => typeof value === 'string' ? value.normalize('NFKC').trim().toLowerCase() : '';
const limit = 16;

function searchArea([lon, lat]) {
  // A city-centre itinerary can include nearby suburbs. Also check returned
  // city and country: proximity alone cannot establish a stop's identity.
  const dy = 30 / 111.2;
  const dx = dy / Math.cos(lat * Math.PI / 180);
  return [Math.max(-180, lon - dx), Math.max(-85, lat - dy), Math.min(180, lon + dx), Math.min(85, lat + dy)];
}

function candidates(features, city, bounds) {
  const [west, south, east, north] = bounds;
  const rows = new Map();
  for (const { properties: p, geometry } of features) {
    if (!p || geometry?.type !== 'Point' || !Array.isArray(geometry.coordinates)) continue;
    const [x, y] = geometry.coordinates;
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < west || x > east || y < south || y > north) continue;
    if (normalized(p.countrycode) !== normalized(city[0]) ||
        (p.city && !city[2].some(alias => normalized(alias) === normalized(p.city)))) continue;
    if (typeof p.name !== 'string' || !['N', 'W', 'R'].includes(p.osm_type) || !Number.isSafeInteger(p.osm_id)) continue;
    const id = p.osm_type + p.osm_id;
    rows.set(id, { id, name: p.name, tag: p.osm_key + ':' + p.osm_value,
      area: [p.district, p.locality, p.street].filter(Boolean).join(', '), xy: [x, y] });
  }
  return [...rows.values()];
}

async function search(city, bounds, query, tag) {
  const url = new URL('https://photon.komoot.io/api/');
  const [lon, lat] = city[3];
  url.search = new URLSearchParams({ q: query, lon, lat, bbox: bounds.join(','), limit });
  if (tag) url.searchParams.set('osm_tag', tag);
  const response = await fetch(url, { credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer' });
  if (!response.ok) throw Error('Place service unavailable (HTTP ' + response.status + ').');
  const { features } = await response.json();
  if (!Array.isArray(features)) throw Error('Invalid place service response.');
  return { rows: candidates(features, city, bounds), capped: features.length >= limit };
}

export async function resolveStreetStops(places, spec, gazetteer) {
  const cities = gazetteer.filter(([country, , names]) =>
    (!spec.country || normalized(country) === normalized(spec.country)) &&
    names.some(name => normalized(name) === normalized(spec.city)));
  if (cities.length !== 1) throw Error('For named street stops, set city to their city name and country to its ISO code. The city must identify one atlas record, or supply sourced stop coordinates.');
  const city = cities[0];
  const bounds = searchArea(city[3]);
  const cache = new Map();
  const resolved = [...places];
  const issues = [];
  const pending = places.entries();
  function lookup(query, tag) {
    const key = JSON.stringify([normalized(query), tag]);
    if (!cache.has(key)) cache.set(key, search(city, bounds, query, tag));
    return cache.get(key);
  }
  async function resolveNext() {
    for (const [index, place] of pending) {
      if (place.coordinates) continue;
      const query = place.query ?? place.name;
      if (!normalized(query) || query.length > 160 || (place.osmTag && !/^[a-z_]+:[a-z_]+$/.test(place.osmTag)))
        throw Error('Invalid street search name or OSM tag for ' + place.name);
      let result;
      try {
        result = await lookup(query, place.osmTag);
        // A display name can be better indexed than an expanded query such as
        // "station name + subway station". Use these hits as suggestions; the
        // exact-match check below still applies to the original query.
        if (!result.rows.length && normalized(query) !== normalized(place.name) && place.name.length <= 160)
          result = await lookup(place.name, place.osmTag);
        // An incorrect tag can hide the intended place entirely. Keep the
        // unfiltered suggestions for repair, while enforcing the tag below.
        if (!result.rows.length && place.osmTag) result = await lookup(query);
      }
      catch { throw Error('Street place lookup unavailable for "' + place.name + '". Retry or use sourced coordinates.'); }
      const matches = result.rows.filter(row =>
        (place.osmId ? normalized(row.id) === normalized(place.osmId) : normalized(row.name) === normalized(query)) &&
        (!place.osmTag || row.tag === place.osmTag));
      if (matches.length === 1 && (place.osmId || !result.capped)) {
        const match = matches[0];
        resolved[index] = { ...place, coordinates: match.xy, osmId: match.id, osmName: match.name, osmTag: match.tag };
        continue;
      }
      issues[index] = { name: place.name, reason: matches.length ? 'ambiguous' : 'no exact match',
        candidates: matches.length ? matches : result.rows };
    }
  }
  await Promise.all(Array.from({ length: Math.min(3, places.length) }, resolveNext));
  if (issues.length) {
    const missing = issues.filter(Boolean);
    // Write returns at most 500 characters. Give each stop useful candidates.
    const messages = missing.map(({ name, reason, candidates }) => {
      // Several segments of a through-road may rank ahead of a same-named
      // pedestrian street. Show distinct feature types before duplicates.
      const tags = new Set();
      const distinct = candidates.filter(row => {
        if (tags.has(row.tag)) return false;
        tags.add(row.tag);
        return true;
      });
      const ranked = [...new Set([...distinct, ...candidates])];
      const hints = ranked.slice(0, 4).map(row => {
        const showArea = candidates.some(other => other.id !== row.id && other.name === row.name && other.tag === row.tag);
        return [row.id, row.name !== name && row.name, row.tag, showArea && row.area].filter(Boolean).join(' ');
      });
      return name + ' (' + reason + ')' + (hints.length ? ': ' + hints.join(' / ') : '');
    });
    throw Error('Refine query/osmTag or select an intended osmId. ' + messages.join('; '));
  }
  return resolved;
}
