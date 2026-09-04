import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { strings } from '../i18n';

/**
 * Stand-in for the board, which arrives in Phase 3. Its only job here is to prove
 * the signed-in session works: greet the student by name with their avatar
 * (§8.8 / §8.12) and offer an unobtrusive sign-out (§8.8) — a quiet link, not a
 * toolbar button competing with the board's single input.
 */
export function BoardPlaceholderScreen() {
  const { user, signOut } = useAuth();
  if (!user) return null;

  const lang = user.appLanguage;
  const t = strings[lang];
  const displayName = user.name ?? user.username ?? 'there';
  const initial = displayName.trim().charAt(0).toUpperCase() || '?';

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        {user.photoUrl ? (
          <Image source={{ uri: user.photoUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}
        <Text style={styles.greeting}>{t.greeting(displayName)}</Text>
      </View>

      <View style={styles.board}>
        <Text style={styles.placeholder}>{t.boardPlaceholder}</Text>
      </View>

      <Pressable onPress={signOut} accessibilityRole="button" style={styles.signOut}>
        <Text style={styles.signOutText}>{t.signOut}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff', padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#eaecf0' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#2ca5e0' },
  avatarInitial: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  greeting: { fontSize: 18, fontWeight: '600', color: '#101828' },
  board: {
    flex: 1,
    marginVertical: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#eaecf0',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: { color: '#98a2b3', fontSize: 15 },
  signOut: { alignSelf: 'center', paddingVertical: 8 },
  signOutText: { color: '#667085', fontSize: 14, textDecorationLine: 'underline' },
});
