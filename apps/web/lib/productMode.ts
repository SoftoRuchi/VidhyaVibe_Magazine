'use client';

import { usePathname, useRouter } from 'next/navigation';
import React from 'react';
import { isChildAudience } from './viewingContext';

export type ProductMode = 'course' | 'magazine';

const KEY = 'vv_product_mode';
const EVENT = 'vv-product-mode';

export function getProductMode(): ProductMode {
  if (typeof window === 'undefined') return 'course';
  return localStorage.getItem(KEY) === 'magazine' ? 'magazine' : 'course';
}

export function persistProductMode(mode: ProductMode) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, mode);
  window.dispatchEvent(new Event(EVENT));
}

export function productModeFromPath(pathname: string): ProductMode | null {
  const path = pathname || '/';
  if (
    path.startsWith('/courses') ||
    path.startsWith('/books') ||
    path.startsWith('/notes') ||
    path.startsWith('/institute')
  ) {
    return 'course';
  }
  if (
    path.startsWith('/magazines') ||
    path.startsWith('/magazine') ||
    path.startsWith('/subscribe') ||
    path.startsWith('/read/') ||
    path.startsWith('/reader/') ||
    path.startsWith('/buy/') ||
    path.startsWith('/sales') ||
    path.startsWith('/posts') ||
    path.startsWith('/games') ||
    path.startsWith('/quiz') ||
    path.startsWith('/facts')
  ) {
    return 'magazine';
  }
  return null;
}

type ProductModeContextValue = {
  mode: ProductMode;
  setMode: (mode: ProductMode) => void;
  canUseCourses: boolean;
};

const ProductModeContext = React.createContext<ProductModeContextValue>({
  mode: 'course',
  setMode: () => {},
  canUseCourses: true,
});

export function ProductModeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [mode, setModeState] = React.useState<ProductMode>('course');
  const [canUseCourses, setCanUseCourses] = React.useState(true);

  React.useEffect(() => {
    const child = isChildAudience();
    setCanUseCourses(!child);
    const inferred = productModeFromPath(pathname);
    if (child) {
      persistProductMode('magazine');
      setModeState('magazine');
      return;
    }
    if (inferred) {
      persistProductMode(inferred);
      setModeState(inferred);
      return;
    }
    setModeState(getProductMode());
  }, [pathname]);

  React.useEffect(() => {
    const sync = () => {
      if (isChildAudience()) {
        setCanUseCourses(false);
        setModeState('magazine');
        return;
      }
      setCanUseCourses(true);
      setModeState(getProductMode());
    };
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const setMode = React.useCallback(
    (next: ProductMode) => {
      if (isChildAudience() && next === 'course') return;
      persistProductMode(next);
      setModeState(next);
      const inferred = productModeFromPath(pathname);
      if (inferred !== next && pathname !== '/') router.push('/');
    },
    [pathname, router],
  );

  const value = React.useMemo(
    () => ({ mode, setMode, canUseCourses }),
    [mode, setMode, canUseCourses],
  );

  return React.createElement(ProductModeContext.Provider, { value }, children);
}

export function useProductMode() {
  return React.useContext(ProductModeContext);
}
