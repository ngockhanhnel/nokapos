import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { formatCurrency, formatDateTime } from '../lib/formatters';

// Initialize Firebase App for Cloud Functions / Server background runner
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export interface CronExecutionResult {
  taskName: string;
  executedAt: string;
  status: 'SUCCESS' | 'FAILED';
  message: string;
  details?: Record<string, any>;
}

/**
 * 1. AUTOMATED DATA CLEANUP:
 * Scans all shops' audit logs and temporary hold orders.
 * Deletes audit logs older than specified daysToKeep (default: 30 days).
 */
export async function cleanupOldTemporaryLogs(daysToKeep = 30): Promise<CronExecutionResult> {
  const executedAt = new Date().toISOString();
  const cutoffTimestamp = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).getTime();
  let deletedLogsCount = 0;
  let deletedHoldOrdersCount = 0;

  try {
    const shopsSnap = await getDocs(collection(db, 'shops'));

    for (const shopDoc of shopsSnap.docs) {
      const shopId = shopDoc.id;

      // Clean old Audit Logs
      try {
        const logsSnap = await getDocs(collection(db, 'shops', shopId, 'auditLogs'));
        const batch = writeBatch(db);
        let batchCount = 0;

        for (const logDoc of logsSnap.docs) {
          const data = logDoc.data();
          const logTime = data.timestamp ? new Date(data.timestamp).getTime() : 0;
          if (logTime > 0 && logTime < cutoffTimestamp) {
            batch.delete(doc(db, 'shops', shopId, 'auditLogs', logDoc.id));
            deletedLogsCount++;
            batchCount++;
            if (batchCount >= 450) {
              await batch.commit();
              batchCount = 0;
            }
          }
        }
        if (batchCount > 0) {
          await batch.commit();
        }
      } catch (err) {
        console.warn(`[Cron Cleanup] Audit log clean notice for shop ${shopId}:`, err);
      }

      // Clean stale hold orders older than 24 hours
      try {
        const savedHold = localStorage?.getItem?.(`duckpos_hold_${shopId}`);
        if (savedHold) {
          const parsed = JSON.parse(savedHold);
          if (Array.isArray(parsed)) {
            const fresh = parsed.filter((item) => {
              const age = Date.now() - new Date(item.createdAt || 0).getTime();
              return age < 24 * 60 * 60 * 1000;
            });
            if (fresh.length !== parsed.length) {
              deletedHoldOrdersCount += parsed.length - fresh.length;
              localStorage.setItem(`duckpos_hold_${shopId}`, JSON.stringify(fresh));
            }
          }
        }
      } catch {
        // localStorage clean notice
      }
    }

    return {
      taskName: 'cleanupOldTemporaryLogs',
      executedAt,
      status: 'SUCCESS',
      message: `Đã dọn dẹp thành công ${deletedLogsCount} nhật ký thao tác cũ (> ${daysToKeep} ngày) và ${deletedHoldOrdersCount} đơn tạm quá hạn.`,
      details: { deletedLogsCount, deletedHoldOrdersCount, daysToKeep },
    };
  } catch (err: any) {
    console.error('[Cron Cleanup Error]:', err);
    return {
      taskName: 'cleanupOldTemporaryLogs',
      executedAt,
      status: 'FAILED',
      message: 'Lỗi dọn dẹp nhật ký tạm: ' + err.message,
    };
  }
}

/**
 * 2. EXPIRING TEMPORARY DISCOUNT CODES:
 * Scans store products or pre-orders and expires temporary discount codes or happy hour promos.
 */
