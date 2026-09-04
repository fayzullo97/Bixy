import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

/**
 * The single input (§8.5/§11): one dark, pill-shaped control anchored at the
 * bottom of the board — a text field for a topic or a follow-up question, plus a
 * photo attach. No other chrome. The parent owns what a submission does (a new
 * topic, a re-explanation) and the async/busy state; this stays presentational.
 */
export function InputBar({
  placeholder,
  attachLabel,
  busy,
  onSend,
  onAttach,
}: {
  placeholder: string;
  attachLabel: string;
  busy?: boolean;
  onSend: (text: string) => void;
  onAttach: () => void;
}) {
  const [text, setText] = useState('');

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setText('');
    onSend(trimmed);
  };

  const canSend = !busy && text.trim().length > 0;

  return (
    <View style={styles.bar}>
      <Pressable
        onPress={onAttach}
        disabled={busy}
        style={styles.attach}
        accessibilityRole="button"
        accessibilityLabel={attachLabel}
      >
        <Text style={styles.icon}>📷</Text>
      </Pressable>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor="#6b7280"
        editable={!busy}
        onSubmitEditing={submit}
        returnKeyType="send"
        blurOnSubmit={false}
      />
      <Pressable
        onPress={submit}
        disabled={!canSend}
        style={[styles.send, !canSend && styles.sendDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Send"
      >
        {busy ? <ActivityIndicator color="#0b0e14" size="small" /> : <Text style={styles.sendIcon}>↑</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: Platform.OS === 'web' ? 16 : 24,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 28,
    backgroundColor: '#1b1f2a',
    borderWidth: 1,
    borderColor: '#2a2f3c',
  },
  attach: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 20 },
  input: {
    flex: 1,
    color: '#e6e8ee',
    fontSize: 16,
    paddingHorizontal: 8,
    paddingVertical: Platform.OS === 'web' ? 8 : 4,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#5aa9ff', alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { backgroundColor: '#3a4150' },
  sendIcon: { color: '#0b0e14', fontSize: 20, fontWeight: '700' },
});
