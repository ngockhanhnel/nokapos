export { UNIT_LABELS } from '@/src/types';

export function formatCurrency(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(val: number, decimals: number = 2): string {
  if (isNaN(val) || val === null || val === undefined) return '0';
  return new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: decimals,
  }).format(val);
}

export function formatInputCurrency(value: string | number): string {
  if (value === '' || value === null || value === undefined) return '';
  const numStr = value.toString().replace(/[^0-9]/g, '');
  if (!numStr) return '';
  const num = parseInt(numStr, 10);
  if (isNaN(num)) return '';
  return new Intl.NumberFormat('vi-VN').format(num);
}

export function parseInputCurrency(formatted: string): number {
  if (!formatted) return 0;
  const clean = formatted.toString().replace(/[^0-9]/g, '');
  return parseInt(clean, 10) || 0;
}

export function formatDateTime(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDate(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function generateOrderCode(): string {
  const now = new Date();
  const datePart = `${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `VQ${datePart}-${randomPart}`;
}

export function generateShiftCode(): string {
  const now = new Date();
  const datePart = `${now.getFullYear().toString().slice(-2)}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
  const randomPart = Math.floor(100 + Math.random() * 900);
  return `CA${datePart}-${randomPart}`;
}

export const VIETNAMESE_BANKS = [
  { code: 'ICB', name: 'VietinBank', shortName: 'VietinBank' },
  { code: 'VCB', name: 'Vietcombank', shortName: 'Vietcombank' },
  { code: 'BIDV', name: 'BIDV', shortName: 'BIDV' },
  { code: 'VBA', name: 'Agribank', shortName: 'Agribank' },
  { code: 'TCB', name: 'Techcombank', shortName: 'Techcombank' },
  { code: 'MB', name: 'MB Bank', shortName: 'MBBank' },
  { code: 'ACB', name: 'ACB', shortName: 'ACB' },
  { code: 'VPB', name: 'VPBank', shortName: 'VPBank' },
  { code: 'TPB', name: 'TPBank', shortName: 'TPBank' },
  { code: 'STB', name: 'Sacombank', shortName: 'Sacombank' },
  { code: 'HDB', name: 'HDBank', shortName: 'HDBank' },
  { code: 'VIB', name: 'VIB', shortName: 'VIB' },
  { code: 'SHB', name: 'SHB', shortName: 'SHB' },
  { code: 'MSB', name: 'MSB', shortName: 'MSB' },
  { code: 'OCB', name: 'OCB', shortName: 'OCB' },
  { code: 'LPB', name: 'LPBank', shortName: 'LPBank' },
];

export function getVietQRUrl(bankCode: string, accountNo: string, amount: number, memo: string): string {
  const cleanBank = bankCode.trim().toUpperCase();
  const cleanAcc = accountNo.trim();
  const cleanMemo = memo.trim();
  return `https://img.vietqr.io/image/${cleanBank}-${cleanAcc}-compact2.jpg?amount=${Math.round(amount)}&addInfo=${encodeURIComponent(cleanMemo)}`;
}
