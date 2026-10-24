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
    const shopsSnap = await getDocs(collection(db, 'shops'));
    const allLogs: any[] = [];

    for (const shopDoc of shopsSnap.docs) {
      const shopId = shopDoc.id;
      const shopName = shopDoc.data().name || 'Shop ' + shopId;
      try {
        const logsSnap = await getDocs(collection(db, 'shops', shopId, 'auditLogs'));
        logsSnap.forEach((d) => {
          const l = d.data();
          allLogs.push({
            id: d.id,
            shopId,
            shopName,
            action: l.action || 'Thao tác hệ thống',
            actorEmail: l.actorEmail || l.actorId || 'Hệ thống',
            details: l.details || '',
            timestamp: l.timestamp || new Date().toISOString(),
          });
        });
      } catch {
        // continue
      }
    }

    allLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.status(200).json({ success: true, count: allLogs.length, logs: allLogs.slice(0, 100) });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
