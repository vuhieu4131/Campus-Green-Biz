import CustomIcon from '../components/custom-icon';
import React, { FC, useState, useEffect } from "react";
import { Box, Header, Page, Text, Spinner } from "zmp-ui";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, updateDoc } from "firebase/firestore";

const getNotificationStyle = (type: string) => {
  switch (type) {
    case "completed":
    case "success":
    case "post_approved_notification":
      return { icon: "zi-check-circle", iconColor: "text-green-600", bgColor: "bg-green-100" };
    case "shipping":
    case "delivering":
      return { icon: "zi-clock-1", iconColor: "text-blue-600", bgColor: "bg-blue-100" };
    case "confirmed":
    case "processing":
    case "post_warning_notification":
      return { icon: "zi-note", iconColor: "text-yellow-600", bgColor: "bg-yellow-100" };
    case "cancelled":
    case "post_rejected_notification":
    case "post_banned_notification":
    case "vip_reject_notification":
      return { icon: "zi-close-circle", iconColor: "text-red-600", bgColor: "bg-red-100" };
    default:
      return { icon: "zi-notif", iconColor: "text-[#14502e]", bgColor: "bg-green-50" };
  }
};

const NotificationPage: FC = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub1: (() => void) | undefined;
    let unsub2: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        let finalPhone = user.phoneNumber || user.email?.split('@')[0] || "";
        if (finalPhone.startsWith("+84")) {
          finalPhone = "0" + finalPhone.substring(3);
        }

        const q1 = query(collection(db, "notifications"), where("userId", "==", user.uid));
        const q2 = query(collection(db, "notifications"), where("userId", "==", finalPhone));

        unsub1 = onSnapshot(q1, (snap1) => {
          const list1 = snap1.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          unsub2 = onSnapshot(q2, (snap2) => {
            const list2 = snap2.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Merge & Deduplicate by ID
            const mergedMap = new Map();
            list1.forEach((n: any) => mergedMap.set(n.id, n));
            list2.forEach((n: any) => mergedMap.set(n.id, n));
            
            const sortedList = Array.from(mergedMap.values())
              .map((data: any) => {
                const dateObj = data.createdAt?.toDate ? data.createdAt.toDate() :
                               (data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000) : new Date(data.createdAt || Date.now()));
                
                const timeStr = dateObj ? `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')} ${String(dateObj.getDate()).padStart(2, '0')}/${String(dateObj.getMonth() + 1).padStart(2, '0')}` : "";
                
                return {
                  ...data,
                  dateObj,
                  time: timeStr
                };
              })
              .sort((a, b) => (b.dateObj?.getTime() || 0) - (a.dateObj?.getTime() || 0));
              
            setNotifications(sortedList);
            setLoading(false);

            // Tự động đánh dấu đã đọc khi xem
            const unreadNotifs = sortedList.filter((n: any) => !n.isRead);
            if (unreadNotifs.length > 0) {
              unreadNotifs.forEach(async (n: any) => {
                try {
                  await updateDoc(doc(db, "notifications", n.id), { isRead: true });
                } catch (e) {
                  console.error("Lỗi đánh dấu đã đọc:", e);
                }
              });
            }
          });
        });
      } else {
        setNotifications([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsub1) unsub1();
      if (unsub2) unsub2();
    };
  }, []);

  return (
    <Page className="bg-gray-50 flex flex-col h-screen">
      <Header title="Thông báo" showBackIcon={true} />
      
      <Box className="flex-1 overflow-y-auto hide-scroll bg-white">
        {loading ? (
          <Box className="flex justify-center items-center py-20">
            <Spinner />
          </Box>
        ) : notifications.length > 0 ? (
          <Box className="divide-y divide-gray-100">
            {notifications.map((item) => {
              const style = getNotificationStyle(item.type);
              return (
                <Box key={item.id} flex className="p-4 items-start space-x-3 hover:bg-gray-50 transition-colors">
                  <Box className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${style.bgColor}`}>
                    <CustomIcon icon={style.icon} className={style.iconColor} size={24} />
                  </Box>
                  <Box className="flex-1 min-w-0">
                    <Box flex justifyContent="space-between" className="items-start mb-1">
                      <Text bold size="small" className="text-gray-900 leading-snug">{item.title}</Text>
                      <Text size="xxxxSmall" className="text-gray-400 whitespace-nowrap ml-2 mt-0.5">{item.time}</Text>
                    </Box>
                    <Text size="xSmall" className="text-gray-600 leading-relaxed">{item.content}</Text>
                  </Box>
                </Box>
              );
            })}
          </Box>
        ) : (
          <Box className="flex flex-col justify-center items-center py-20 px-8 text-center">
            <Box className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <CustomIcon icon="zi-notif" className="text-gray-400" size={32} />
            </Box>
            <Text size="small" bold className="text-gray-700 mb-1">Không có thông báo nào</Text>
            <Text size="xSmall" className="text-gray-400">Bạn sẽ nhận được các cập nhật về đơn hàng và hoạt động hệ thống tại đây.</Text>
          </Box>
        )}
      </Box>
    </Page>
  );
};

export default NotificationPage;
