import { describe, expect, it } from 'vitest';
import { loginAdmin, isAdminAuthenticated } from '@/lib/adminAuth';

describe('admin auth helpers', () => {
  it('rejects legacy login and returns false for isAdminAuthenticated', () => {
    const result = loginAdmin('admin@foundarly.com', 'admin1234');

    expect(result.success).toBe(false);
    expect(isAdminAuthenticated()).toBe(false);
  });
});
