import { useCallback, useState } from "react";
import { AVATAR_SYMBOLS_BY_ID, AVATAR_THEMES_BY_ID } from "../tableConfig";
import { parsePlayerName } from "../gameHelpers";
import { readStorageItem, writeStorageItem } from "../storage";

const DEFAULT_AVATAR_SYMBOL = "tiger";
const DEFAULT_AVATAR_THEME = "rose";

type LobbyDifficulty = "easy" | "medium" | "hard";

export type LobbyFormState = ReturnType<typeof useLobbyFormState>;

function normalizeAvatarSymbol(value: string | null) {
  return value && AVATAR_SYMBOLS_BY_ID.has(value) ? value : DEFAULT_AVATAR_SYMBOL;
}

function normalizeAvatarTheme(value: string | null) {
  return value && AVATAR_THEMES_BY_ID.has(value) ? value : DEFAULT_AVATAR_THEME;
}

export function useLobbyFormState() {
  const [name, setName] = useState(() => {
    const raw = readStorageItem("uno_nickname") || "";
    return parsePlayerName(raw).name;
  });
  const [roomCode, setRoomCode] = useState("");
  const [password, setPassword] = useState("");
  const [privateRoom, setPrivateRoom] = useState(false);
  const [difficulty, setDifficulty] = useState<LobbyDifficulty>("medium");
  const [avatarSymbol, setAvatarSymbol] = useState(() =>
    normalizeAvatarSymbol(readStorageItem("uno_av_symbol")),
  );
  const [avatarTheme, setAvatarTheme] = useState(() =>
    normalizeAvatarTheme(readStorageItem("uno_av_theme")),
  );

  const trimmedName = name.trim();
  const trimmedRoomCode = roomCode.trim();
  const validName = trimmedName.length >= 2 && trimmedName.length <= 16;
  const hasRoomCode = trimmedRoomCode.length > 0;

  const persistProfile = useCallback(() => {
    writeStorageItem("uno_av_symbol", avatarSymbol);
    writeStorageItem("uno_av_theme", avatarTheme);
    writeStorageItem("uno_nickname", trimmedName);
  }, [avatarSymbol, avatarTheme, trimmedName]);

  const buildJoinOptions = useCallback(
    () => ({
      name: `[av-${avatarSymbol}-${avatarTheme}]${trimmedName}`,
      private: privateRoom,
      difficulty,
      password: password || undefined,
    }),
    [avatarSymbol, avatarTheme, difficulty, password, privateRoom, trimmedName],
  );

  return {
    avatarSymbol,
    avatarTheme,
    buildJoinOptions,
    difficulty,
    name,
    password,
    persistProfile,
    privateRoom,
    roomCode,
    setAvatarSymbol,
    setAvatarTheme,
    setDifficulty,
    setName,
    setPassword,
    setPrivateRoom,
    setRoomCode,
    trimmedName,
    trimmedRoomCode,
    hasRoomCode,
    validName,
  };
}
