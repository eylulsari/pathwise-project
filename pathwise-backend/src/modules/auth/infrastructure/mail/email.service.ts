import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import {
  MailerPort,
  PasswordResetEmail,
  WelcomeEmail,
} from '../../domain/password-reset.port';

/**
 * Transactional email adapter backed by Resend.
 *
 * Delivery remains disabled until both RESEND_API_KEY and FROM_EMAIL are set,
 * making local/test environments safe by default.
 */
@Injectable()
export class EmailService implements MailerPort {
  private readonly logger = new Logger(EmailService.name);
  private readonly apiKey?: string;
  private readonly from?: string;
  private readonly resend?: Resend;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('RESEND_API_KEY')?.trim() || undefined;
    this.from = this.config.get<string>('FROM_EMAIL')?.trim() || undefined;
    if (this.apiKey && this.from) this.resend = new Resend(this.apiKey);
  }

  get configured(): boolean {
    return Boolean(this.resend && this.from);
  }

  async sendWelcome(email: WelcomeEmail): Promise<void> {
    await this.send({
      to: email.to,
      subject: 'Pathwise\'a hoş geldiniz',
      html: `<p>Merhaba ${this.escapeHtml(email.name)},</p><p>Pathwise\'a hoş geldiniz. İstanbul yolculuğunuzu planlamaya hazırsınız.</p>`,
    });
  }

  async sendPasswordReset(email: PasswordResetEmail): Promise<void> {
    const safeName = this.escapeHtml(email.name);
    const safeUrl = this.escapeHtml(email.resetUrl);
    await this.send({
      to: email.to,
      subject: 'Pathwise şifre sıfırlama bağlantınız',
      html: `<p>Merhaba ${safeName},</p><p>Şifrenizi sıfırlamak için <a href="${safeUrl}">bu bağlantıyı</a> kullanın.</p><p>Bağlantı ${email.expiresInMinutes} dakika geçerlidir. Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.</p>`,
    });
  }

  private async send(message: { to: string; subject: string; html: string }): Promise<void> {
    if (!this.resend || !this.from) {
      throw new Error('Email service is not configured');
    }

    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
      });
      if (error) {
        this.logger.error(`Resend rejected email to ${message.to}: ${error.message}`);
        throw new Error('Email delivery failed');
      }
    } catch (error) {
      if (error instanceof Error && error.message !== 'Email delivery failed') {
        this.logger.error(`Could not send email to ${message.to}: ${error.message}`);
      }
      throw error;
    }
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character]!);
  }
}
