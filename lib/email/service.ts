import "server-only";

export type EmailMessage = { to: string; subject: string; text: string };

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
      }),
    });
    if (!response.ok) {
      throw new Error(`Email provider returned ${response.status}.`);
    }
  }
}

export function emailService() {
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    return new ResendEmailService(process.env.RESEND_API_KEY, process.env.EMAIL_FROM);
  }
  return new ConsoleEmailService();
}
