import React, { FC, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Icon } from "zmp-ui";
import CustomIcon from "./custom-icon";

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
export const DOUBLE_TAP_ZOOM = 2.5;

export function clampScale(scale: number, min = MIN_ZOOM, max = MAX_ZOOM): number {
  if (Number.isNaN(scale) || !Number.isFinite(scale)) return min;
  return Math.min(max, Math.max(min, Number(scale.toFixed(3))));
}

export function computeWheelZoom(currentScale: number, deltaY: number, step = 0.25): number {
  if (deltaY === 0) return clampScale(currentScale);
  const direction = deltaY < 0 ? 1 : -1;
  return clampScale(currentScale + direction * step);
}

export function computePinchDistance(
  p1: { clientX: number; clientY: number },
  p2: { clientX: number; clientY: number }
): number {
  return Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
}

export function computePinchZoom(
  initialScale: number,
  initialDistance: number,
  currentDistance: number
): number {
  if (!initialDistance || initialDistance <= 0) return clampScale(initialScale);
  const ratio = currentDistance / initialDistance;
  return clampScale(initialScale * ratio);
}

export function clampPanOffset(
  offset: { x: number; y: number },
  scale: number,
  viewportWidth = 360,
  viewportHeight = 640
): { x: number; y: number } {
  if (scale <= 1) {
    return { x: 0, y: 0 };
  }
  const maxX = ((scale - 1) * Math.max(viewportWidth, 300)) / 2;
  const maxY = ((scale - 1) * Math.max(viewportHeight, 300)) / 2;
  return {
    x: Math.min(maxX, Math.max(-maxX, Math.round(offset.x))),
    y: Math.min(maxY, Math.max(-maxY, Math.round(offset.y))),
  };
}

export function toggleDoubleTapZoom(currentScale: number): {
  scale: number;
  offset: { x: number; y: number };
} {
  if (currentScale > 1.05) {
    return { scale: MIN_ZOOM, offset: { x: 0, y: 0 } };
  }
  return { scale: DOUBLE_TAP_ZOOM, offset: { x: 0, y: 0 } };
}

interface ZoomableImageCanvasProps {
  src: string;
  alt?: string;
  scale?: number;
  offset?: { x: number; y: number };
  onScaleChange?: (nextScale: number, nextOffset?: { x: number; y: number }) => void;
  onOffsetChange?: (nextOffset: { x: number; y: number }) => void;
  onSwipePrev?: () => void;
  onSwipeNext?: () => void;
  onSingleTap?: () => void;
}

