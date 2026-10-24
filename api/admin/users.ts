import type { Request, Response } from 'express';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export default async function handler(req: Request, res: Response) {
  const adminEmail = req.headers['x-admin-email'];
  if (adminEmail !== 'ngockhanhsocial@gmail.com') {
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    const shopsSnap = await getDocs(collection(db, 'shops'));

    const shopMap = new Map<string, string>();
    shopsSnap.forEach((d) => {
      const data = d.data();
      shopMap.set(d.id, data.name || 'Cửa hàng ' + d.id);
    });

    const userList: any[] = [];
    usersSnap.forEach((d) => {
      const u = d.data();
      userList.push({
        uid: d.id,
        email: u.email || 'Chưa cập nhật',
        displayName: u.displayName || 'Người dùng POS',
        currentShopId: u.currentShopId || '',
        shopName: shopMap.get(u.currentShopId) || 'Chưa chọn shop',
        createdAt: u.createdAt || new Date().toISOString(),
        status: 'active',
      });
    });

    return res.status(200).json({ success: true, count: userList.length, users: userList });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
