import beerIconSource from "../assets/beer.svg?raw";
import liquorIconSource from "../assets/liquor.svg?raw";

// beer.svg/liquor.svg are Material Symbols icons: filled paths on a
// "0 -960 960 960" viewBox, unlike this file's other stroke-based icons on
// a shared "0 0 24 24" viewBox. Re-project into that shared space with a
// matrix transform (scale 24/960 = 0.025; translate y by +24 to flip the
// negative-y source range into the shared viewBox) and force
// fill: currentColor so these recolor the same way the stroke icons do
// (active/hover states, etc.) instead of staying pinned to the source
// file's baked-in gray fill.
function normalizeFilledIcon(source: string): string {
  const d = source.match(/\sd="([^"]+)"/)?.[1] ?? "";
  return `<g fill="currentColor" stroke="none" transform="matrix(0.025,0,0,0.025,0,24)"><path d="${d}"/></g>`;
}

const BEER_ICON = normalizeFilledIcon(beerIconSource);
const LIQUOR_ICON = normalizeFilledIcon(liquorIconSource);

export const SPORT_ICONS: Record<string, string> = {
  basketball: `<circle cx="12" cy="12" r="9"/><path d="M3.3 12h17.4"/><path d="M12 3c2.8 2.6 2.8 15.4 0 18"/><path d="M12 3c-2.8 2.6-2.8 15.4 0 18"/>`,
  baseball: `<circle cx="12" cy="12" r="9"/><path d="M7 6.5c1.5 2 1.5 11.5 0 13.5"/><path d="M17 4c-1.5 2-1.5 15 0 17"/>`,
  softball: `<circle cx="12" cy="12" r="9"/><path d="M7 6.5c1.5 2 1.5 11.5 0 13.5"/><path d="M17 4c-1.5 2-1.5 15 0 17"/>`,
  football: `<ellipse cx="12" cy="12" rx="9" ry="5.5"/><path d="M6.5 12h11"/><path d="M9.5 10v4M12 9.5v5M14.5 10v4"/>`,
  soccer: `<circle cx="12" cy="12" r="9"/><path d="M12 7.5l3 2.2-1.1 3.6h-3.8L9 9.7z"/><path d="M12 7.5V4.5M15 9.7l2.6-1.7M14.1 13.3l1.6 2.9M10 13.3l-1.6 2.9M9 9.7l-2.6-1.7"/>`,
  hockey: `<circle cx="17.5" cy="18.5" r="2.2"/><path d="M8 3.5l-2.3 13a2 2 0 001.97 2.3H10"/><path d="M6 15.5h6.5"/>`,
  tennis: `<ellipse cx="12" cy="9" rx="5.2" ry="6.2"/><path d="M12 2.8v12.4M6.8 9h10.4"/><path d="M12 15.2v6.5"/>`,
  golf: `<path d="M6 21V4"/><path d="M6 4l8.5 3.2L6 10.4z"/><circle cx="6" cy="21" r="1.3"/>`,
  volleyball: `<circle cx="12" cy="12" r="9"/><path d="M12 3a13 13 0 013.5 9 13 13 0 01-3.5 9"/><path d="M4 9.5c3 1.7 13 1.7 16 0"/>`,
  beer: BEER_ICON,
  drinking: BEER_ICON,
  shots: LIQUOR_ICON,
  liquor: LIQUOR_ICON,
};

export const FALLBACK_SPORT_ICON = `<path d="M8 4h8v3.2a4 4 0 01-8 0V4z"/><path d="M8 5H5.2A2.8 2.8 0 008 7.8"/><path d="M16 5h2.8A2.8 2.8 0 0116 7.8"/><path d="M12 11.2V14.5"/><path d="M8.5 20h7"/><path d="M12 14.5c-2.2 0-3.3 1.9-3.3 5.5h6.6c0-3.6-1.1-5.5-3.3-5.5z"/>`;

export function sportIcon(sport: string): string {
  return SPORT_ICONS[sport.trim().toLowerCase()] ?? FALLBACK_SPORT_ICON;
}
