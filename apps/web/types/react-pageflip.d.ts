declare module 'react-pageflip' {
  import type { CSSProperties, ForwardRefExoticComponent, ReactNode, RefAttributes } from 'react';

  export type HTMLFlipBookProps = {
    width: number;
    height: number;
    size?: 'fixed' | 'stretch';
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    drawShadow?: boolean;
    flippingTime?: number;
    usePortrait?: boolean;
    startZIndex?: number;
    autoSize?: boolean;
    maxShadowOpacity?: number;
    showCover?: boolean;
    mobileScrollSupport?: boolean;
    clickEventForward?: boolean;
    useMouseEvents?: boolean;
    swipeDistance?: number;
    showPageCorners?: boolean;
    disableFlipByClick?: boolean;
    className?: string;
    style?: CSSProperties;
    children?: ReactNode;
    onFlip?: (e: { data: number }) => void;
    onChangeOrientation?: (e: { data: string }) => void;
    onChangeState?: (e: { data: string }) => void;
  };

  const HTMLFlipBook: ForwardRefExoticComponent<HTMLFlipBookProps & RefAttributes<unknown>>;
  export default HTMLFlipBook;
}
