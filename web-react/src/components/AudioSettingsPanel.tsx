import type { CSSProperties } from "react";
import { useAudioPreferences } from "../hooks/useAudioPreferences";

function AudioSettingsPanel() {
  const { handleMuteToggle, handleVolumeChange, isMuted, playTestSound, volume } =
    useAudioPreferences();

  return (
    <div className="audio-controls-panel">
      <button
        className="audio-btn-toggle"
        onClick={handleMuteToggle}
        type="button"
        aria-pressed={isMuted}
        aria-label={isMuted ? "Unmute audio" : "Mute audio"}
        title={isMuted ? "Unmute audio" : "Mute audio"}
      >
        {isMuted ? "🔇" : "🔊"}
      </button>
      <div className="volume-slider-container">
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={handleVolumeChange}
          className="volume-slider"
          aria-label="Volume level"
          style={{ "--vol-val": `${volume * 100}%` } as CSSProperties}
        />
        <span>{Math.round(volume * 100)}%</span>
      </div>
      <button
        className="ghost-btn audio-test-btn"
        onClick={playTestSound}
        type="button"
        aria-label="Test sound"
        title="Test sound"
      >
        Test Sound
      </button>
    </div>
  );
}

export { AudioSettingsPanel };
