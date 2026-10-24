import type { Request, Response } from 'express';
import { cleanupOldTemporaryLogs } from '../../src/functions/cron.js';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const adminEmail = req.headers['x-admin-email'];
  if (adminEmail !== 'ngockhanhsocial@gmail.com') {
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }

  try {
    const result = await cleanupOldTemporaryLogs(30);
    return res.status(200).json({
      success: true,
      message: result.message,
      cleanedAuditLogsCount: result.details?.deletedLogsCount || 0,
      cleanedTempBuffersCount: result.details?.deletedHoldOrdersCount || 0,
      freedStorageKb: Math.round(((result.details?.deletedLogsCount || 0) * 1.2) + 15),
      timestamp: result.executedAt,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
