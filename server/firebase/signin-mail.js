/**
 * The sign-in emails (password reset, email confirmation), written and sent by
 * this app so they come from Santa Pack and their links open santapack.me.
 * Google's sign-in service still issues the one-time code; we move it onto our
 * own /action.html page. Ported from framblywish lib/signin-mail.ts.
 *
 * Google's own emails remain the fallback when mail is not set up: their
 * subject, wording and link address can't be changed for a tenant.
 */

/** @typedef {'resetPassword' | 'verifyEmail'} Mode */
/** @typedef {{ subject: string, intro: string, button: string, outro: string }} Copy */

/** @param {string} value */
const escapeHtml = (value) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * @param {{
 *   auth: Pick<import('firebase-admin/auth').TenantAwareAuth, 'generatePasswordResetLink' | 'generateEmailVerificationLink'>,
 *   send: import('./mail.js').SendMail,
 *   baseUrl: string,
 * }} deps
 */
export function createSigninMail({ auth, send, baseUrl }) {
  const site = new URL(baseUrl).host;

  /** Our page, carrying only the one-time code from Google's link. @param {Mode} mode @param {string} generated */
  function actionLink(mode, generated) {
    const code = new URL(generated).searchParams.get('oobCode');
    if (!code) throw new Error('No code in the generated link.');
    return `${baseUrl}/action.html?mode=${mode}&oobCode=${encodeURIComponent(code)}`;
  }

  /** @param {string} to @param {string} link @param {Copy} copy */
  async function deliver(to, link, copy) {
    const text =
      `${copy.intro}\n\n${copy.button}:\n${link}\n\n${copy.outro}\n\n` +
      `Santa Pack is the family gift exchange at ${baseUrl}\n`;
    const html = `<!doctype html>
<html lang="en"><body style="margin:0;padding:24px;background:#fffaf0;font-family:Arial,Helvetica,sans-serif;color:#25322c">
<div style="max-width:520px;margin:0 auto;background:#fffef9;border-radius:16px;border-top:8px solid #b4232f;padding:28px">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#16613f">&#9733; Merry mischief managed</p>
<h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:28px;color:#123b2b">Santa Pack</h1>
<p style="font-size:16px;line-height:1.5">${escapeHtml(copy.intro)}</p>
<p style="margin:24px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#b4232f;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px">${escapeHtml(copy.button)}</a></p>
<p style="font-size:13px;line-height:1.5;color:#65746c">If the button doesn't work, paste this address into your browser:<br><span style="word-break:break-all">${escapeHtml(link)}</span></p>
<p style="font-size:14px;line-height:1.5">${escapeHtml(copy.outro)}</p>
<hr style="border:none;border-top:1px solid #d9dfd8;margin:22px 0">
<p style="margin:0;font-size:12px;color:#65746c">Santa Pack is the family gift exchange at <a href="${escapeHtml(baseUrl)}" style="color:#16613f">${escapeHtml(site)}</a>. This link only goes to ${escapeHtml(site)}.</p>
</div></body></html>`;
    await send({ to, subject: copy.subject, text, html });
  }

  return {
    /**
     * Never says whether the address has an account: an unknown address
     * quietly sends nothing.
     * @param {string} email
     */
    async passwordReset(email) {
      let generated;
      try {
        generated = await auth.generatePasswordResetLink(email);
      } catch (error) {
        const code = /** @type {{ code?: string }} */ (error)?.code ?? 'unknown';
        if (!/user-not-found|email-not-found/.test(code)) console.error('Password reset link failed:', code);
        return;
      }
      await deliver(email, actionLink('resetPassword', generated), {
        subject: 'Reset your Santa Pack password',
        intro:
          `Someone asked to reset the password for the Santa Pack account that uses ${email}. ` +
          'Choose a new one with the button below. The link works once and expires in an hour.',
        button: 'Choose a new password',
        outro: "If that wasn't you, ignore this email and your password stays the same.",
      });
    },

    /** @param {string} email @param {string} name */
    async verification(email, name) {
      const generated = await auth.generateEmailVerificationLink(email);
      await deliver(email, actionLink('verifyEmail', generated), {
        subject: 'Confirm your email for Santa Pack',
        intro:
          `Hello${name ? ` ${name}` : ''}, and welcome to Santa Pack, the family gift exchange. ` +
          'Confirm that this address is yours to finish setting up your account.',
        button: 'Confirm my email',
        outro: "If you didn't sign up, ignore this email.",
      });
    },
  };
}

/** @typedef {ReturnType<typeof createSigninMail>} SigninMail */
