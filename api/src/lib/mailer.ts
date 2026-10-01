/**
 * Transactional mailer — never logs recipient or body (HG-8).
 * Dev default: in-memory outbox (tests can assert). Production: Resend via API key.
 */
import { Resend } from "resend";
import { env } from "../env.js";

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

const outbox: MailMessage[] = [];

type Sink = (msg: MailMessage) => Promise<void>;

let sink: Sink = async (msg) => {
  outbox.push(msg);
  // HG-8: no email address / body in logs
  console.info(
    "mail_queued type_hint=%s subject_len=%s",
    msg.subject.slice(0, 24).replace(/\s+/g, "_"),
    msg.subject.length,
  );
};

/** Override for tests. */
export function setMailSink(fn: Sink): void {
  sink = fn;
}

export function drainMailOutbox(): MailMessage[] {
  return outbox.splice(0, outbox.length);
}

let resendClient: Resend | null = null;
function getResendClient(): Resend | null {
  if (resendClient) return resendClient;
  if (!env.resendApiKey) return null;
  resendClient = new Resend(env.resendApiKey);
  return resendClient;
}

export async function sendMail(msg: MailMessage): Promise<void> {
  const resend = getResendClient();
  if (resend) {
    try {
      const from = env.emailFrom;
      await resend.emails.send({
        from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
      });
      console.info("mail_resend_ok subject_len=%s", msg.subject.length);
      return;
    } catch (err) {
      console.warn("mail_resend_failed", err);
      // fall through to outbox sink
    }
  }
  // Fallback: in-memory outbox (dev) or SMTP webhook if configured
  if (env.smtpWebhookUrl) {
    try {
      await fetch(env.smtpWebhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          from: env.emailFrom,
          to: msg.to,
          subject: msg.subject,
          text: msg.text,
          html: msg.html,
        }),
      });
      console.info("mail_webhook_ok subject_len=%s", msg.subject.length);
      return;
    } catch {
      console.warn("mail_webhook_failed");
    }
  }
  await sink(msg);
}

export function verificationEmail(params: {
  to: string;
  verifyUrl: string;
}): MailMessage {
  return {
    to: params.to,
    subject: "Verify your JobAutomater email",
    text: `Verify your email: ${params.verifyUrl}\nThis link expires in 24 hours.`,
    html: `<p>Verify your email:</p><p><a href="${params.verifyUrl}">Confirm email</a></p><p>This link expires in 24 hours.</p>`,
  };
}

export function passwordResetEmail(params: {
  to: string;
  resetUrl: string;
}): MailMessage {
  return {
    to: params.to,
    subject: "Reset your JobAutomater password",
    text: `Reset your password: ${params.resetUrl}\nThis link expires in 1 hour. If you did not request this, ignore this email.`,
    html: `<p>Reset your password:</p><p><a href="${params.resetUrl}">Choose a new password</a></p><p>This link expires in 1 hour.</p>`,
  };
}