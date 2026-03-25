/** Top Google Fonts — sorted by popularity */
export const GOOGLE_FONTS = [
  "Roboto",
  "Open Sans",
  "Noto Sans",
  "Montserrat",
  "Lato",
  "Poppins",
  "Inter",
  "Roboto Condensed",
  "Oswald",
  "Raleway",
  "Nunito",
  "Ubuntu",
  "Roboto Mono",
  "Nunito Sans",
  "Playfair Display",
  "Rubik",
  "Merriweather",
  "PT Sans",
  "Noto Serif",
  "Kanit",
  "Work Sans",
  "Lora",
  "DM Sans",
  "Fira Sans",
  "Mulish",
  "Barlow",
  "Manrope",
  "Quicksand",
  "Heebo",
  "Karla",
  "Josefin Sans",
  "Libre Franklin",
  "Inconsolata",
  "Titillium Web",
  "Dosis",
  "Source Code Pro",
  "Cabin",
  "Anton",
  "Hind",
  "Arimo",
  "Noto Sans JP",
  "Noto Sans KR",
  "PT Serif",
  "Libre Baskerville",
  "Oxygen",
  "Overpass",
  "Jost",
  "Bitter",
  "IBM Plex Sans",
  "IBM Plex Mono",
  "Archivo",
  "Exo 2",
  "Comfortaa",
  "Signika",
  "Space Grotesk",
  "Space Mono",
  "Abel",
  "Asap",
  "Crimson Text",
  "Catamaran",
  "Maven Pro",
  "Rajdhani",
  "Zilla Slab",
  "Assistant",
  "Questrial",
  "Varela Round",
  "Cormorant Garamond",
  "Play",
  "Red Hat Display",
  "Sora",
  "Lexend",
  "Spectral",
  "Urbanist",
  "Plus Jakarta Sans",
  "Outfit",
  "Be Vietnam Pro",
  "Figtree",
  "Geologica",
  "Bricolage Grotesque",
  "Onest",
] as const;

/** System / web-safe fonts */
export const SYSTEM_FONTS = [
  "Arial",
  "Helvetica",
  "Georgia",
  "Times New Roman",
  "Courier New",
  "Verdana",
  "Trebuchet MS",
  "system-ui",
  "monospace",
  "sans-serif",
  "serif",
] as const;

/** All fonts combined: system fonts first, then Google Fonts */
export const ALL_FONTS: Array<{ value: string; label: string; group: "system" | "google" }> =
  [
    ...SYSTEM_FONTS.map((f) => ({ value: f, label: f, group: "system" as const })),
    ...GOOGLE_FONTS.map((f) => ({ value: f, label: f, group: "google" as const })),
  ];

/** Build a Google Fonts CSS URL for a given font family */
export function googleFontUrl(family: string): string {
  const encoded = family.replace(/ /g, "+");
  return `https://fonts.googleapis.com/css2?family=${encoded}:wght@100;200;300;400;500;600;700;800;900&display=swap`;
}

/** Check if a font name is a Google Font (not a system font) */
export function isGoogleFont(family: string): boolean {
  return GOOGLE_FONTS.some((f) => f.toLowerCase() === family.toLowerCase());
}