export const ZoomableImageCanvas: FC<ZoomableImageCanvasProps> = ({
  src,
  alt = "Xem ảnh",
  scale: controlledScale,
  offset: controlledOffset,
  onScaleChange,
  onOffsetChange,
  onSwipePrev,
  onSwipeNext,
  onSingleTap,
}) => {
  const [internalScale, setInternalScale] = useState<number>(MIN_ZOOM);
  const [internalOffset, setInternalOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const scale = controlledScale !== undefined ? controlledScale : internalScale;
  const offset = controlledOffset !== undefined ? controlledOffset : internalOffset;

  const updateScaleAndOffset = useCallback(
    (nextScale: number, nextOffset?: { x: number; y: number }) => {
      if (onScaleChange) {
        onScaleChange(nextScale, nextOffset);
      } else {
        setInternalScale(nextScale);
        if (nextOffset !== undefined) {
          setInternalOffset(nextOffset);
        }
      }
    },
    [onScaleChange]
  );

  const updateOffset = useCallback(
    (nextOffset: { x: number; y: number }) => {
      if (onOffsetChange) {
        onOffsetChange(nextOffset);
      } else {
        setInternalOffset(nextOffset);
      }
    },
    [onOffsetChange]
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  scaleRef.current = scale;
  offsetRef.current = offset;

  const isDraggingMouseRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; origX: number; origY: number }>({
    x: 0,
    y: 0,
    origX: 0,
    origY: 0,
  });
  const didMoveRef = useRef(false);

  const pinchRef = useRef<{
    active: boolean;
    initialDistance: number;
    initialScale: number;
  }>({
    active: false,
    initialDistance: 0,
    initialScale: 1,
  });

  const touchPanRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  }>({
    active: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });

  const lastTapTimeRef = useRef<number>(0);

  // Desktop / Simulator mouse wheel zoom listener (non-passive to prevent page scroll)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const nextScale = computeWheelZoom(scaleRef.current, e.deltaY, 0.25);
      const rect = el.getBoundingClientRect();
      const clampedOffset = clampPanOffset(
        offsetRef.current,
        nextScale,
        rect.width,
        rect.height
      );
      updateScaleAndOffset(nextScale, clampedOffset);
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", handleWheel);
    };
  }, [updateScaleAndOffset]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const res = toggleDoubleTapZoom(scaleRef.current);
    updateScaleAndOffset(res.scale, res.offset);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    didMoveRef.current = false;
    if (scaleRef.current <= 1) return;
    isDraggingMouseRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      origX: offsetRef.current.x,
      origY: offsetRef.current.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingMouseRef.current) return;
    e.stopPropagation();
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      didMoveRef.current = true;
    }
    const rect = containerRef.current?.getBoundingClientRect();
    const nextOffset = clampPanOffset(
      {
        x: dragStartRef.current.origX + dx,
        y: dragStartRef.current.origY + dy,
      },
      scaleRef.current,
      rect?.width || 360,
      rect?.height || 640
    );
    updateOffset(nextOffset);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    isDraggingMouseRef.current = false;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length === 2) {
      pinchRef.current = {
        active: true,
        initialDistance: computePinchDistance(e.touches[0], e.touches[1]),
        initialScale: scaleRef.current,
      };
      touchPanRef.current.active = false;
      didMoveRef.current = true;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapTimeRef.current < 280) {
        const res = toggleDoubleTapZoom(scaleRef.current);
        updateScaleAndOffset(res.scale, res.offset);
        lastTapTimeRef.current = 0;
        didMoveRef.current = true;
        return;
      }
      lastTapTimeRef.current = now;
      didMoveRef.current = false;
      touchPanRef.current = {
        active: true,
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        origX: offsetRef.current.x,
        origY: offsetRef.current.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    const rect = containerRef.current?.getBoundingClientRect();
    if (e.touches.length === 2 && pinchRef.current.active) {
      const dist = computePinchDistance(e.touches[0], e.touches[1]);
      const nextScale = computePinchZoom(
        pinchRef.current.initialScale,
        pinchRef.current.initialDistance,
        dist
      );
      const nextOffset = clampPanOffset(
        offsetRef.current,
        nextScale,
        rect?.width || 360,
        rect?.height || 640
      );
      updateScaleAndOffset(nextScale, nextOffset);
    } else if (e.touches.length === 1 && touchPanRef.current.active) {
      const dx = e.touches[0].clientX - touchPanRef.current.startX;
      const dy = e.touches[0].clientY - touchPanRef.current.startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        didMoveRef.current = true;
      }
      if (scaleRef.current > 1) {
        const nextOffset = clampPanOffset(
          {
            x: touchPanRef.current.origX + dx,
            y: touchPanRef.current.origY + dy,
          },
          scaleRef.current,
          rect?.width || 360,
          rect?.height || 640
        );
        updateOffset(nextOffset);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (pinchRef.current.active && e.touches.length < 2) {
      pinchRef.current.active = false;
    }
    if (touchPanRef.current.active && e.changedTouches.length > 0) {
      const dx = e.changedTouches[0].clientX - touchPanRef.current.startX;
      const dy = e.changedTouches[0].clientY - touchPanRef.current.startY;
      touchPanRef.current.active = false;

      if (scaleRef.current <= 1 && Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        if (dx > 0 && onSwipePrev) {
          onSwipePrev();
        } else if (dx < 0 && onSwipeNext) {
          onSwipeNext();
        }
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-hidden select-none touch-none"
      style={{ cursor: scale > 1 ? "grab" : "zoom-in" }}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        e.stopPropagation();
        if (!didMoveRef.current && onSingleTap) {
          onSingleTap();
        }
      }}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="max-w-full max-h-[80vh] object-contain select-none pointer-events-none"
        style={{
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
          transition: isDraggingMouseRef.current || touchPanRef.current.active || pinchRef.current.active
            ? "none"
            : "transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
          willChange: "transform",
        }}
      />
    </div>
  );
};

