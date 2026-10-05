import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

export type EmailMessage = { to: string; subject: string; text: string; html?: string };

export interface EmailService {
  send(message: EmailMessage): Promise<void>;
}

export class ConsoleEmailService implements EmailService {
  async send(message: EmailMessage) {
    console.info(`[email] to=${message.to} subject=${message.subject}\n${message.text}`);
  }
}

export class ResendEmailService implements EmailService {
  constructor(
    private apiKey: string,
    private from: string,
  ) {}

  async send(message: EmailMessage) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      }),
    });
    if (!response.ok) {
      throw new Error(`Email provider returned ${response.status}.`);
    }
  }
}

export class SmtpEmailService implements EmailService {
  constructor(
    private transport: Transporter,
    private from: string,
  ) {}

  async send(message: EmailMessage) {
    await this.transport.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}

let smtpTransport: Transporter | null = null;

function smtp() {
  const port = Number(process.env.SMTP_PORT) || 465;
  smtpTransport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    // 465 speaks TLS from the start. 587 upgrades with STARTTLS.
    secure: process.env.SMTP_SECURE
      ? ["1", "true"].includes(process.env.SMTP_SECURE)
      : port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
  return smtpTransport;
}

/** SMTP when SMTP_HOST is set, then Resend, then the server log. Each needs EMAIL_FROM. */
export function emailService(): EmailService {
  const from = process.env.EMAIL_FROM;
  if (process.env.SMTP_HOST && from) return new SmtpEmailService(smtp(), from);
  if (process.env.RESEND_API_KEY && from) {
    return new ResendEmailService(process.env.RESEND_API_KEY, from);
  }
  return new ConsoleEmailService();
}
