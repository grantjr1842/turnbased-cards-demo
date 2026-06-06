export interface AvatarSymbol {
  id: string;
  emoji: string;
  name: string;
}

export interface AvatarTheme {
  id: string;
  name: string;
  primary: string;
  secondary: string;
}

export const AVATAR_SYMBOLS: AvatarSymbol[] = [
  { id: "tiger", emoji: "🐯", name: "Neon Tiger" },
  { id: "dragon", emoji: "🐲", name: "Cosmic Dragon" },
  { id: "phoenix", emoji: "🦅", name: "Golden Phoenix" },
  { id: "panda", emoji: "🐼", name: "Shadow Panda" },
  { id: "wolf", emoji: "🐺", name: "Alpha Wolf" },
  { id: "owl", emoji: "🦉", name: "Cyber Owl" },
  { id: "fox", emoji: "🦊", name: "Spectral Fox" },
  { id: "shark", emoji: "🦈", name: "Deep Shark" },
];

export const AVATAR_SYMBOLS_BY_ID = new Map(AVATAR_SYMBOLS.map((symbol) => [symbol.id, symbol] as const));

export const AVATAR_THEMES: AvatarTheme[] = [
  { id: "rose", name: "Neon Rose", primary: "hsl(358, 75%, 55%)", secondary: "hsl(340, 75%, 45%)" },
  {
    id: "sapphire",
    name: "Electric Sapphire",
    primary: "hsl(208, 85%, 52%)",
    secondary: "hsl(220, 80%, 42%)",
  },
  {
    id: "aurora",
    name: "Emerald Aurora",
    primary: "hsl(148, 65%, 45%)",
    secondary: "hsl(160, 60%, 35%)",
  },
  { id: "sol", name: "Golden Sol", primary: "hsl(46, 95%, 55%)", secondary: "hsl(35, 90%, 45%)" },
  {
    id: "nebula",
    name: "Purple Nebula",
    primary: "hsl(280, 75%, 55%)",
    secondary: "hsl(260, 70%, 45%)",
  },
];

export const AVATAR_THEMES_BY_ID = new Map(AVATAR_THEMES.map((theme) => [theme.id, theme] as const));
