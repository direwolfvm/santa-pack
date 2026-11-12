/**
 * Sending email. Production uses Mailgun (the operator shared-services
 * pattern, as framblywish does); local development and the emulators print the
 * message instead.
 *
 * @typedef {{ to: string, subject: string, text: string, html: string }} Message
 * @typedef {(message: Message) => Promise<void>} SendMail
 */

/**
 * @param {{ apiKey: string, domain: string, from: string, apiBase: string, testMode: boolean }} settings
 * @param {typeof fetch} [fetchImpl]
 * @returns {SendMail}
 */
export function mailgunSender(settings, fetchImpl = fetch) {
  const url = `${settings.apiBase}/v3/${encodeURIComponent(settings.domain)}/messages`;
  const authorization = `Basic ${Buffer.from(`api:${settings.apiKey}`).toString('base64')}`;
  return async ({ to, subject, text, html }) => {
    const form = new URLSearchParams({
      from: settings.from,
      to,
      subject,
      text,
      html,
      // One-time sign-in links must not be rewritten or fetched by click tracking.
      'o:tracking': 'no',
      'o:tracking-clicks': 'no',
      'o:tracking-opens': 'no',
    });
    if (settings.testMode) form.set('o:testmode', 'yes');
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { Authorization: authorization },
      body: form,
      signal: AbortSignal.timeout(15_000),
    });
    // The status only: Mailgun's reply can echo the message.
    if (!response.ok) throw new Error(`Mailgun answered ${response.status}`);
  };
}

/**
 * For the emulators: nothing is sent, the message goes to the server log.
 * @type {SendMail}
 */
export async function logSender({ to, subject, text }) {
  console.log(`\n[email not sent] To: ${to}\nSubject: ${subject}\n\n${text}\n`);
}
