import assert from "node:assert/strict";
import test from "node:test";
import { normalizeVolumeValue, parseStoredVolumeValue, sfx } from "../src/audio/sfx.ts";

function withSoundState(fn: () => void) {
  const originalVolume = sfx.getVolume();
  const originalMuted = sfx.isMuted();
  try {
    fn();
  } finally {
    sfx.setMuted(originalMuted);
    sfx.setVolume(originalVolume);
  }
}

test("normalizeVolumeValue clamps and rejects invalid values", () => {
  assert.equal(normalizeVolumeValue(-0.5), 0);
  assert.equal(normalizeVolumeValue(0.4), 0.4);
  assert.equal(normalizeVolumeValue(1.5), 1);
  assert.equal(normalizeVolumeValue(Number.NaN), null);
});

test("parseStoredVolumeValue ignores empty storage strings", () => {
  assert.equal(parseStoredVolumeValue(null), null);
  assert.equal(parseStoredVolumeValue(""), null);
  assert.equal(parseStoredVolumeValue("   "), null);
  assert.equal(parseStoredVolumeValue("0.75"), 0.75);
  assert.equal(parseStoredVolumeValue(" 0.25 "), 0.25);
});

test("setVolume keeps the current value when passed an invalid number", () => {
  withSoundState(() => {
    sfx.setVolume(0.25);
    assert.equal(sfx.getVolume(), 0.25);

    sfx.setVolume(1.75);
    assert.equal(sfx.getVolume(), 1);

    sfx.setVolume(-1);
    assert.equal(sfx.getVolume(), 0);

    const beforeInvalidUpdate = sfx.getVolume();
    sfx.setVolume(Number.NaN);
    assert.equal(sfx.getVolume(), beforeInvalidUpdate);
  });
});

test("one-shot sound methods are safe to call without an AudioContext", () => {
  withSoundState(() => {
    // In the node test environment there is no AudioContext. The methods must
    // initialize lazily, short-circuit cleanly, and never throw.
    assert.doesNotThrow(() => sfx.playPluck());
    assert.doesNotThrow(() => sfx.playSwish());
    assert.doesNotThrow(() => sfx.playChime());
    assert.doesNotThrow(() => sfx.playTurnAlert());
    assert.doesNotThrow(() => sfx.playHeartbeat());
    assert.doesNotThrow(() => sfx.playUno());
    assert.doesNotThrow(() => sfx.playError());
  });
});

test("muted state suppresses one-shot playback", () => {
  withSoundState(() => {
    sfx.setMuted(true);
    // No AudioContext exists in the test env, but the muted branch must still
    // short-circuit without producing any side effects.
    assert.doesNotThrow(() => sfx.playPluck());
    assert.doesNotThrow(() => sfx.playChime());
    assert.equal(sfx.isMuted(), true);
  });
});

test("one-shot play methods are no-arg (options object removed)", () => {
  withSoundState(() => {
    // Removing the unused OneShotOptions argument means the public API is a
    // plain no-arg call. Anything that still passes an object would be a
    // silent runtime no-op since the parameters are now ignored.
    assert.equal(sfx.playPluck.length, 0);
    assert.equal(sfx.playSwish.length, 0);
    assert.equal(sfx.playChime.length, 0);
    assert.equal(sfx.playTurnAlert.length, 0);
    assert.equal(sfx.playHeartbeat.length, 0);
    assert.equal(sfx.playUno.length, 0);
    assert.equal(sfx.playError.length, 0);
  });
});