export async function expireTemporaryDiscountCodes(): Promise<CronExecutionResult> {
  const executedAt = new Date().toISOString();
  let expiredCodesCount = 0;

  try {
    const shopsSnap = await getDocs(collection(db, 'shops'));
    const nowTimestamp = Date.now();

    for (const shopDoc of shopsSnap.docs) {
      const shopId = shopDoc.id;
      const shopData = shopDoc.data();
      const pricingConfig = shopData?.pricingConfig;

      // Check if happy hour discount schedule has expired
      if (pricingConfig?.happyHourEndDate) {
        const happyHourEnd = new Date(pricingConfig.happyHourEndDate).getTime();
        if (nowTimestamp >= happyHourEnd && pricingConfig.happyHourDiscountPercent > 0) {
          const shopRef = doc(db, 'shops', shopId);
          await updateDoc(shopRef, {
            'pricingConfig.happyHourDiscountPercent': 0,
            'pricingConfig.updatedAt': new Date().toISOString(),
          });
          expiredCodesCount++;
        }
      }
    }

    return {
      taskName: 'expireTemporaryDiscountCodes',
      executedAt,
      status: 'SUCCESS',
      message: `Đã tự động quét và thu hồi/hết hạn ${expiredCodesCount} mã giảm giá & chương trình khuyến mãi tạm thời.`,
      details: { expiredCodesCount },
    };
  } catch (err: any) {
    console.error('[Cron Expire Discounts Error]:', err);
    return {
      taskName: 'expireTemporaryDiscountCodes',
      executedAt,
      status: 'FAILED',
      message: 'Lỗi kiểm tra mã giảm giá hết hạn: ' + err.message,
    };
  }
}

/**
 * 3. PERIODIC END-OF-DAY SUMMARY REPORT FOR STORE OWNER:
 * Aggregates daily sales, computes cash vs transfer totals, top items, and pushes HTML report via Telegram.
 */
export async function generateEndOfDaySummaryReport(): Promise<CronExecutionResult> {
  const executedAt = new Date().toISOString();
  const todayYmd = executedAt.slice(0, 10);
  let reportsGeneratedCount = 0;
  let telegramSentCount = 0;

  try {
    const shopsSnap = await getDocs(collection(db, 'shops'));

    for (const shopDoc of shopsSnap.docs) {
      const shopId = shopDoc.id;
      const shopData = shopDoc.data();
      const shopName = shopData.name || 'DuckPOS Pro Store';

      try {
        const ordersSnap = await getDocs(collection(db, 'shops', shopId, 'orders'));
        const todayCompletedOrders: any[] = [];

        ordersSnap.forEach((d) => {
          const order = d.data();
          if (order.status === 'completed' && order.createdAt?.startsWith(todayYmd)) {
            todayCompletedOrders.push(order);
          }
        });

        const totalRevenue = todayCompletedOrders.reduce((sum, o) => sum + (Number(o.finalTotal) || 0), 0);
        const cashSales = todayCompletedOrders
          .filter((o) => o.paymentMethod === 'cash')
          .reduce((sum, o) => sum + (Number(o.finalTotal) || 0), 0);
        const transferSales = todayCompletedOrders
          .filter((o) => o.paymentMethod === 'transfer')
          .reduce((sum, o) => sum + (Number(o.finalTotal) || 0), 0);

        // Aggregate top selling item names
        const itemQtyMap = new Map<string, number>();
        todayCompletedOrders.forEach((o) => {
          if (Array.isArray(o.items)) {
            o.items.forEach((item: any) => {
              const name = item.name || 'Món ăn';
              const qty = Number(item.quantity) || 1;
              itemQtyMap.set(name, (itemQtyMap.get(name) || 0) + qty);
            });
          }
        });

        const topItems = Array.from(itemQtyMap.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, qty]) => `${name} (${qty})`);

        const summaryRecord = {
          date: todayYmd,
          shopId,
          shopName,
          totalRevenue,
          cashSales,
          transferSales,
          ordersCount: todayCompletedOrders.length,
          topItems,
          generatedAt: executedAt,
        };

        // Save report to Firestore collection
        const reportRef = doc(db, 'shops', shopId, 'dailyReports', todayYmd);
        await setDoc(reportRef, summaryRecord, { merge: true });
        reportsGeneratedCount++;

        // Send Telegram notification if enabled for shop
        if (shopData.telegramConfig?.enabled) {
          let botToken = shopData.telegramConfig.botToken;
          let chatId = shopData.telegramConfig.chatId;

          // Check isolated secrets subcollection for botToken
          try {
            const secSnap = await getDoc(doc(db, 'shops', shopId, 'secrets', 'config'));
            if (secSnap.exists()) {
              botToken = secSnap.data().telegramBotToken || botToken;
              chatId = secSnap.data().telegramChatId || chatId;
            }
          } catch {
            // fallback
          }

          if (botToken && chatId) {
            const topItemsText = topItems.length > 0
              ? topItems.map((t, idx) => `  ${idx + 1}. ${t}`).join('\n')
              : '  Chưa có dữ liệu chi tiết món';

            const msg = `📊 <b>BÁO CÁO TỔNG KẾT DOANH THU CUỐI NGÀY</b>
━━━━━━━━━━━━━━━━━━━━
🏪 <b>Quán:</b> ${shopName.toUpperCase()}
📅 <b>Ngày:</b> ${todayYmd}
⏰ <b>Thời gian chốt:</b> ${formatDateTime(executedAt)}

💰 <b>TỔNG DOANH THU NGÀY:</b> <b>${formatCurrency(totalRevenue)}</b>
📋 <b>Tổng số đơn chốt:</b> ${todayCompletedOrders.length} đơn
💵 <b>Tiền mặt thu:</b> ${formatCurrency(cashSales)}
💳 <b>Chuyển khoản VietQR/SePay:</b> ${formatCurrency(transferSales)}

🏆 <b>Món bán chạy nhất hôm nay:</b>
${topItemsText}

👉 <i>Báo cáo được tổng hợp và tự động gửi tới Chủ Quán bởi DuckPOS Pro Cron Engine.</i>
━━━━━━━━━━━━━━━━━━━━`;

            try {
              await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId.trim(),
                  text: msg,
                  parse_mode: 'HTML',
                }),
              });
              telegramSentCount++;
            } catch (tgErr) {
              console.warn(`[Cron Telegram Summary] Error sending to shop ${shopId}:`, tgErr);
            }
          }
        }
      } catch (shopErr) {
        console.warn(`[Cron Report Error] Failed for shop ${shopId}:`, shopErr);
      }
    }

    return {
      taskName: 'generateEndOfDaySummaryReport',
      executedAt,
      status: 'SUCCESS',
      message: `Đã khởi tạo ${reportsGeneratedCount} báo cáo tổng kết cuối ngày và gửi ${telegramSentCount} thông báo Telegram tới Chủ quán.`,
      details: { reportsGeneratedCount, telegramSentCount, todayYmd },
    };
  } catch (err: any) {
    console.error('[Cron Report Error]:', err);
    return {
      taskName: 'generateEndOfDaySummaryReport',
      executedAt,
      status: 'FAILED',
      message: 'Lỗi tổng hợp báo cáo cuối ngày: ' + err.message,
    };
  }
}

