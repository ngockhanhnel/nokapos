import type { Request, Response } from 'express';
import { 
  cleanupOldTemporaryLogs, 
  expireTemporaryDiscountCodes, 
  generateEndOfDaySummaryReport, 
  runAllDailyCronTasks 
} from '../../../src/functions/cron.js';

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const adminEmail = req.headers['x-admin-email'];
  if (adminEmail !== 'ngockhanhsocial@gmail.com') {
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }

  const { taskId } = req.body || {};

  try {
    let taskResult;
    if (taskId === 'cron_cleanup') {
      taskResult = await cleanupOldTemporaryLogs(30);
    } else if (taskId === 'cron_discounts') {
      taskResult = await expireTemporaryDiscountCodes();
    } else if (taskId === 'cron_sales_summary') {
      taskResult = await generateEndOfDaySummaryReport();
    } else {
      const dailyAll = await runAllDailyCronTasks();
      taskResult = {
        taskName: 'runAllDailyCronTasks',
        executedAt: dailyAll.executedAt,
        status: 'SUCCESS',
        message: `Đã chạy thành công toàn bộ ${dailyAll.results.length} tác vụ Cronjob định kỳ.`,
      };
    }

    return res.status(200).json({
      success: true,
      result: {
        taskId,
        executedAt: taskResult.executedAt,
        status: taskResult.status,
        message: taskResult.message,
        details: taskResult.message,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
