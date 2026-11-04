import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getConsultantAvatar } from '../src/utils/avatar.js';

describe('Production Bug Fixes Validation Suite', () => {
  it('1. Correctly provides gender-based fallback avatar when image_url is missing or null', () => {
    assert.equal(getConsultantAvatar(null, 'female'), '/female-default.jpg');
    assert.equal(getConsultantAvatar(null, 'male'), '/male-default.png');
    assert.equal(getConsultantAvatar('', 'female'), '/female-default.jpg');
    assert.equal(getConsultantAvatar('', undefined), '/male-default.png');
    assert.equal(
      getConsultantAvatar('https://storage.supabase.co/avatar.jpg', 'female'),
      'https://storage.supabase.co/avatar.jpg'
    );
  });

  it('2. Default site_logo_url points to crisp official vector logo', async () => {
    const { settingsService } = await import('../src/services/settings.js');
    const logoSetting = await settingsService.getBySetting('site_logo_url');
    assert.ok(logoSetting);
    assert.equal(logoSetting.setting_value, '/logo.svg');
  });

  it('3. Consultant role detection preserves consultant status and does not demote to client', async () => {
    const { getUserEffectiveRole, sanitizeUserRole } = await import('../src/lib/authorization.js');

    // A consultant profile must return 'consultant'
    const consultantUser = { id: 'user-cons-1', email: 'consultant@example.com' };
    const consultantProfile = { id: 'user-cons-1', role: 'consultant', full_name: 'Jane Doe', is_consultant: true };

    assert.equal(getUserEffectiveRole(consultantUser as any, consultantProfile as any), 'consultant');
    assert.equal(sanitizeUserRole(consultantUser as any, consultantProfile as any), 'consultant');

    // Client user returns 'client'
    const clientUser = { id: 'user-client-1', email: 'client@example.com' };
    const clientProfile = { id: 'user-client-1', role: 'client', full_name: 'John Client' };

    assert.equal(getUserEffectiveRole(clientUser as any, clientProfile as any), 'client');
  });
});
