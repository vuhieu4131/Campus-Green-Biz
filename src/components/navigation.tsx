import { useVirtualKeyboardVisible } from "hooks";
import React, { FC, useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { MenuItem } from "types/menu";
import { BottomNavigation, Icon, Box } from "zmp-ui";
import { CartIcon } from "./cart-icon";
import { auth, db } from "../firebase";
import { AuthOverlay } from "../pages/auth";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";

const StoreIcon = ({ active }: { active?: boolean }) => {
  if (active) {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5.223 2.25c-.498 0-.974.198-1.325.55l-1.3 1.298A3.75 3.75 0 0 0 7.5 9.75c.627-.47 1.106-1.147 1.328-1.924.449.643 1.154 1.089 1.963 1.145.81-.056 1.514-.502 1.963-1.145.222.777.701 1.454 1.328 1.924a3.75 3.75 0 0 0 4.902-5.652l-1.3-1.299a1.875 1.875 0 0 0-1.325-.549H5.223Z" />
        <path fillRule="evenodd" d="M3 20.25v-8.755c1.42.674 3.08.673 4.5 0A5.25 5.25 0 0 0 12 12a5.25 5.25 0 0 0 4.5-.505v8.755a2.25 2.25 0 0 1-2.25 2.25H5.25a2.25 2.25 0 0 1-2.25-2.25Zm10.5-4.5a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75h3a.75.75 0 0 0 .75-.75v-3.75a.75.75 0 0 0-.75-.75h-3Z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
    </svg>
  );
};

const tabsKeys = ["/", "/store", "/create-post", "/notification", "/profile"];

export const NO_BOTTOM_NAVIGATION_PAGES = ["/search", "/category", "/result", "/create-post", "/cart"];

export const Navigation: FC = () => {
  const keyboardVisible = useVirtualKeyboardVisible();
  const navigate = useNavigate();
  const location = useLocation();
  const [showAuth, setShowAuth] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let unsub1: (() => void) | undefined;
    let unsub2: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        let finalPhone = user.phoneNumber || user.email?.split('@')[0] || "";
        if (finalPhone.startsWith("+84")) {
          finalPhone = "0" + finalPhone.substring(3);
        }

        const q1 = query(
          collection(db, "notifications"),
          where("userId", "==", user.uid),
          where("isRead", "==", false)
        );
        const q2 = query(
          collection(db, "notifications"),
          where("userId", "==", finalPhone),
          where("isRead", "==", false)
        );

        unsub1 = onSnapshot(q1, (snap1) => {
          const count1 = snap1.docs.length;
          
          unsub2 = onSnapshot(q2, (snap2) => {
            const count2 = snap2.docs.length;
            
            // Merge & count unique notifications by ID
            const uniqueIds = new Set();
            snap1.docs.forEach(doc => uniqueIds.add(doc.id));
            snap2.docs.forEach(doc => uniqueIds.add(doc.id));
            
            setUnreadCount(uniqueIds.size);
          });
        });
      } else {
        setUnreadCount(0);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsub1) unsub1();
      if (unsub2) unsub2();
    };
  }, []);

  const tabs: Record<string, MenuItem> = useMemo(() => ({
    "/": {
      label: "Trang chủ",
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>,
      activeIcon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8h5z" />
        </svg>
      ),
    },
    "/store": {
      label: "Cửa hàng",
      icon: <StoreIcon />,
      activeIcon: <StoreIcon active />,
    },
    "/create-post": {
      label: "ㅤ",
      icon: (
        <div className="relative w-8 h-8 mx-auto flex items-center justify-center">
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#14502e] text-white flex items-center justify-center z-50"
            style={{ width: '52px', height: '38px', borderRadius: '14px', marginTop: '2px' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </div>
        </div>
      ),
      activeIcon: (
        <div className="relative w-8 h-8 mx-auto flex items-center justify-center">
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#14502e] text-white flex items-center justify-center z-50 opacity-80"
            style={{ width: '52px', height: '38px', borderRadius: '14px', marginTop: '2px' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </div>
        </div>
      ),
    },
    "/notification": {
      label: "Thông báo",
      icon: (
        <div className="relative">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-2 min-w-[15px] h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center px-1 shadow-[0_1px_4px_rgba(0,0,0,0.2)]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      ),
      activeIcon: (
        <div className="relative">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-2 min-w-[15px] h-3.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center px-1 shadow-[0_1px_4px_rgba(0,0,0,0.2)]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      ),
    },
    "/profile": {
      label: "Cá nhân",
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
      activeIcon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
      ),
    },
  }), [unreadCount]);

  const noBottomNav = useMemo(() => {
    if (location.pathname.startsWith("/detail")) {
      return true;
    }
    return NO_BOTTOM_NAVIGATION_PAGES.includes(location.pathname);
  }, [location]);

  const handleTabChange = (path: string) => {
    if (path === "/create-post") {
      const currentUser = auth.currentUser;
      const isRealUser = currentUser && currentUser.email !== "guest@campus.com";
      if (!isRealUser) {
        setShowAuth(true);
        return;
      }
    }
    navigate(path);
  };

  if (noBottomNav || keyboardVisible) {
    return <></>;
  }

  return (
    <>
      <BottomNavigation
        id="footer"
        activeKey={location.pathname}
        onChange={handleTabChange}
        className="z-50"
      >
        {tabsKeys.map((path: string) => (
          <BottomNavigation.Item
            key={path}
            label={tabs[path].label}
            icon={tabs[path].icon}
            activeIcon={tabs[path].activeIcon}
          />
        ))}
      </BottomNavigation>
      <AuthOverlay visible={showAuth} onClose={() => setShowAuth(false)} />
    </>
  );
};
