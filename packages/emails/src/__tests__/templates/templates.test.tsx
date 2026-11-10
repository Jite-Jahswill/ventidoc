import { describe, expect, it } from 'vitest';
import { renderTemplate } from '../../render';

describe('renderTemplate', () => {
  it('VerifyEmail renders HTML and text containing the verify link', async () => {
    const { subject, html, text } = await renderTemplate('VerifyEmail', {
      recipientName: 'Ada',
      verifyUrl: 'https://ventidoc.local/verify?token=abc123',
    });

    expect(subject).toBe('Verify your email address');
    expect(html).toContain('https://ventidoc.local/verify?token=abc123');
    expect(html).toContain('Ada');
    expect(text).toContain('https://ventidoc.local/verify?token=abc123');
  });

  it('PasswordReset renders HTML and text containing the reset link and expiry', async () => {
    const { subject, html, text } = await renderTemplate('PasswordReset', {
      recipientName: 'Ada',
      resetUrl: 'https://ventidoc.local/reset-password?token=abc123',
      expiresInMinutes: 15,
    });

    expect(subject).toBe('Reset your password');
    expect(html).toContain('https://ventidoc.local/reset-password?token=abc123');
    expect(text).toContain('https://ventidoc.local/reset-password?token=abc123');
    expect(text).toContain('15 minutes');
  });

  it('Welcome renders HTML and text containing the app link and branding', async () => {
    const { subject, html, text } = await renderTemplate('Welcome', {
      recipientName: 'Ada',
      appUrl: 'https://ventidoc.local/app',
      appName: 'Ventidoc',
    });

    expect(subject).toBe('Welcome to Ventidoc');
    expect(html).toContain('https://ventidoc.local/app');
    expect(html).toContain('Ada');
    expect(text).toContain('https://ventidoc.local/app');
  });

  it('BusinessInvite renders HTML and text containing the invite link, inviter and business name', async () => {
    const { subject, html, text } = await renderTemplate('BusinessInvite', {
      inviterName: 'Ada',
      businessName: 'Lagos Fashion Co',
      inviteUrl: 'https://ventidoc.local/invites/xyz',
      role: 'Shop manager',
    });

    expect(subject).toBe('Ada invited you to join Lagos Fashion Co');
    expect(html).toContain('https://ventidoc.local/invites/xyz');
    expect(html).toContain('Lagos Fashion Co');
    expect(html).toContain('Shop manager');
    expect(text).toContain('https://ventidoc.local/invites/xyz');
  });

  it('GenericNotification renders HTML and text containing the title, message and action link', async () => {
    const { subject, html, text } = await renderTemplate('GenericNotification', {
      title: 'Your weekly report is ready',
      message: 'Sales and inventory for the past 7 days are ready to view.',
      actionUrl: 'https://ventidoc.local/reports/42',
      actionLabel: 'View report',
    });

    expect(subject).toBe('Your weekly report is ready');
    expect(html).toContain('https://ventidoc.local/reports/42');
    expect(html).toContain('Sales and inventory');
    expect(text).toContain('Sales and inventory');
  });

  it('GenericNotification omits the action button when no actionUrl is given', async () => {
    const { html } = await renderTemplate('GenericNotification', {
      title: 'Heads up',
      message: 'Just an FYI, nothing to do.',
    });

    expect(html).not.toContain('href=');
  });

  it('every template falls back to Ventidoc default branding', async () => {
    const { html } = await renderTemplate('Welcome', {
      appUrl: 'https://ventidoc.local/app',
    });

    expect(html).toContain('Ventidoc');
    expect(html).toContain('support@ventidoc.local');
  });

  it('every template matches its rendered HTML snapshot', async () => {
    const verify = await renderTemplate('VerifyEmail', {
      verifyUrl: 'https://ventidoc.local/verify?token=snapshot',
    });
    const reset = await renderTemplate('PasswordReset', {
      resetUrl: 'https://ventidoc.local/reset-password?token=snapshot',
    });
    const welcome = await renderTemplate('Welcome', { appUrl: 'https://ventidoc.local/app' });
    const invite = await renderTemplate('BusinessInvite', {
      inviterName: 'Ada',
      businessName: 'Lagos Fashion Co',
      inviteUrl: 'https://ventidoc.local/invites/snapshot',
    });
    const notification = await renderTemplate('GenericNotification', {
      title: 'Snapshot title',
      message: 'Snapshot message.',
    });

    expect(verify.html).toMatchSnapshot('VerifyEmail.html');
    expect(reset.html).toMatchSnapshot('PasswordReset.html');
    expect(welcome.html).toMatchSnapshot('Welcome.html');
    expect(invite.html).toMatchSnapshot('BusinessInvite.html');
    expect(notification.html).toMatchSnapshot('GenericNotification.html');
  });
});
