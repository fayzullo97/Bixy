import { createElement, useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { playNarration } from '../board/audio';

/**
 * DEV-ONLY (`?dev=speed`): preview narration at different speeds by ear.
 *
 * Narration reads slow, and there are two different levers for that with very
 * different costs (see Part 02 §3):
 *
 *   - **Client-side `playbackRate`** — applied to already-rendered audio, so it
 *     needs no regeneration and no cache invalidation, and can be changed for
 *     every existing lesson at once. It resamples rather than re-voicing, so it
 *     changes delivery speed without re-performing the line.
 *   - **Provider-side speed** — Aisha takes a `speed` field (Uzbek/Gulnoza flow
 *     only, currently pinned to `1.0`); OpenAI's `/v1/audio/speech` documents
 *     `speed` as unsupported on `gpt-4o-mini-tts`, the model this project runs,
 *     leaving `instructions` as the only pacing steer there. Either way it means
 *     re-synthesizing and invalidating every cached clip.
 *
 * This screen drives the first one live so the right number gets chosen by
 * listening rather than guessed. It deliberately does NOT change any default:
 * nothing here writes a setting. Read the number off the slider, then decide.
 *
 * Takes a narration WAV URL because the narration bucket is public — paste any
 * clip URL from a generated lesson, or a greeting clip from
 * `npm run gen-greeting-clips`, and it plays without a session.
 */

const PRESETS = [0.9, 1, 1.1, 1.15, 1.25, 1.4, 1.6];
const MIN_RATE = 0.5;
const MAX_RATE = 2;

export function DevNarrationSpeedScreen() {
  const [url, setUrl] = useState('');
  const [rate, setRate] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const cancelRef = useRef<() => void>(() => {});
  // Held so the rate can be changed DURING playback — the whole point of the
  // screen is hearing the difference without restarting the clip each time.
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => cancelRef.current(), []);

  // Live rate change on the currently-playing element.
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = rate;
  }, [rate]);

  const stop = useCallback(() => {
    cancelRef.current();
    cancelRef.current = () => {};
    audioRef.current = null;
    setPlaying(false);
  }, []);

  const play = useCallback(() => {
    if (!url.trim()) return;
    cancelRef.current();
    setPositionMs(0);
    setPlaying(true);
    cancelRef.current = playNarration(
      url.trim(),
      () => {
        setPlaying(false);
        audioRef.current = null;
      },
      (ms) => setPositionMs(ms),
      rate,
    );
    // `playNarration` owns the element; grab the one it just created so the
    // slider can retune it mid-clip. Dev-only reach-around, not a pattern to
    // copy into the real board.
    if (typeof document !== 'undefined') {
      const audios = document.getElementsByTagName('audio');
      audioRef.current = audios.length > 0 ? audios[audios.length - 1]! : null;
    }
  }, [url, rate]);

  const slider =
    Platform.OS === 'web'
      ? createElement('input', {
          type: 'range',
          min: MIN_RATE,
          max: MAX_RATE,
          step: 0.05,
          value: rate,
          onChange: (e: { target: { value: string } }) => setRate(Number(e.target.value)),
          style: { width: '100%', maxWidth: 520, accentColor: '#5aa9ff' },
        })
      : null;

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Narration speed preview</Text>
      <Text style={styles.body}>
        Paste a narration WAV URL from the public bucket, press Play, then move the slider while it
        plays. Nothing here changes a default — it only tells you which number to pick.
      </Text>

      <TextInput
        style={styles.input}
        value={url}
        onChangeText={setUrl}
        placeholder="https://…/storage/v1/object/public/narration/….wav"
        placeholderTextColor="#5b6472"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <View style={styles.row}>
        <Pressable style={[styles.button, playing && styles.buttonOff]} onPress={playing ? stop : play}>
          <Text style={styles.buttonText}>{playing ? 'Stop' : 'Play'}</Text>
        </Pressable>
        <Text style={styles.readout}>
          {rate.toFixed(2)}× · {(positionMs / 1000).toFixed(1)}s
        </Text>
      </View>

      {slider}

      <View style={styles.presets}>
        {PRESETS.map((preset) => (
          <Pressable
            key={preset}
            style={[styles.preset, Math.abs(preset - rate) < 0.001 && styles.presetOn]}
            onPress={() => setRate(preset)}
          >
            <Text style={styles.presetText}>{preset.toFixed(2)}×</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.note}>
        Rate applies to already-rendered audio, so whatever you settle on works for every existing
        cached lesson with no regeneration. A provider-side change would mean re-synthesizing and
        invalidating the cache — see this file&apos;s header for what each provider actually accepts.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#12151c', padding: 24, gap: 16 },
  title: { color: '#e7ecf3', fontSize: 22, fontWeight: '700' },
  body: { color: '#9aa7b8', fontSize: 14, lineHeight: 20, maxWidth: 560 },
  input: {
    borderWidth: 1,
    borderColor: '#2a3140',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#e7ecf3',
    backgroundColor: '#171b24',
    maxWidth: 560,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  button: {
    backgroundColor: '#5aa9ff',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  buttonOff: { backgroundColor: '#3a4354' },
  buttonText: { color: '#0b0e14', fontWeight: '700' },
  readout: { color: '#e7ecf3', fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: {
    borderWidth: 1,
    borderColor: '#2a3140',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  presetOn: { borderColor: '#5aa9ff', backgroundColor: 'rgba(90,169,255,0.12)' },
  presetText: { color: '#cfd8e3', fontSize: 13 },
  note: { color: '#6b7787', fontSize: 12, lineHeight: 18, maxWidth: 560 },
});
