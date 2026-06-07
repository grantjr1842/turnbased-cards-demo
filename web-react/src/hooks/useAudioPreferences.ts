import { useCallback, useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { sfx } from "../audio/sfx";
import { readStorageItem } from "../storage";
import { writeStorageItem } from "../storage";

export function useAudioPreferences() {
  const [volume, setVolume] = useState(() => {
    const savedVolume = readStorageItem("uno_volume");
    const parsedVolume = savedVolume === null ? 0.5 : Number.parseFloat(savedVolume);
    return Number.isFinite(parsedVolume) ? parsedVolume : 0.5;
  });
  const [muted, setMuted] = useState(() => readStorageItem("uno_muted") === "true");

  useEffect(() => {
    sfx.setVolume(volume);
    sfx.setMuted(muted);
    writeStorageItem("uno_volume", String(volume));
    writeStorageItem("uno_muted", muted ? "true" : "false");
  }, [muted, volume]);

  const handleVolumeChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const nextVolume = Number.parseFloat(event.target.value);
    setVolume(nextVolume);
  }, []);

  const handleMuteToggle = useCallback(() => {
    setMuted((currentMuted) => !currentMuted);
  }, []);

  const playTestSound = useCallback(() => {
    sfx.playPluck();
  }, []);

  return {
    handleMuteToggle,
    handleVolumeChange,
    isMuted: muted || volume === 0,
    playTestSound,
    volume,
  };
}