export interface ImageViewerModalProps {
  visible: boolean;
  images?: string[];
  src?: string;
  title?: string;
  initialIndex?: number;
  onClose: () => void;
  allowDownload?: boolean;
  onDownload?: (url: string, index: number) => void;
  actionLabel?: string;
  onActionClick?: (index: number) => void;
  onAction?: () => void;
  onIndexChange?: (index: number) => void;
}

export const ImageViewerModal: FC<ImageViewerModalProps> = ({
  visible,
  images,
  src,
  title,
  initialIndex = 0,
  onClose,
  allowDownload = false,
  onDownload,
  actionLabel,
  onActionClick,
  onAction,
  onIndexChange,
}) => {
  const imgList: string[] = useMemo(() => {
    if (Array.isArray(images) && images.length > 0) {
      return images;
    }
    if (src) {
      return [src];
    }
    return [];
  }, [images, src]);

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [scale, setScale] = useState<number>(MIN_ZOOM);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (visible && imgList.length > 0) {
      const safeIdx = Math.min(Math.max(0, initialIndex), imgList.length - 1);
      setActiveIndex(safeIdx);
      setScale(MIN_ZOOM);
      setOffset({ x: 0, y: 0 });
    }
  }, [visible, initialIndex, imgList]);

  const handleScaleChange = useCallback(
    (nextScale: number, nextOffset?: { x: number; y: number }) => {
      const clamped = clampScale(nextScale);
      setScale(clamped);
      if (clamped <= 1) {
        setOffset({ x: 0, y: 0 });
      } else if (nextOffset) {
        setOffset(nextOffset);
      }
    },
    []
  );

  const goToSlide = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= imgList.length) return;
      setActiveIndex(nextIndex);
      setScale(MIN_ZOOM);
      setOffset({ x: 0, y: 0 });
      if (onIndexChange) {
        onIndexChange(nextIndex);
      }
    },
    [imgList.length, onIndexChange]
  );

  const handleAction = useCallback(() => {
    if (onActionClick) {
      onActionClick(activeIndex);
    } else if (onAction) {
      onAction();
    }
  }, [onActionClick, onAction, activeIndex]);

  if (!visible || imgList.length === 0) return null;

  const currentSrc = imgList[activeIndex] || imgList[0];

  return (
    <div
      className="fixed inset-0 bg-black/95 z-[9999] flex flex-col justify-between select-none animate-fade-in"
      onClick={onClose}
    >
      {/* Top Header: Nút Đóng luôn nằm ở góc trên bên TRÁI để tránh tuyệt đối cụm nút thoát Zalo ở góc trên bên phải */}
      <div
        className="w-full px-4 pb-3 flex items-center justify-between z-20 pr-24"
        style={{ paddingTop: "calc(var(--zaui-safe-area-inset-top, 24px) + 12px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="flex items-center space-x-1.5 bg-white/15 hover:bg-white/25 active:scale-95 rounded-full px-3.5 h-10 transition-all text-white cursor-pointer backdrop-blur-md border border-white/20 leading-none"
        >
          <svg
            className="block"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span className="text-xs font-semibold">Đóng</span>
        </button>

        {title && (
          <span className="text-white text-xs font-medium truncate max-w-[140px] px-2">
            {title}
          </span>
        )}

        {imgList.length > 1 && (
          <span className="text-white/80 text-xs font-semibold bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
            {activeIndex + 1} / {imgList.length}
          </span>
        )}
      </div>

      {/* Main Zoomable Image Area */}
      <div
        className="flex-1 relative flex items-center justify-center w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <ZoomableImageCanvas
          src={currentSrc}
          scale={scale}
          offset={offset}
          onScaleChange={handleScaleChange}
          onOffsetChange={setOffset}
          onSwipePrev={activeIndex > 0 ? () => goToSlide(activeIndex - 1) : undefined}
          onSwipeNext={
            activeIndex < imgList.length - 1 ? () => goToSlide(activeIndex + 1) : undefined
          }
        />

        {/* Nút chuyển ảnh Trái / Phải khi có nhiều ảnh */}
        {imgList.length > 1 && activeIndex > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToSlide(activeIndex - 1);
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 transition-all flex items-center justify-center text-white z-20 cursor-pointer backdrop-blur-sm"
          >
            <CustomIcon icon="zi-chevron-left" size={22} />
          </button>
        )}

        {imgList.length > 1 && activeIndex < imgList.length - 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToSlide(activeIndex + 1);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 active:scale-95 transition-all flex items-center justify-center text-white z-20 cursor-pointer backdrop-blur-sm"
          >
            <CustomIcon icon="zi-chevron-right" size={22} />
          </button>
        )}
      </div>

      {/* Bottom Controls: Zoom In/Out + Tải về / Mở liên kết */}
      <div
        className="w-full px-4 pt-2 pb-8 flex flex-wrap items-center justify-center gap-3 z-20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Thanh điều khiển Zoom (- / % / +) dùng tốt trên cả Máy tính và Điện thoại */}
        <div className="flex items-center bg-white/15 backdrop-blur-md rounded-full px-2 py-1 border border-white/20 space-x-1">
          <button
            type="button"
            aria-label="Thu nhỏ"
            onClick={() => handleScaleChange(scale - 0.5)}
            disabled={scale <= MIN_ZOOM}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-white/20 active:scale-90 disabled:opacity-40 transition-all cursor-pointer font-bold text-lg leading-none"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => handleScaleChange(MIN_ZOOM, { x: 0, y: 0 })}
            className="px-2.5 py-1 text-xs font-bold text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer min-w-[54px] text-center"
            title="Nhấn để đặt lại 100%"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            type="button"
            aria-label="Phóng to"
            onClick={() => handleScaleChange(scale + 0.5)}
            disabled={scale >= MAX_ZOOM}
            className="w-8 h-8 rounded-full flex items-center justify-center text-white hover:bg-white/20 active:scale-90 disabled:opacity-40 transition-all cursor-pointer font-bold text-lg leading-none"
          >
            +
          </button>
        </div>

        {allowDownload && onDownload && (
          <button
            type="button"
            onClick={() => onDownload(currentSrc, activeIndex)}
            className="flex items-center space-x-1.5 bg-white/15 hover:bg-white/25 active:scale-95 rounded-full px-4 h-10 transition-all text-white cursor-pointer backdrop-blur-md border border-white/20"
          >
            <Icon icon="zi-download" size={18} />
            <span className="text-xs font-semibold">Tải về</span>
          </button>
        )}

        {actionLabel && (onActionClick || onAction) && (
          <button
            type="button"
            onClick={handleAction}
            className="flex items-center space-x-1.5 bg-[#14502e] hover:bg-[#1b6b3e] active:scale-95 rounded-full px-4 h-10 transition-all text-white cursor-pointer border border-white/25 shadow-md"
          >
            <span className="text-xs font-semibold">{actionLabel}</span>
            <CustomIcon icon="zi-chevron-right" size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default ImageViewerModal;
