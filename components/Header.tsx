'use client';

import { USE_NEW_DESIGN } from '@/lib/uiFlags';
import HeaderModern from './HeaderModern';
import HeaderClassic from './HeaderClassic';

/**
 * Thin switcher so every existing `import Header from '@/components/Header'`
 * keeps working. Flip USE_NEW_DESIGN in lib/uiFlags.ts to revert to the
 * previous header instantly.
 */
export default function Header() {
  return USE_NEW_DESIGN ? <HeaderModern /> : <HeaderClassic />;
}
