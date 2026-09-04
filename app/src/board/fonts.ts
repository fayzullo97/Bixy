import {
  useFonts,
  Caveat_400Regular,
  Caveat_600SemiBold,
  Caveat_700Bold,
} from '@expo-google-fonts/caveat';

// All formal board text uses Caveat, a handwriting-style font (§8.3).
export const FONT_REGULAR = 'Caveat_400Regular';
export const FONT_SEMIBOLD = 'Caveat_600SemiBold';
export const FONT_BOLD = 'Caveat_700Bold';

/** Loads the Caveat weights. Returns true once ready. */
export function useBoardFonts(): boolean {
  const [loaded] = useFonts({ Caveat_400Regular, Caveat_600SemiBold, Caveat_700Bold });
  return loaded;
}
