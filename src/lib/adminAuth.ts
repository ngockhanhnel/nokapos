import { User } from 'firebase/auth';

/**
 * SuperAdmin Security Configuration
 * Strictly designates 'ngockhanhsocial@gmail.com' as the unique super admin account.
 */
export const SUPER_ADMIN_EMAIL = 'ngockhanhsocial@gmail.com';

/**
 * Checks whether the given authenticated user is authorized as the unique Super Admin.
 */
export function isSuperAdmin(user: User | null | undefined): boolean {
  if (!user || !user.email) {
    return false;
  }
  return user.email.trim().toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}
