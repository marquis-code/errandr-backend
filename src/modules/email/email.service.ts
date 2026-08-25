import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Resend } from 'resend';
import { SystemSetting } from '../admin/schemas/system-setting.schema';
import { User } from '../users/schemas/user.schema';
import { Vendor } from '../vendors/schemas/vendor.schema';
import { NotificationsService } from '../notifications/notifications.service';
export interface EmailTemplateOptions {
  preheader?: string;
  badge?: { text: string; color: 'orange' | 'blue' | 'green' | 'purple' };
  title: string;
  subtitle: string;
  content: string;
}

@Injectable()
export class EmailService {
  private resend: Resend | null;
  private fromEmail = '"Erranders" <notifications@erranders.org>';
  private primaryColor = '#FF5C1A';
  private logoUrl = 'https://res.cloudinary.com/marquis/image/upload/v1784062203/logo-light_pyjwmn-removebg-preview_y3jvvg.png';

  constructor(
    private configService: ConfigService,
    @InjectModel(SystemSetting.name) private readonly settingModel: Model<SystemSetting>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Vendor.name) private readonly vendorModel: Model<Vendor>,
    private notificationsService: NotificationsService,
  ) {
    let apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey) {
      apiKey = apiKey.replace(/['"]+/g, '');
      this.resend = new Resend(apiKey);
    } else {
      this.resend = null;
    }

    let from = this.configService.get<string>('EMAIL_FROM') || this.fromEmail;
    this.fromEmail = from.replace(/['"]+/g, '');
  }

  async sendEmail(to: string, subject: string, html: string, attachments?: any[]) {
    console.log(`\x1b[35m[EMAIL_AGENT]\x1b[0m 🚀 Triggering email to: \x1b[36m${to}\x1b[0m`);
    console.log(`\x1b[35m[EMAIL_AGENT]\x1b[0m 📎 Subject: \x1b[33m${subject}\x1b[0m`);

    const communicationsSetting = await this.settingModel.findOne({ key: 'communications' }).exec();
    const emailsEnabled = communicationsSetting?.value?.emailsEnabled ?? true;

    if (!emailsEnabled) {
      console.warn(`\x1b[33m[EMAIL_AGENT] 🛑 Emails are globally disabled via admin settings. Skipping delivery.\x1b[0m`);
      return { message: 'Emails disabled via admin settings' };
    }

    const enableEmails = this.configService.get<string>('ENABLE_EMAILS');
    if (enableEmails === 'false') {
      console.warn(`\x1b[33m[EMAIL_AGENT] 🛑 ENABLE_EMAILS is set to false. Skipping real delivery.\x1b[0m`);
      return { message: 'Emails disabled via .env' };
    }

    if (!this.resend) {
      console.warn(`\x1b[31m[EMAIL_AGENT] ❌ RESEND_API_KEY is missing! Skipping real delivery, but trigger was SUCCESSFUL.\x1b[0m`);
      return { message: 'Development mode: Email logged to console' };
    }

    try {
      if (!to || !to.includes('@')) {
        console.error(`\x1b[31m[EMAIL_AGENT] ❌ Invalid recipient address: ${to}\x1b[0m`);
        return { error: 'Invalid recipient address' };
      }

      const payload: any = {
        from: this.fromEmail,
        to: Array.isArray(to) ? to : [to],
        subject,
        html: html,
        replyTo: 'hello@erranders.org',
      };
      
      if (attachments && attachments.length > 0) {
        payload.attachments = attachments;
      }

      const { data, error } = await this.resend.emails.send(payload);

      if (error) {
        console.error(`\x1b[31m[EMAIL_AGENT] ❌ Delivery Error: ${error.message}\x1b[0m`);
        // Gracefully handle quota errors without crashing the server
        return { success: false, error: error.message };
      }

      console.log(`\x1b[32m[EMAIL_AGENT] ✅ Email delivered successfully! ID: ${data?.id}\x1b[0m`);
      
      // Fire and forget companion push notification
      this.sendCompanionPushNotification(to, subject, html).catch(err => {
         console.error(`\x1b[33m[EMAIL_AGENT] ⚠️ Failed to send companion push to ${to}: ${err.message}\x1b[0m`);
      });

      return data;
    } catch (err: any) {
      console.error(`\x1b[31m[EMAIL_AGENT] ❌ Fatal Error: ${err.message}\x1b[0m`);
      // Return gracefully instead of throwing InternalServerErrorException
      return { success: false, error: err.message };
    }
  }

  private async sendCompanionPushNotification(email: string, title: string, html: string) {
    try {
      const user = await this.userModel.findOne({ email: email.toLowerCase() });
      if (!user) return;

      // Extract subtitle from HTML to use as the push notification body
      let body = "Tap to view details.";
      const subtitleMatch = html.match(/<p class="subtitle"[^>]*>(.*?)<\/p>/);
      if (subtitleMatch && subtitleMatch[1]) {
        body = subtitleMatch[1].replace(/<[^>]*>?/gm, ''); // strip HTML tags
      }

      const payload = { title, body };

      // Send to User (Student/Dispatcher App)
      if (user.fcmToken) {
        await this.notificationsService.sendPushNotification(user.fcmToken, payload);
      }

      // Check if user is a Vendor (Vendor App)
      const vendor = await this.vendorModel.findOne({ owner: user._id });
      if (vendor && vendor.fcmToken && vendor.fcmToken !== user.fcmToken) {
        await this.notificationsService.sendPushNotification(vendor.fcmToken, payload);
      }
    } catch (e) {
      console.error(`[EMAIL_AGENT] Companion push error:`, e);
    }
  }

  // ─── DESIGN SYSTEM ───────────────────────────────────────────────

  private getBaseStyles() {
    return `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        .wrapper { width: 100%; padding: 40px 0; background-color: #f4f4f5; }
        .header-logo { text-align: center; margin-bottom: 24px; margin-top: 24px; }
        .header-logo img { height: 40px; }
        .container { max-width: 520px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        
        .content-header { background-color: #171721; padding: 40px 32px; color: #ffffff; }
        .content-body { padding: 32px; background-color: #ffffff; color: #3f3f46; text-align: center; }
        
        .badge { display: inline-block; padding: 6px 14px; border-radius: 20px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px; }
        .badge-orange { background-color: rgba(255, 92, 26, 0.15); border: 1px solid rgba(255, 92, 26, 0.3); color: #FF5C1A; }
        .badge-blue { background-color: rgba(37, 99, 235, 0.15); border: 1px solid rgba(37, 99, 235, 0.3); color: #60A5FA; }
        .badge-green { background-color: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #34D399; }
        .badge-purple { background-color: rgba(124, 58, 237, 0.15); border: 1px solid rgba(124, 58, 237, 0.3); color: #A78BFA; }
        
        h1.title { font-size: 28px; font-weight: 800; line-height: 1.2; margin: 0 0 12px; color: #ffffff; letter-spacing: -0.5px; }
        p.subtitle { font-size: 14px; color: #a1a1aa; line-height: 1.6; margin: 0; font-weight: 500; }
        
        .ecosystem { background-color: #ffffff; padding: 40px 32px; border-top: 1px solid #f4f4f5; }
        .ecosystem-title { font-size: 11px; font-weight: 800; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 6px; }
        .ecosystem-subtitle { font-size: 13px; color: #71717a; margin: 0 0 24px; font-weight: 500; }
        
        .footer { padding: 40px 32px; text-align: center; background-color: #ffffff; color: #71717a; border-top: 1px solid #f4f4f5; }
        .footer-logo { display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px; }
        .footer-logo img { height: 24px; }
        .footer-tagline { color: #171721; font-weight: 700; font-size: 15px; margin: 0 0 8px; }
        .footer-desc { margin: 0 0 24px; line-height: 1.6; font-size: 13px; max-width: 400px; margin-left: auto; margin-right: auto; }
        .footer-links { margin-bottom: 24px; }
        .footer-links a { color: #FF5C1A; text-decoration: none; font-size: 13px; margin: 0 12px; font-weight: 600; }
        .footer-copy { margin: 0; font-size: 11px; color: #a1a1aa; }
        
        .outer-footer { text-align: center; margin-top: 24px; color: #a1a1aa; font-size: 11px; font-weight: 500; }
        
        .btn { display: inline-block; padding: 12px 28px; background-color: #FF5C1A; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 13px; text-align: center; transition: all 0.2s; border: none; cursor: pointer; }
        .btn-light { background-color: #f4f4f5; color: #3f3f46 !important; border: 1px solid #e4e4e7; }
        .btn-green { background-color: #059669; }
        .btn-outline { background-color: transparent; border: 1px solid #e4e4e7; color: #3f3f46 !important; }
        
        .card { background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 12px; padding: 24px; margin: 0 0 20px; text-align: center; }
        .card-value { font-size: 28px; font-weight: 800; margin: 8px 0 16px; color: #27272a; }
        .card-label { font-size: 10px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px; margin: 0; }
        
        .data-table { width: 100%; border-collapse: collapse; text-align: left; }
        .data-table td { padding: 12px 0; font-size: 13px; border-bottom: 1px solid #f4f4f5; }
        .data-table tr:last-child td { border-bottom: none; }
        .data-table .label { color: #71717a; font-weight: 500; }
        .data-table .value { font-weight: 600; color: #3f3f46; text-align: right; }
        .data-table .value-highlight { font-weight: 700; color: #FF5C1A; text-align: right; }
        
        /* OTP specific */
        .otp-container { display: flex; justify-content: center; gap: 8px; margin: 32px 0; }
        .otp-box { width: 48px; height: 56px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 800; color: #27272a; border: 1px solid #e4e4e7; border-radius: 8px; background: #fafafa; }
        .otp-box.highlight { border-color: #FF5C1A; color: #FF5C1A; background: #FFF7ED; }
        .otp-warning { font-size: 12px; color: #a1a1aa; background: #fafafa; padding: 12px; border-radius: 8px; margin: 0; display: flex; align-items: center; justify-content: center; gap: 8px; }

        @media only screen and (max-width: 520px) {
          .wrapper { padding: 0; }
          .container { border-radius: 0; }
          .content-header { padding: 32px 20px; }
          .content-body { padding: 24px 20px; }
          .ecosystem { padding: 32px 20px; }
          .footer { padding: 32px 20px; }
          .btn { display: block !important; width: 100% !important; box-sizing: border-box !important; }
          .otp-box { width: 40px; height: 48px; font-size: 20px; }
        }
      </style>
    `;
  }

  private ecosystemBanner() {
    return `
      <div class="ecosystem">
        <p class="ecosystem-title">The Erranders Ecosystem</p>
        <p class="ecosystem-subtitle">Three ways to be part of something bigger on campus.</p>
        
        <table style="width: 100%; border-collapse: separate; border-spacing: 0 12px;">
          <!-- Order Card -->
          <tr>
            <td style="border: 1px solid #e4e4e7; border-radius: 12px; padding: 16px; background: #ffffff;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="width: 40px; vertical-align: top;">
                    <div style="width: 32px; height: 32px; background: #171721; border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">🛍️</div>
                  </td>
                  <td style="padding-left: 12px; vertical-align: top;">
                    <p style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: #27272a;">Order on Erranders</p>
                    <p style="margin: 0; font-size: 12px; color: #71717a; line-height: 1.4;">Food, groceries & essentials delivered fast to your door.</p>
                  </td>
                  <td style="width: 100px; text-align: right; vertical-align: middle;">
                    <a href="https://www.erranders.org" class="btn" style="padding: 8px 16px; font-size: 11px;">Order Now</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Sell Card -->
          <tr>
            <td style="border: 1px solid #e4e4e7; border-radius: 12px; padding: 16px; background: #ffffff;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="width: 40px; vertical-align: top;">
                    <div style="width: 32px; height: 32px; background: #171721; border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">🏪</div>
                  </td>
                  <td style="padding-left: 12px; vertical-align: top;">
                    <p style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: #27272a;">Sell on Erranders</p>
                    <p style="margin: 0; font-size: 12px; color: #71717a; line-height: 1.4;">List your products and reach thousands of campus buyers.</p>
                  </td>
                  <td style="width: 100px; text-align: right; vertical-align: middle;">
                    <a href="https://vendor.erranders.org" class="btn btn-outline" style="padding: 8px 16px; font-size: 11px; background: transparent; color: #27272a !important;">Start Selling</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Dispatch Card -->
          <tr>
            <td style="border: 1px solid #FFEDD5; border-radius: 12px; padding: 16px; background: #FFF7ED;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="width: 40px; vertical-align: top;">
                    <div style="width: 32px; height: 32px; background: #EA580C; border-radius: 8px; text-align: center; line-height: 32px; font-size: 16px;">🛵</div>
                  </td>
                  <td style="padding-left: 12px; vertical-align: top;">
                    <p style="margin: 0 0 4px; font-size: 13px; font-weight: 700; color: #27272a;">Become a Dispatch Rider <span style="background: #FF5C1A; color: #ffffff; padding: 2px 6px; border-radius: 4px; font-size: 9px; margin-left: 4px; vertical-align: middle;">EARN</span></p>
                    <p style="margin: 0; font-size: 12px; color: #9A3412; line-height: 1.4;">Deliver orders & happiness to people across campus.</p>
                  </td>
                  <td style="width: 100px; text-align: right; vertical-align: middle;">
                    <a href="https://dispatch.erranders.org" class="btn" style="padding: 8px 16px; font-size: 11px;">Join Fleet</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;
  }

  private getEcosystemFooter() {
    return `
      ${this.ecosystemBanner()}
      <div class="footer">
        <div class="footer-logo">
          <img src="${this.logoUrl}" alt="Erranders">
        </div>
        <p class="footer-tagline">Campus life, elevated.</p>
        <p class="footer-desc">Seamless delivery, smart commerce, and real opportunities for students across Africa.</p>
        <div class="footer-links">
          <a href="https://erranders.org">Website</a>
          <a href="https://www.erranders.org">Order</a>
          <a href="https://vendor.erranders.org">Vendors</a>
        </div>
        <p class="footer-copy">© ${new Date().getFullYear()} Erranders Ltd. Lagos, Nigeria.</p>
      </div>
    `;
  }

  private wrap(options: EmailTemplateOptions) {
    const badgeHtml = options.badge ? `<div class="badge badge-${options.badge.color}">${options.badge.text}</div>` : '';
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          ${this.getBaseStyles()}
        </head>
        <body>
          <div class="wrapper">
            <div style="display: none; max-height: 0px; overflow: hidden; opacity: 0;">${options.preheader || ''}</div>
            
            <div class="header-logo">
              <img src="${this.logoUrl}" alt="Erranders">
            </div>

            <div class="container">
              <!-- HEADER -->
              <div class="content-header">
                ${badgeHtml}
                <h1 class="title">${options.title}</h1>
                <p class="subtitle">${options.subtitle}</p>
              </div>

              <!-- CONTENT BODY -->
              <div class="content-body">
                ${options.content}
              </div>

              <!-- ECOSYSTEM -->
              ${this.ecosystemBanner()}

              <!-- FOOTER -->
              <div class="footer">
                <div class="footer-logo">
                  <img src="${this.logoUrl}" alt="Erranders">
                </div>
                <p class="footer-tagline">Campus life, elevated.</p>
                <p class="footer-desc">Seamless delivery, smart commerce, and real opportunities for students across Africa.</p>
                <div class="footer-links">
                  <a href="https://erranders.org">Website</a>
                  <a href="https://www.erranders.org">Order</a>
                  <a href="https://vendor.erranders.org">Vendors</a>
                </div>
                <p class="footer-copy">© ${new Date().getFullYear()} Erranders Ltd. Lagos, Nigeria.</p>
              </div>

            </div>

            <div class="outer-footer">
              This is an automated message. Please do not reply.
            </div>
          </div>
        </body>
      </html>
    `;
  }

  // ─── OTP & AUTH ──────────────────────────────────────────────────

  async sendAuthOTP(to: string, otp: string) { return this.sendVerificationOTP(to, otp); }

  async sendSignupOTP(to: string, firstName: string, otp: string) {
    return this.sendVerificationOTP(to, otp);
  }

  private getOtpBoxes(otp: string) {
    let boxes = '';
    for (let i = 0; i < otp.length; i++) {
      boxes += `<div class="otp-box ${i >= 3 ? 'highlight' : ''}">${otp[i]}</div>`;
    }
    return `<div class="otp-container">${boxes}</div>`;
  }

  async sendVerificationOTP(to: string, otp: string) {
    const html = this.wrap({
      preheader: `Your Erranders code: ${otp}`,
      badge: { text: 'EMAIL VERIFICATION', color: 'orange' },
      title: 'Verify your email address',
      subtitle: 'Use the code below to complete your verification. It expires in <b>10 minutes</b>.',
      content: `
        <p style="text-align: left; font-size: 10px; font-weight: 700; color: #a1a1aa; letter-spacing: 1px; margin: 0; text-transform: uppercase;">YOUR ONE-TIME CODE</p>
        ${this.getOtpBoxes(otp)}
        <p class="otp-warning">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          Didn't request this? You can safely ignore this email.
        </p>
      `
    });
    return this.sendEmail(to, `${otp} is your verification code`, html);
  }

  async sendPasswordResetOTP(to: string, otp: string) {
    const html = this.wrap({
      preheader: `Reset code: ${otp}`,
      badge: { text: 'PASSWORD RESET', color: 'blue' },
      title: 'Reset your password',
      subtitle: 'Enter this code to set a new password. If you didn\'t request this, your account is safe.',
      content: `
        <p style="text-align: left; font-size: 10px; font-weight: 700; color: #a1a1aa; letter-spacing: 1px; margin: 0; text-transform: uppercase;">RESET CODE</p>
        ${this.getOtpBoxes(otp)}
        <p class="otp-warning">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          Your credentials remain secure if you didn't request this.
        </p>
      `
    });
    return this.sendEmail(to, `${otp} — Reset Your Password`, html);
  }

  // ─── WELCOME EMAILS ─────────────────────────────────────────────

  async sendWelcomeEmail(to: string, firstName: string) {
    const html = this.wrap({
      preheader: `Welcome to Erranders, ${firstName}!`,
      badge: { text: 'WELCOME 🎉', color: 'orange' },
      title: `Hey ${firstName}, you're in.`,
      subtitle: 'Erranders is your campus shortcut — food, essentials, and custom errands, delivered fast.',
      content: `
        <div class="card" style="text-align: left;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; font-size: 14px; color: #3f3f46; border-bottom: 1px solid #f4f4f5;">🍔 <b>Campus Bites</b></td>
              <td style="padding: 10px 0; font-size: 13px; color: #71717a; text-align: right; border-bottom: 1px solid #f4f4f5;">Best spots, fast delivery</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-size: 14px; color: #3f3f46; border-bottom: 1px solid #f4f4f5;">🚲 <b>Quick Errands</b></td>
              <td style="padding: 10px 0; font-size: 13px; color: #71717a; text-align: right; border-bottom: 1px solid #f4f4f5;">Printouts, groceries, anything</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; font-size: 14px; color: #3f3f46;">💰 <b>Wallet</b></td>
              <td style="padding: 10px 0; font-size: 13px; color: #71717a; text-align: right;">Fund & pay in one tap</td>
            </tr>
          </table>
        </div>
        <div style="text-align: center;">
          <a href="https://www.erranders.org" class="btn">Start Your First Order</a>
        </div>
      `
    });
    return this.sendEmail(to, `Welcome to Erranders, ${firstName}! 🚀`, html);
  }

  async sendVendorWelcome(to: string, firstName: string, storeName: string) {
    const html = this.wrap({
      preheader: `${storeName} is live on Erranders!`,
      badge: { text: 'PARTNER ACTIVE', color: 'green' },
      title: `Welcome, ${firstName}.`,
      subtitle: `<b>${storeName}</b> is live on Erranders. Thousands of students are ready to discover your products.`,
      content: `
        <div class="card" style="background: #f0fdf4; border-color: #d1fae5; text-align: left;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; font-size: 14px; color: #065f46;">📦 Add your products & set prices</td></tr>
            <tr><td style="padding: 8px 0; font-size: 14px; color: #065f46;">⏰ Set your operating hours</td></tr>
            <tr><td style="padding: 8px 0; font-size: 14px; color: #065f46;">📊 Track orders & earnings live</td></tr>
          </table>
        </div>
        <div style="text-align: center;">
          <a href="https://vendor.erranders.org" class="btn btn-green">Manage My Store</a>
        </div>
      `
    });
    return this.sendEmail(to, `Welcome to Erranders Vendors, ${firstName}!`, html);
  }

  // ─── ORDERS & PAYMENTS ──────────────────────────────────────────

  async sendOrderConfirmation(to: string, order: any) {
    const itemsHtml = order.items?.map((item: any) => `
      <tr>
        <td class="label" style="font-weight: 500; color: #3f3f46;">${item.name} <span style="color:#a1a1aa">× ${item.quantity}</span></td>
        <td class="value">₦${(item.price * item.quantity).toLocaleString()}</td>
      </tr>
    `).join('') || '';

    const customerName = (order.customer && order.customer.firstName) ? order.customer.firstName : 'Student';
    const securityPin = order.deliveryPin || 'N/A';

    const html = this.wrap({
      preheader: `Payment confirmed for Order #${order.orderNumber}!`,
      badge: { text: 'PAYMENT CONFIRMED', color: 'green' },
      title: `Thank you for your order, ${customerName}!`,
      subtitle: `We've received your payment for order <b>#${order.orderNumber}</b>. The vendor is preparing it right now!`,
      content: `
        <div class="card" style="background: #FFF4F0; text-align: center; border-color: #ffedd5; margin-bottom: 24px;">
          <p class="card-label" style="color: #EA580C; margin-bottom: 8px;">Your Delivery Security PIN</p>
          <p style="font-size: 32px; font-weight: 800; color: #FF5C1A; letter-spacing: 4px; margin: 0;">${securityPin}</p>
          <p style="font-size: 13px; color: #9a3412; margin: 12px 0 0;">Please provide this PIN to your Errander upon delivery. Keep it safe!</p>
        </div>

        <div class="card" style="text-align: left;">
          <p class="card-label" style="margin-bottom: 12px;">Order Details</p>
          <table class="data-table">
            ${itemsHtml}
            <tr>
              <td style="padding: 16px 0 0; font-size: 14px; font-weight: 600; color: #27272a; border-top: 1px solid #e4e4e7; margin-top: 8px;">Total Paid</td>
              <td style="padding: 16px 0 0; font-size: 16px; font-weight: 700; color: #10B981; text-align: right; border-top: 1px solid #e4e4e7; margin-top: 8px;">₦${order.total?.toLocaleString()}</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center;">
          <a href="https://www.erranders.org/dashboard/orders/${order._id}" class="btn">Track Order Progress</a>
        </div>
      `
    });
    return this.sendEmail(to, `🚀 Payment Confirmed: Order #${order.orderNumber}`, html);
  }

  async sendPaymentReceipt(to: string, amount: number, reference: string, method: string = 'Card', senderName: string = 'Erranders User', dateStr?: string) {
    const displayDate = dateStr || new Date().toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const html = this.wrap({
      preheader: `Receipt: ₦${amount.toLocaleString()}`,
      badge: { text: 'PAYMENT SUCCESS', color: 'green' },
      title: 'Payment Successful',
      subtitle: 'Your transaction was processed securely.',
      content: `
        <div class="card">
          <p class="card-label">Amount Paid</p>
          <p class="card-value">₦${amount.toLocaleString()}</p>
          <table class="data-table">
            <tr><td class="label">Method</td><td class="value" style="text-transform: capitalize;">${method}</td></tr>
            <tr><td class="label">Date</td><td class="value">${displayDate}</td></tr>
            <tr><td class="label">Name</td><td class="value">${senderName}</td></tr>
            <tr><td class="label">Reference</td><td class="value-highlight">${reference}</td></tr>
          </table>
        </div>

        <a href="https://www.erranders.org/dashboard" class="btn btn-light">Go to Dashboard</a>
      `
    });
    return this.sendEmail(to, `✅ Payment Receipt: ₦${amount.toLocaleString()}`, html);
  }

  async sendPaymentSuccess(to: string, amount: number, reference: string) {
    return this.sendPaymentReceipt(to, amount, reference);
  }

  async sendBookingReceipt(to: string, amount: number, reference: string, appointment: any, senderName: string = 'Erranders User') {
    const displayDate = new Date(appointment.scheduledDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const html = this.wrap({
      preheader: `Booking Confirmed! Ref: ${reference}`,
      badge: { text: 'BOOKING CONFIRMED', color: 'green' },
      title: 'Booking Confirmed',
      subtitle: 'Your appointment is booked and paid.',
      content: `
        <div class="card">
          <p class="card-label">Total Paid</p>
          <p class="card-value">₦${amount.toLocaleString()}</p>
          <table class="data-table">
            <tr><td class="label">Vendor</td><td class="value" style="text-transform: capitalize;">${appointment.vendor?.storeName || 'Vendor'}</td></tr>
            <tr><td class="label">Date</td><td class="value">${displayDate}</td></tr>
            <tr><td class="label">Time</td><td class="value">${appointment.startTime} – ${appointment.endTime}</td></tr>
            <tr><td class="label">Customer</td><td class="value">${senderName}</td></tr>
            <tr><td class="label">Reference</td><td class="value-highlight">${reference}</td></tr>
          </table>
        </div>

        <p style="font-size: 12px; color: #71717a; margin: 0 0 16px; line-height: 1.5;">Keep your reference safe — use it to track or cancel your booking.</p>
        <a href="https://www.erranders.org/manage-booking" class="btn">Manage Booking</a>
      `
    });
    return this.sendEmail(to, `✅ Booking Confirmed: ₦${amount.toLocaleString()}`, html);
  }
  async sendVendorNewBooking(to: string, appointment: any, studentName: string = 'A Student') {
    const displayDate = new Date(appointment.scheduledDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const html = this.wrap({
      preheader: `New Booking!`,
      badge: { text: 'NEW BOOKING', color: 'green' },
      title: 'New Booking Alert 🎉',
      subtitle: `You have a new booking from <b>${studentName}</b>.`,
      content: `
        <div class="card">
          <p class="card-label">Date & Time</p>
          <p class="card-value" style="font-size: 16px;">${displayDate}, ${appointment.startTime} – ${appointment.endTime}</p>
          <table class="data-table">
            <tr><td class="label">Total Fee</td><td class="value">₦${appointment.price?.toLocaleString() || 0}</td></tr>
            <tr><td class="label">Commitment Fee (Paid)</td><td class="value">₦${appointment.commitmentFee?.toLocaleString() || 0}</td></tr>
            <tr><td class="label">Balance (To Collect)</td><td class="value-highlight">₦${appointment.pendingBalance?.toLocaleString() || 0}</td></tr>
          </table>
        </div>
        <p style="font-size: 14px; color: #71717a; margin: 0 0 16px; line-height: 1.5;">Please log in to your vendor dashboard to manage this appointment.</p>
        <a href="https://vendor.erranders.org/dashboard/appointments" class="btn">View Calendar</a>
      `
    });
    return this.sendEmail(to, `New Booking Alert from ${studentName}! 🎉`, html);
  }

  async sendVendorBookingCancelled(to: string, studentName: string = 'A Student') {
    const html = this.wrap({
      preheader: `Booking Cancelled`,
      badge: { text: 'CANCELLED', color: 'orange' },
      title: 'Booking Cancelled ❌',
      subtitle: `<b>${studentName}</b> has cancelled their booking.`,
      content: `
        <div class="card" style="text-align: center; padding: 32px 16px;">
          <p class="card-label">Status</p>
          <p class="card-value" style="font-size: 24px; color: #DC2626;">CANCELLED</p>
        </div>
        <p style="font-size: 14px; color: #71717a; margin: 0 0 16px; line-height: 1.5;">Please log in to your vendor dashboard for more details.</p>
        <a href="https://vendor.erranders.org/dashboard/appointments" class="btn">View Calendar</a>
      `
    });
    return this.sendEmail(to, `Booking Cancelled by ${studentName}`, html);
  }

  async sendAppointmentStatusUpdate(to: string, status: string, serviceName: string, vendorName: string) {
    let emoji = '📅';
    if (status.toUpperCase() === 'CONFIRMED') emoji = '✅';
    if (status.toUpperCase() === 'COMPLETED') emoji = '🎉';
    if (status.toUpperCase() === 'CANCELLED') emoji = '❌';
    
    const html = this.wrap({
      preheader: `Booking ${status}`,
      badge: { text: 'UPDATE', color: 'blue' },
      title: `Booking ${status.toUpperCase()} ${emoji}`,
      subtitle: `Your booking for <b>${serviceName}</b> with <b>${vendorName}</b> was updated.`,
      content: `
        <div class="card" style="text-align: center; padding: 32px 16px;">
          <p class="card-label">Current Status</p>
          <p class="card-value" style="font-size: 24px; color: #171721;">${status.toUpperCase()}</p>
        </div>
        <a href="https://www.erranders.org/dashboard/activity" class="btn">View Bookings</a>
      `
    });
    return this.sendEmail(to, `Booking Update: ${status.toUpperCase()} ${emoji}`, html);
  }

  async sendStatusUpdate(to: string, orderNumber: string, status: string, emoji: string = '🚚') {
    const icon = status.includes('PREP') ? '🍳' : (status.includes('TRANSIT') ? '🚲' : (status.includes('DELIVER') ? '✅' : emoji));
    const html = this.wrap({
      preheader: `Order #${orderNumber}: ${status}`,
      badge: { text: 'UPDATE', color: 'blue' },
      title: `Order ${status.replace(/_/g, ' ').toLowerCase()}`,
      subtitle: `Order <b>#${orderNumber}</b> has been updated.`,
      content: `
        <span style="font-size: 64px; display: block; margin: 0 0 24px;">${icon}</span>
        <a href="https://www.erranders.org/dashboard/orders" class="btn btn-light">View Order</a>
      `
    });
    return this.sendEmail(to, `Order Update: ${status} — #${orderNumber}`, html);
  }

  async sendOrderStatusUpdate(to: string, orderNumber: string, status: string, note?: string) {
    return this.sendStatusUpdate(to, orderNumber, status);
  }

  async sendOrderDelivered(to: string, order: any) {
    const itemsHtml = order.items?.map((item: any) => `
      <tr>
        <td align="left" style="padding-bottom: 12px; color: #71717a; width: 60%;">${item.name} × ${item.quantity}</td>
        <td align="right" style="padding-bottom: 12px; font-weight: 700; color: #27272a; width: 40%;">₦${(item.price * item.quantity).toLocaleString()}</td>
      </tr>
    `).join('') || '';

    const html = this.wrap({
      preheader: `Order #${order.orderNumber} delivered!`,
      badge: { text: 'DELIVERED', color: 'green' },
      title: 'Order Delivered! 🎉',
      subtitle: `Your order <b>#${order.orderNumber}</b> has been successfully delivered. Enjoy!`,
      content: `
        <div style="border: 1px dashed #e4e4e7; border-radius: 12px; padding: 24px; margin-bottom: 32px; background: #fafafa;">
          <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 14px;">
            <tr>
              <td align="left" style="padding-bottom: 16px; color: #71717a; width: 60%;">Order ID</td>
              <td align="right" style="padding-bottom: 16px; font-weight: 700; color: #27272a; width: 40%;">#${order.orderNumber}</td>
            </tr>
            ${itemsHtml}
            <tr>
              <td align="left" style="padding-bottom: 16px; color: #71717a; border-top: 1px dashed #e4e4e7; padding-top: 16px; width: 60%;">Total Paid</td>
              <td align="right" style="padding-bottom: 16px; color: #10B981; font-weight: 700; font-size: 16px; border-top: 1px dashed #e4e4e7; padding-top: 16px; width: 40%;">₦${order.total?.toLocaleString()}</td>
            </tr>
            <tr>
              <td align="left" style="color: #71717a; width: 60%;">Status</td>
              <td align="right" style="font-weight: 700; color: #27272a; width: 40%;">Delivered ✅</td>
            </tr>
          </table>
        </div>

        <div style="background: #FFF4F0; border-radius: 12px; padding: 24px; margin-bottom: 32px; text-align: center;">
          <h3 style="color: #FF5C1A; margin: 0 0 8px 0; font-size: 18px;">Erranders is everywhere you are! 🧡</h3>
          <p style="color: #3f3f46; font-size: 14px; margin: 0 0 16px 0; line-height: 1.5;">Want food, groceries, or need to send a package? Get the <strong>Student App</strong>. Want to earn? Join the <strong>Vendor App</strong> or ride with the <strong>Dispatch App</strong>!</p>
          <a href="https://www.erranders.org" class="btn" style="width: auto !important; display: inline-block !important;">Explore Our Apps</a>
        </div>

        <div class="card" style="background: #FFF7ED; border-color: #ffedd5; text-align: left; padding: 24px; margin-bottom: 0;">
          <p style="font-size: 14px; font-weight: 700; color: #EA580C; margin: 0 0 6px;">Rate your experience ⭐</p>
          <p style="font-size: 13px; color: #9a3412; margin: 0 0 16px; line-height: 1.5;">Ratings help us maintain quality and reward top riders.</p>
          <a href="https://www.erranders.org/dashboard/orders/${order._id}" class="btn" style="padding: 10px 20px; font-size: 13px; display: inline-block !important; width: auto !important;">Tap to Rate</a>
        </div>
      `
    });

    let attachments: any[] = [];
    try {
      const pdfBuffer = await this.generateOrderReceiptPDF(order);
      attachments.push({
        filename: `Order_Receipt_${order.orderNumber}.pdf`,
        content: pdfBuffer,
      });
    } catch (err) {
      console.error('Failed to attach order receipt PDF:', err);
    }

    return this.sendEmail(to, `Order Delivered! 🍽️ #${order.orderNumber}`, html, attachments);
  }

  private async generateOrderReceiptPDF(order: any): Promise<Buffer> {
    const PDFDocument = require('pdfkit');
    
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 0, size: 'A4' });
        const buffers: Buffer[] = [];
        
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;
        
        // Background
        doc.rect(0, 0, pageWidth, pageHeight).fill('#F4F4F5'); // Light gray background
        
        // Ticket shape
        const ticketWidth = 380;
        const ticketHeight = 520;
        const startX = (pageWidth - ticketWidth) / 2;
        const startY = 80;
        
        doc.roundedRect(startX, startY, ticketWidth, ticketHeight, 16).fill('#FFFFFF');
        
        // Title
        doc.fillColor('#171721').fontSize(18).font('Helvetica-Bold').text('Order Receipt', startX, startY + 40, { align: 'center', width: ticketWidth });
        doc.fillColor('#71717A').fontSize(11).font('Helvetica').text('Thank you for ordering with Erranders.', startX, startY + 65, { align: 'center', width: ticketWidth });
        
        const contentY = startY + 120;
        
        // Two columns for ID and Status
        doc.fillColor('#A1A1AA').fontSize(9).font('Helvetica').text('ORDER ID', startX + 32, contentY);
        doc.text('STATUS', startX + ticketWidth - 120, contentY, { align: 'right', width: 88 });
        
        doc.fillColor('#171721').fontSize(12).font('Helvetica-Bold').text('#' + order.orderNumber, startX + 32, contentY + 14);
        doc.fillColor('#10B981').fontSize(12).font('Helvetica-Bold').text('Delivered ✅', startX + ticketWidth - 160, contentY + 14, { align: 'right', width: 128 });
        
        // Date & Time
        doc.fillColor('#A1A1AA').fontSize(9).font('Helvetica').text('DATE & TIME', startX + 32, contentY + 50);
        doc.fillColor('#171721').fontSize(11).font('Helvetica-Bold').text(new Date().toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }), startX + 32, contentY + 64);
        
        // Items Box
        const boxY = contentY + 105;
        doc.roundedRect(startX + 32, boxY, ticketWidth - 64, order.items?.length * 25 + 60, 8).fill('#F8FAFC');
        
        let itemY = boxY + 16;
        order.items?.forEach((item: any) => {
          doc.fillColor('#171721').fontSize(11).font('Helvetica-Bold').text(item.name + ' x ' + item.quantity, startX + 48, itemY, { width: 200 });
          doc.fillColor('#171721').fontSize(11).font('Helvetica-Bold').text('NGN ' + (item.price * item.quantity).toLocaleString(), startX + ticketWidth - 148, itemY, { align: 'right', width: 100 });
          itemY += 25;
        });

        // Total
        doc.moveTo(startX + 48, itemY).lineTo(startX + ticketWidth - 48, itemY).lineWidth(1).strokeColor('#E2E8F0').stroke();
        itemY += 16;
        doc.fillColor('#171721').fontSize(12).font('Helvetica-Bold').text('Total', startX + 48, itemY);
        doc.fillColor('#FF5C1A').fontSize(14).font('Helvetica-Bold').text('NGN ' + (order.total || 0).toLocaleString(), startX + ticketWidth - 148, itemY - 2, { align: 'right', width: 100 });
        
        // Barcode simulation at the bottom
        const barcodeY = ticketHeight + startY - 70;
        const barcodeStartX = startX + 60;
        const barcodeWidth = ticketWidth - 120;
        doc.rect(barcodeStartX, barcodeY, barcodeWidth, 30).fill('#000000');
        for (let i = 0; i < 40; i++) {
          const w = Math.random() * 4 + 1;
          const x = barcodeStartX + (i * (barcodeWidth / 40));
          doc.rect(x, barcodeY, w, 30).fill('#FFFFFF');
        }
        
        doc.fillColor('#A1A1AA').fontSize(8).font('Helvetica').text('Erranders is everywhere you are 🧡', startX, ticketHeight + startY + 20, { align: 'center', width: ticketWidth });
        
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  // ─── SUPPORT ─────────────────────────────────────────────────────

  async sendComplaintReceipt(to: string, ticketId: string, subject: string) {
    const html = this.wrap({
      preheader: `Support Ticket #${ticketId}`,
      badge: { text: 'SUPPORT TICKET', color: 'orange' },
      title: `We're on it.`,
      subtitle: `We received your report regarding "<b>${subject}</b>". Ticket <b>#${ticketId}</b> has been opened.`,
      content: `
        <div class="card">
          <p class="card-label">Ticket Reference</p>
          <p class="card-value" style="color: #FF5C1A; font-family: 'Courier New', monospace; font-size: 24px;">ERR-${ticketId}</p>
        </div>
        <p style="font-size: 12px; color: #71717a; text-align: center; margin: 0;">Our team typically responds within 2–4 hours.</p>
      `
    });
    return this.sendEmail(to, `Support Receipt: #${ticketId}`, html);
  }

  // ─── WALLET & PAYOUTS ───────────────────────────────────────────

  async sendPayoutNotification(to: string, amount: number, description: string) {
    const html = this.wrap({
      preheader: `You received ₦${amount.toLocaleString()}!`,
      badge: { text: 'PAYOUT', color: 'green' },
      title: 'Wallet Credited',
      subtitle: 'You\'ve received a payout in your Erranders wallet.',
      content: `
        <div class="card" style="background: #f0fdf4; border-color: #d1fae5;">
          <p class="card-label" style="color: #059669;">Settlement Amount</p>
          <p class="card-value" style="color: #059669;">+₦${amount.toLocaleString()}</p>
          <p style="font-size: 12px; color: #047857; margin: 0;">${description}</p>
        </div>
        <a href="https://www.erranders.org/dashboard/wallet" class="btn btn-green">View Wallet</a>
      `
    });
    return this.sendEmail(to, `Wallet Credited — ₦${amount.toLocaleString()}`, html);
  }

  async sendManualPayoutReceipt(to: string, amount: number, description: string, proofUrl?: string) {
    const html = this.wrap({
      preheader: `Your payout of ₦${amount.toLocaleString()} is complete!`,
      badge: { text: 'PAYOUT SUCCESSFUL', color: 'blue' },
      title: 'Funds Sent!',
      subtitle: 'We have manually transferred your earnings to your registered bank account.',
      content: `
        <span style="font-size: 64px; display: block; margin: 0 0 24px;">💸</span>
        <div class="card" style="background: #eff6ff; border-color: #dbeafe; text-align: left;">
          <p class="card-label" style="color: #2563eb;">Payout Amount</p>
          <p class="card-value" style="color: #1d4ed8;">₦${amount.toLocaleString()}</p>
          <p style="font-size: 13px; color: #3b82f6; margin: 0 0 8px 0; font-weight: 500;">${description || 'Manual Payout / Adjustment'}</p>
          ${proofUrl ? `<a href="${proofUrl}" style="font-size: 11px; text-decoration: underline; color: #2563eb; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">View Proof of Payment ↗</a>` : ''}
        </div>
        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">Your Erranders wallet has been debited to reflect this transfer. Depending on your bank, it may take a few minutes for the funds to reflect.</p>
        <a href="https://www.erranders.org/dispatch/wallet" class="btn btn-blue" style="background-color: #2563eb; color: #fff;">Check Wallet Balance</a>
      `
    });
    return this.sendEmail(to, `Payout Successful: ₦${amount.toLocaleString()} sent to your bank`, html);
  }

  async sendWalletFundingSuccess(to: string, amount: number, description: string) {
    const html = this.wrap({
      preheader: `Wallet Funded: ₦${amount.toLocaleString()}`,
      badge: { text: 'WALLET FUNDED', color: 'green' },
      title: 'Funds Added! 💰',
      subtitle: 'Your Erranders wallet has been successfully credited.',
      content: `
        <div class="card" style="background: #f0fdf4; border-color: #d1fae5; text-align: center;">
          <p class="card-label" style="color: #059669;">Amount Credited</p>
          <p class="card-value" style="color: #059669;">+₦${amount.toLocaleString()}</p>
          <p style="font-size: 13px; color: #047857; margin: 0 0 8px 0; font-weight: 500;">${description}</p>
        </div>
        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-bottom: 24px; text-align: center;">You can use this balance immediately for your next orders.</p>
        <a href="https://www.erranders.org/dashboard/wallet" class="btn btn-green">View Wallet</a>
      `
    });
    return this.sendEmail(to, `Wallet Credited — ₦${amount.toLocaleString()}`, html);
  }

  async sendWithdrawalRequested(to: string, amount: number, reference: string) {
    const html = this.wrap({
      preheader: `Withdrawal Initiated: ₦${amount.toLocaleString()}`,
      badge: { text: 'WITHDRAWAL INITIATED', color: 'blue' },
      title: 'Processing Payout ⏳',
      subtitle: 'Your request to withdraw funds is being processed.',
      content: `
        <div class="card" style="background: #eff6ff; border-color: #dbeafe; text-align: left;">
          <p class="card-label" style="color: #2563eb;">Amount</p>
          <p class="card-value" style="color: #1d4ed8;">₦${amount.toLocaleString()}</p>
          <table class="data-table">
            <tr><td class="label">Reference</td><td class="value" style="color: #1d4ed8; font-family: monospace;">${reference}</td></tr>
            <tr><td class="label">Status</td><td class="value" style="color: #2563eb;">Processing</td></tr>
          </table>
        </div>
        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">We'll notify you as soon as the funds hit your bank account. This usually takes a few minutes.</p>
      `
    });
    return this.sendEmail(to, `Withdrawal Initiated: ₦${amount.toLocaleString()}`, html);
  }

  async sendPayoutSuccessful(to: string, amount: number, reference: string) {
    const html = this.wrap({
      preheader: `Payout Successful: ₦${amount.toLocaleString()}`,
      badge: { text: 'PAYOUT SUCCESSFUL', color: 'green' },
      title: 'Funds Sent! 🎉',
      subtitle: 'Your earnings have been successfully sent to your bank account.',
      content: `
        <div class="card" style="background: #f0fdf4; border-color: #d1fae5; text-align: left;">
          <p class="card-label" style="color: #059669;">Amount Transferred</p>
          <p class="card-value" style="color: #059669;">₦${amount.toLocaleString()}</p>
          <table class="data-table">
            <tr><td class="label">Reference</td><td class="value" style="color: #059669; font-family: monospace;">${reference}</td></tr>
            <tr><td class="label">Status</td><td class="value" style="color: #059669;">Completed</td></tr>
          </table>
        </div>
        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">Your Erranders wallet has been debited. Depending on your bank, it may take a few minutes for the funds to reflect.</p>
        <a href="https://www.erranders.org/dashboard/wallet" class="btn btn-green">Go to Dashboard</a>
      `
    });
    return this.sendEmail(to, `Payout Successful: ₦${amount.toLocaleString()}`, html);
  }

  async sendPayoutFailed(to: string, amount: number, reason: string) {
    const html = this.wrap({
      preheader: `Payout Failed: ₦${amount.toLocaleString()}`,
      badge: { text: 'PAYOUT FAILED', color: 'orange' },
      title: 'Transfer Failed ❌',
      subtitle: 'We could not complete your withdrawal request.',
      content: `
        <div class="card" style="background: #FEF2F2; border-color: #FEE2E2; text-align: left;">
          <p class="card-label" style="color: #DC2626;">Amount</p>
          <p class="card-value" style="color: #B91C1C;">₦${amount.toLocaleString()}</p>
          <table class="data-table">
            <tr><td class="label">Reason</td><td class="value" style="color: #DC2626;">${reason}</td></tr>
          </table>
        </div>
        <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">Don't worry, your funds are safe! The amount has been completely refunded back to your Erranders wallet. You can try withdrawing again or contact support.</p>
        <a href="https://www.erranders.org/dashboard/wallet" class="btn" style="background-color: #DC2626; color: #fff;">Check Wallet Balance</a>
      `
    });
    return this.sendEmail(to, `Action Required: Payout Failed (₦${amount.toLocaleString()})`, html);
  }

  // ─── PROMOTIONAL ────────────────────────────────────────────────

  async sendPromotionalEmail(to: string, subject: string, title: string, content: string, ctaText: string, ctaLink: string, image?: string) {
    const html = this.wrap({
      preheader: title,
      badge: { text: 'SPECIAL OFFER', color: 'blue' },
      title: title,
      subtitle: content,
      content: `
        ${image ? `<img src="${image}" style="width: 100%; border-radius: 12px; margin: 0 0 24px; display: block; border: 1px solid #e4e4e7;" alt="Promotion">` : ''}
        <div style="text-align: center;">
          <a href="${ctaLink}" class="btn">${ctaText}</a>
        </div>
      `
    });
    return this.sendEmail(to, subject, html);
  }


  async sendCuteDailyEmail(to: string, name: string, points: number, orderCount: number) {
    const formatName = (str: string) => {
      if (!str) return 'there';
      return str.split(' ')
        .filter(part => part.trim().length > 0)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ')
        .trim();
    };
    
    const formattedName = formatName(name);
    
    let personalizedMessage = '';
    let ctaText = 'ORDER YOUR MEALS TODAY';
    let title = 'Fuel your entire day with Erranders 🍳';
    
    if (orderCount === 0) {
      personalizedMessage = `We noticed you haven't made your first purchase with Erranders yet! We are all about delivering joy and happiness in every errand. Why not give us a try today and enjoy your favorite African dishes delivered straight to you?`;
      title = `Hi ${formattedName}, let's get you started! 🚀`;
      ctaText = 'MAKE YOUR FIRST ORDER';
    } else {
      personalizedMessage = `Wow ${formattedName}, you've already made <b>${orderCount} orders</b> with us! Thank you for letting us deliver joy and happiness to your doorstep. Keep the streak going with some delicious local dishes today!`;
      title = `Hi ${formattedName}, ready for your next meal? 🥘`;
    }

    const africanDishes = [
      'https://images.unsplash.com/photo-1604329760661-e71dc83f8f26?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1588123190131-1c3fac394f4b?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1628294895950-9805252327bc?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1574484284002-952d92456975?q=80&w=800&auto=format&fit=crop'
    ];
    
    const imageIndex = to.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % africanDishes.length;
    const selectedImage = africanDishes[imageIndex];

    const html = this.wrap({
      preheader: 'Your Daily Craving Guide! 🍽️',
      badge: { text: points > 0 ? `YOU HAVE ${points} POINTS 🌟` : 'DELIVERING JOY', color: 'orange' },
      title: title,
      subtitle: personalizedMessage,
      content: `
        <img src="${selectedImage}" style="width: 100%; border-radius: 16px; margin: 0 0 24px; display: block; border: 1px solid #e4e4e7; box-shadow: 0 4px 12px rgba(0,0,0,0.05);" alt="Delicious African Dish">
        <div style="background: #fff8f5; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px; border: 1px dashed #ffb399;">
          <h3 style="margin: 0 0 8px 0; color: #ff5c1a; font-size: 18px;">Did you know?</h3>
          <p style="margin: 0; color: #4a4a4a; font-size: 14px; line-height: 1.5;">You can use your <b>${points} points</b> to get discounts on your orders! Erranders is dedicated to delivering happiness in every single errand.</p>
        </div>
        <div style="text-align: center;">
          <a href="https://erranders.org/vendors" class="btn" style="background-color: #ff5c1a; color: white; font-weight: bold; border-radius: 30px; padding: 14px 28px; text-decoration: none; display: inline-block;">${ctaText}</a>
        </div>
      `
    });
    return this.sendEmail(to, 'Your Daily Craving Guide! 🍽️', html);
  }

  // ─── AMBASSADOR ─────────────────────────────────────────────────

  async sendFacilitatorWelcomeEmail(to: string, name: string, referralCode: string, skill: string) {
    const firstName = name.split(' ')[0];
    const html = this.wrap({
      preheader: `Your referral code: ${referralCode}`,
      badge: { text: 'CAMPUS AMBASSADOR', color: 'purple' },
      title: `Hey ${firstName}, you're in! 💜`,
      subtitle: 'Every person you bring to Erranders earns you <b>points, rewards, and recognition</b>.',
      content: `
        <div class="card" style="background: #fafafa;">
          <p class="card-label" style="color: #FF5C1A;">Your Referral Code</p>
          <p class="card-value" style="font-family: 'Courier New', monospace; letter-spacing: 4px;">${referralCode}</p>
          <p style="font-size: 12px; color: #71717a; margin: 0;">Share with students, vendors, and riders.</p>
        </div>
        <div style="text-align: center;">
          <a href="https://www.erranders.org" class="btn">Start Sharing</a>
        </div>
      `
    });
    return this.sendEmail(to, `Welcome to the Squad, ${firstName}! Code: ${referralCode}`, html);
  }

  // ─── NOTIFICATIONS ───────────────────────────────────────────────

  async sendVendorOnlineNotification(to: string, storeName: string, link: string) {
    const html = this.wrap({
      preheader: `${storeName} is now online!`,
      badge: { text: 'STORE ONLINE', color: 'green' },
      title: 'They\'re Back!',
      subtitle: `Great news! <b>${storeName}</b> is now online and ready to accept your orders.`,
      content: `
        <span style="font-size: 64px; display: block; margin: 0 0 24px;">🏪</span>
        <a href="${link}" class="btn">Order Now</a>
      `
    });
    return this.sendEmail(to, `${storeName} is Open for Business! 🥳`, html);
  }
  // ─── DISPATCHER KYC ──────────────────────────────────────────────

  async sendDispatcherVerificationSubmitted(to: string, firstName: string) {
    const subject = `Your verification is under review, ${firstName} 📋`;
    const html = `
      ${this.getBaseStyles()}
      <div class="wrapper">
        <div class="header-logo"><img src="${this.logoUrl}" alt="Erranders"></div>
        <div class="container">
          <div class="content-header" style="background-color: #2563EB;">
            <div class="badge badge-blue" style="background-color: rgba(255,255,255,0.2); color: white; border-color: transparent;">Under Review</div>
            <h1 class="title">Verification Received</h1>
            <p class="subtitle" style="color: #BFDBFE;">We're reviewing your application.</p>
          </div>
          <div class="content-body">
            <p style="font-size: 15px; color: #3f3f46; margin-bottom: 24px; text-align: left;">
              Hi <strong>${firstName}</strong>,<br><br>
              We've received your Tier 2 verification documents. Our admin team is currently reviewing your profile to ensure everything is in order.
              <br><br>
              This process usually takes 24-48 hours. We'll notify you as soon as there's an update.
            </p>
          </div>
          ${this.getEcosystemFooter()}
        </div>
      </div>
    `;
    return this.sendEmail(to, subject, html);
  }

  async sendDispatcherVerificationApproved(to: string, firstName: string) {
    const subject = `Congratulations ${firstName}! You're verified 🎉`;
    const html = `
      ${this.getBaseStyles()}
      <div class="wrapper">
        <div class="header-logo"><img src="${this.logoUrl}" alt="Erranders"></div>
        <div class="container">
          <div class="content-header" style="background-color: #10B981;">
            <div class="badge badge-green" style="background-color: rgba(255,255,255,0.2); color: white; border-color: transparent;">Verified</div>
            <h1 class="title">Welcome to the Fleet!</h1>
            <p class="subtitle" style="color: #A7F3D0;">Your account is now fully active.</p>
          </div>
          <div class="content-body">
            <p style="font-size: 15px; color: #3f3f46; margin-bottom: 24px; text-align: left;">
              Hi <strong>${firstName}</strong>,<br><br>
              Great news! Your verification documents have been approved. You are now officially a verified dispatcher on Erranders.
              <br><br>
              You can now start accepting delivery requests and earning money immediately.
            </p>
            <a href="https://dispatch.erranders.org" style="display: inline-block; padding: 14px 28px; background-color: #10B981; color: #ffffff; text-decoration: none; font-weight: 700; border-radius: 12px;">Go to Dashboard</a>
          </div>
          ${this.getEcosystemFooter()}
        </div>
      </div>
    `;
    return this.sendEmail(to, subject, html);
  }

  async sendDispatcherVerificationRejected(to: string, firstName: string, reason?: string) {
    const subject = `Update on your verification application ⚠️`;
    const reasonHtml = reason ? `
      <div style="background-color: #FEF2F2; border-left: 4px solid #EF4444; padding: 16px; margin: 24px 0; border-radius: 4px; text-align: left;">
        <p style="font-size: 13px; color: #991B1B; font-weight: 700; margin: 0 0 4px;">Reason for rejection:</p>
        <p style="font-size: 14px; color: #7F1D1D; margin: 0;">${reason}</p>
      </div>
    ` : '';

    const html = `
      ${this.getBaseStyles()}
      <div class="wrapper">
        <div class="header-logo"><img src="${this.logoUrl}" alt="Erranders"></div>
        <div class="container">
          <div class="content-header" style="background-color: #EF4444;">
            <div class="badge badge-orange" style="background-color: rgba(255,255,255,0.2); color: white; border-color: transparent;">Action Required</div>
            <h1 class="title">Verification Unsuccessful</h1>
            <p class="subtitle" style="color: #FECACA;">There was an issue with your documents.</p>
          </div>
          <div class="content-body">
            <p style="font-size: 15px; color: #3f3f46; margin-bottom: 16px; text-align: left;">
              Hi <strong>${firstName}</strong>,<br><br>
              Unfortunately, we were unable to approve your verification application at this time.
            </p>
            ${reasonHtml}
            <p style="font-size: 15px; color: #3f3f46; margin-bottom: 24px; text-align: left;">
              Please review the feedback above, gather the correct documents, and resubmit your application through the dispatch app.
            </p>
            <a href="https://dispatch.erranders.org" style="display: inline-block; padding: 14px 28px; background-color: #EF4444; color: #ffffff; text-decoration: none; font-weight: 700; border-radius: 12px;">Review Application</a>
          </div>
          ${this.getEcosystemFooter()}
        </div>
      </div>
    `;
    return this.sendEmail(to, subject, html);
  }
}
