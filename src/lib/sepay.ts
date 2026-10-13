import { SepayTransaction, SepayConfig } from '@/src/types';

/**
 * Generates a cryptographically secure 32-character API key for SePay webhook authentication.
 */
export function generateSepayApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'spk_';
  for (let i = 0; i < 28; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generates standard transfer content/memo using shop's prefix and order code.
 * Example: prefix "DUCK" + orderCode "VQ261012-101" -> "DUCK VQ261012-101"
 */
export function generateTransferMemo(prefix = 'DUCK', orderCode: string): string {
  const cleanPrefix = (prefix || 'DUCK').trim().toUpperCase();
  const cleanCode = (orderCode || '').trim().toUpperCase();
  return cleanPrefix ? `${cleanPrefix} ${cleanCode}` : cleanCode;
}

/**
 * Checks whether an incoming bank transfer content matches a given order code.
 * Handles variations with/without spaces, prefixes, accents, etc.
 */
export function matchTransferContent(content: string, prefix = 'DUCK', orderCode: string): boolean {
  if (!content || !orderCode) return false;

  const normalizedContent = content.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const normalizedOrderCode = orderCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const normalizedPrefix = (prefix || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  // Exact order code contained
  if (normalizedContent.includes(normalizedOrderCode)) {
    return true;
  }

  // Combined prefix + order code
  const combined = `${normalizedPrefix}${normalizedOrderCode}`;
  if (combined && normalizedContent.includes(combined)) {
    return true;
  }

  // Extract digits from order code if applicable (e.g. 101 from VQ261012-101)
  const numbersOnlyOrder = orderCode.replace(/\D/g, '');
  if (numbersOnlyOrder.length >= 3 && normalizedContent.includes(numbersOnlyOrder)) {
    return true;
  }

  return false;
}
