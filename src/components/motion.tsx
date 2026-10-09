import React, { FC, useEffect, useRef, useState } from "react";

const MAIN_TABS_ORDER = ["/", "/store", "/create-post", "/profile"];

/**
 * Xác định hiệu ứng chuyển trang thông minh theo hướng điều hướng:
 * - Giữa 4 Tab chính: Trượt ngang nhẹ theo vị trí Tab (Trái <-> Phải)
 * - Đi sâu vào trang con (Drill-down): Push từ phải sang
 * - Quay lại từ trang con về Tab chính: Pop từ trái sang
 */
export function resolvePageTransitionClass(prevPath: string, nextPath: string): string {
  if (!prevPath || prevPath === nextPath) {
    return "page-enter-fade";
  }

  const prevTabIdx = MAIN_TABS_ORDER.indexOf(prevPath);
  const nextTabIdx = MAIN_TABS_ORDER.indexOf(nextPath);

  if (prevTabIdx !== -1 && nextTabIdx !== -1) {
    return nextTabIdx > prevTabIdx ? "page-enter-tab-right" : "page-enter-tab-left";
  }

  if (prevTabIdx !== -1 && nextTabIdx === -1) {
    return "page-enter-push";
  }

  if (prevTabIdx === -1 && nextTabIdx !== -1) {
    return "page-enter-pop";
  }

  const prevDepth = prevPath.split("/").filter(Boolean).length;
  const nextDepth = nextPath.split("/").filter(Boolean).length;

  return nextDepth >= prevDepth ? "page-enter-push" : "page-enter-pop";
}

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  delayMs?: number;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

/**
 * Component <Reveal> kế thừa từ Viettel Commerce 30nam (ContentInteractions.jsx):
 * Sử dụng IntersectionObserver để kích hoạt hiệu ứng hiện phần tử 1 lần duy nhất
 * khi lọt vào khung nhìn rồi ngắt observer ngay để tối ưu hiệu năng.
 */
export const Reveal: FC<RevealProps> = ({
  children,
  className = "",
  delayMs = 0,
  style,
  onClick,
}) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.06, rootMargin: "0px 0px -12px 0px" }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const mergedStyle: React.CSSProperties = {
    ...style,
    ...(delayMs > 0 ? { transitionDelay: `${delayMs}ms` } : {}),
  };

  return (
    <div
      ref={ref}
      style={mergedStyle}
      onClick={onClick}
      className={`reveal${visible ? " visible" : ""}${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
};

interface AnimatedCounterProps {
  target: number;
  durationMs?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  formatLocale?: boolean;
}

/**
 * Component <AnimatedCounter> kế thừa từ Viettel Commerce 30nam (ContentInteractions.jsx & site.js):
 * Đếm số mượt theo hàm bậc ba 1 - (1 - p)^3 trên requestAnimationFrame,
 * kết thúc với hiệu ứng nảy lò xo (.counter-pop).
 */
export const AnimatedCounter: FC<AnimatedCounterProps> = ({
  target,
  durationMs = 850,
  prefix = "",
  suffix = "",
  className = "",
  formatLocale = true,
}) => {
  const numericTarget = Number(target) || 0;
  const [displayValue, setDisplayValue] = useState<number>(numericTarget);
  const [popping, setPopping] = useState(false);
  const prevTargetRef = useRef<number>(0);

  useEffect(() => {
    const fromVal = prevTargetRef.current;
    const toVal = numericTarget;
    prevTargetRef.current = toVal;

    if (fromVal === toVal) {
      setDisplayValue(toVal);
      return;
    }

    let frameId: number;
    const startTime = performance.now();

    const step = (now: number) => {
      const progress = Math.min((now - startTime) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(fromVal + (toVal - fromVal) * eased);
      setDisplayValue(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      } else {
        setDisplayValue(toVal);
        setPopping(true);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [numericTarget, durationMs]);

  const formatted = formatLocale
    ? displayValue.toLocaleString("vi-VN")
    : String(displayValue);

  return (
    <span
      className={`${popping ? "counter-pop " : ""}${className}`.trim()}
      onAnimationEnd={() => setPopping(false)}
    >
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

/**
 * Nút nổi <BackToTop> kế thừa từ Viettel Commerce 30nam (site.css .backtop):
 * Tự động theo dõi cả window lẫn các vùng cuộn bên trong Zalo Mini App (capture scroll event).
 */
export const BackToTop: FC<{ currentPath: string }> = ({ currentPath }) => {
  const [visible, setVisible] = useState(false);
  const activeScrollerRef = useRef<HTMLElement | Window | null>(null);

  useEffect(() => {
    setVisible(false);
    activeScrollerRef.current = null;
  }, [currentPath]);

  useEffect(() => {
    const handleScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        if (target.scrollHeight - target.clientHeight > 200) {
          activeScrollerRef.current = target;
          setVisible(target.scrollTop > 420);
          return;
        }
      }
      const winScroll = window.scrollY || document.documentElement.scrollTop || 0;
      if (winScroll > 0) {
        activeScrollerRef.current = window;
        setVisible(winScroll > 420);
      }
    };

    document.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener("scroll", handleScroll, { capture: true } as EventListenerOptions);
    };
  }, []);

  const scrollToTop = () => {
    const scroller = activeScrollerRef.current;
    if (scroller && scroller !== window && scroller instanceof HTMLElement) {
      scroller.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      aria-label="Lên đầu trang"
      className={`cgb-backtop${visible ? " show" : ""}`}
      onClick={scrollToTop}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  );
};
