import { Platform } from 'react-native';

/**
 * Whether the DEV-only routes (`?dev=board|levelcheck|bixy`) and the dev
 * sign-in seam are available.
 *
 * `__DEV__` is the load-bearing half. Metro compiles it to a literal `false` in
 * a production export, so the dev screens are unreachable in any shipped bundle
 * no matter what environment the build ran in.
 *
 * The EXPO_PUBLIC_DEV_LOGIN check alone was NOT sufficient, verified against a
 * real `expo export`: the comparison was optimized out of the bundle and
 * `?dev=bixy` rendered the debug controls from a production build. That flag
 * stays as the second half so the routes are opt-in even locally, but it is no
 * longer what stands between a student and the debug UI.
 */
export function devRoutesEnabled(): boolean {
  return __DEV__ && Platform.OS === 'web' && process.env.EXPO_PUBLIC_DEV_LOGIN === '1';
}
