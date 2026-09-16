import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { LANGUAGES, LANGUAGE_LABELS, strings, type Lang } from '../i18n';
import { devRoutesEnabled } from '../dev/enabled';

// Same gate as the dev routes: `__DEV__` is what actually keeps this out of a
// production bundle — the env check alone was stripped by the export (see
// dev/enabled.ts). The server refuses dev-login in production regardless, but
// the button should never be on screen for a student to find in the first place.
const DEV_LOGIN_ENABLED = devRoutesEnabled();

/**
 * Shown when the app is NOT signed in and NOT running inside Telegram (§8.8).
 * There is no login form anymore — a real user reaches the board by opening the
 * app from the bot in Telegram, where identity is read from the Mini App context.
 * This screen just explains that, and (on an in-Telegram sign-in failure) offers a
 * retry. The dev-login seam is preserved for local runs outside Telegram.
 */
export function OpenInTelegramScreen() {
  const { status, error, retry, devLogin } = useAuth();
  const [lang, setLang] = useState<Lang>('en');
  const [busy, setBusy] = useState(false);
  const [devError, setDevError] = useState<string | null>(null);
  const t = strings[lang];

  // AuthContext stores an error *key*; map it to the chosen language here.
  const errorMessage = error === 'offline' ? t.offline : error === 'loginFailed' ? t.loginFailed : null;

  async function handleDevLogin() {
    setBusy(true);
    setDevError(null);
    try {
      await devLogin(lang);
    } catch {
      setDevError('Dev sign-in failed — is the server running with ALLOW_DEV_LOGIN=1?');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.brand}>Whiteboard AI Tutor</Text>
        <Text style={styles.tagline}>{t.tagline}</Text>

        <Text style={styles.title}>{t.openInTelegramTitle}</Text>
        <Text style={styles.body}>{t.openInTelegramBody}</Text>

        {status === 'error' ? (
          <>
            {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
            <Pressable onPress={retry} style={styles.retryButton} accessibilityRole="button">
              <Text style={styles.retryButtonText}>{t.tryAgain}</Text>
            </Pressable>
          </>
        ) : null}

        {DEV_LOGIN_ENABLED ? (
          <View style={styles.devBlock}>
            <Text style={styles.label}>{t.chooseLanguage}</Text>
            <View style={styles.langRow}>
              {LANGUAGES.map((code) => {
                const selected = code === lang;
                return (
                  <Pressable
                    key={code}
                    onPress={() => setLang(code)}
                    style={[styles.langPill, selected && styles.langPillSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.langText, selected && styles.langTextSelected]}>
                      {LANGUAGE_LABELS[code]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={handleDevLogin}
              disabled={busy}
              style={[styles.devButton, busy && styles.buttonDisabled]}
              accessibilityRole="button"
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.devButtonText}>{t.devLogin}</Text>
              )}
            </Pressable>
            {devError ? <Text style={styles.error}>{devError}</Text> : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f7fb',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 28,
    ...Platform.select({
      web: { boxShadow: '0 10px 30px rgba(16, 24, 40, 0.08)' } as object,
      default: {
        shadowColor: '#101828',
        shadowOpacity: 0.08,
        shadowRadius: 30,
        shadowOffset: { width: 0, height: 10 },
        elevation: 4,
      },
    }),
  },
  brand: { fontSize: 24, fontWeight: '700', color: '#101828', textAlign: 'center' },
  tagline: {
    fontSize: 15,
    color: '#475467',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  title: { fontSize: 18, fontWeight: '600', color: '#101828', textAlign: 'center' },
  body: {
    fontSize: 15,
    color: '#475467',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 22,
  },
  label: { fontSize: 13, fontWeight: '600', color: '#344054', marginBottom: 10 },
  langRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  langPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    alignItems: 'center',
  },
  langPillSelected: { borderColor: '#2ca5e0', backgroundColor: '#eaf6fd' },
  langText: { fontSize: 14, color: '#475467' },
  langTextSelected: { color: '#0b76b7', fontWeight: '600' },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#2ca5e0',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  retryButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  devBlock: {
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eaecf0',
  },
  devButton: {
    backgroundColor: '#667085',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  devButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  buttonDisabled: { opacity: 0.7 },
  error: { marginTop: 16, color: '#b42318', fontSize: 13, textAlign: 'center' },
});