/**
 * 4. ALL IN ONE DAILY CRON TASK RUNNER:
 * Orchestrates all daily scheduled background jobs in order.
 */
export async function runAllDailyCronTasks(): Promise<{
  executedAt: string;
  results: CronExecutionResult[];
}> {
  const executedAt = new Date().toISOString();
  console.log(`[Firebase Cron] Starting automated daily task execution at ${executedAt}...`);

  const results: CronExecutionResult[] = [];

  // Step 1: Cleanup old temporary logs
  const resCleanup = await cleanupOldTemporaryLogs(30);
  results.push(resCleanup);

  // Step 2: Expire temporary discount codes
  const resDiscounts = await expireTemporaryDiscountCodes();
  results.push(resDiscounts);

  // Step 3: Generate end-of-day summary reports
  const resReport = await generateEndOfDaySummaryReport();
  results.push(resReport);

  console.log(`[Firebase Cron] Completed automated daily tasks with ${results.length} execution results.`);

  return {
    executedAt,
    results,
  };
}

/**
 * Firebase Cloud Functions 2nd Gen / Scheduled Cron Trigger Handlers (stub for Firebase deployment)
 */
export const firebaseScheduledCronHandlers = {
  // Runs every day at 02:00 AM UTC
  dailyCronJob: async () => {
    return await runAllDailyCronTasks();
  },
  // Runs every hour to check temporary discounts & reminders
  hourlyCronJob: async () => {
    return await expireTemporaryDiscountCodes();
  },
  // Runs every day at 22:00 (10 PM)
  endOfDayCronJob: async () => {
    return await generateEndOfDaySummaryReport();
  },
};
