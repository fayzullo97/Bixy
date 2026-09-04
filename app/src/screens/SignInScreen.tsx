import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { telegramLogin, TelegramLoginError } from '../auth/telegram-login';
import { api } from '../api/client';
import { isOffline } from '../net/offline';
import { LANGUAGES, LANGUAGE_LABELS, strings, type Lang } from '../i18n';

const DEV_LOGIN_ENABLED = process.env.EXPO_PUBLIC_DEV_LOGIN === '1';

/**
 * The sign-in gate shown before the board (§8.8). Two jobs: pick the app
 * language (§8.7), then authorize with Telegram. Minimal by design — it isn't
 * part of the board's single-input interface, it's a gate in front of it.
 */
export function SignInScreen() {
  const { completeSignIn, error, setError } = useAuth();
  const [lang, setLang] = useState<Lang>('en');
  const [busy, setBusy] = useState(false);
  const t = strings[lang];

  async function handleTelegram() {
    setBusy(true);
    setError(null);
    try {
      const idToken = await telegramLogin();
      try {
        const result = await api.telegramLogin(idToken, lang);
        await completeSignIn(result);
      } catch {
        // Telegram gave us a token but our server rejected it (§8.8 id_token
        // validation) or was unreachable — a different failure than a decline.
        setError(isOffline() ? t.offline : t.loginFailed);
      }
    } catch (e) {
      // Telegram itself returned no token: a decline/blocked popup, or the widget
      // couldn't load / isn't registered yet. Each gets its own plain message,
      // and the button stays enabled so the student can simply try again (§8.10).
      if (e instanceof TelegramLoginError && e.code === 'cancelled') setError(t.loginCancelled);
      else if (isOffline()) setError(t.offline);
      else setError(t.loginUnavailable);
    } finally {
      setBusy(false);
    }
  }

  async function handleDevLogin() {
    setBusy(true);
    setError(null);
    try {
      const result = await api.devLogin(lang);
      await completeSignIn(result);
    } catch {
      setError('Dev sign-in failed — is the server running with ALLOW_DEV_LOGIN=1?');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.brand}>Whiteboard AI Tutor</Text>
        <Text style={styles.tagline}>{t.tagline}</Text>

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
          onPress={handleTelegram}
          disabled={busy}
          style={[styles.telegramButton, busy && styles.buttonDisabled]}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.telegramButtonText}>{t.loginWithTelegram}</Text>
          )}
        </Pressable>

        {DEV_LOGIN_ENABLED ? (
          <Pressable onPress={handleDevLogin} disabled={busy} style={styles.devButton}>
            <Text style={styles.devButtonText}>{t.devLogin}</Text>
          </Pressable>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
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
  label: { fontSize: 13, fontWeight: '600', color: '#344054', marginBottom: 10 },
  langRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
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
  telegramButton: {
    backgroundColor: '#2ca5e0',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  telegramButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  buttonDisabled: { opacity: 0.7 },
  devButton: { marginTop: 12, paddingVertical: 10, alignItems: 'center' },
  devButtonText: { color: '#98a2b3', fontSize: 13 },
  error: { marginTop: 16, color: '#b42318', fontSize: 13, textAlign: 'center' },
});
