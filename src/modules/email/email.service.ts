import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend | null;
  private fromEmail = 'Errandr <notifications@errandr.shop>'; // Fallback

  constructor(private configService: ConfigService) {
    let apiKey = this.configService.get<string>('RESEND_API_KEY');
    // Clean potential quotes from .env
    if (apiKey) {
      apiKey = apiKey.replace(/['"]+/g, '');
      console.log('Initializing Resend with API Key (cleaned)');
      this.resend = new Resend(apiKey);
    } else {
      console.warn('RESEND_API_KEY is missing. Email functionality will be disabled.');
      this.resend = null;
    }
    
    let from = this.configService.get<string>('EMAIL_FROM') || this.fromEmail;
    this.fromEmail = from.replace(/['"]+/g, '');
    console.log(`Email Service Sender: ${this.fromEmail}`);
  }

  async sendEmail(to: string, subject: string, html: string) {
    if (!this.resend) {
      console.warn('Skipping email send: Resend client not initialized (missing API key)');
      return;
    }
    try {
      if (!to || !to.includes('@')) {
        console.warn(`Skipping email: Invalid recipient address "${to}"`);
        return;
      }

      console.log(`Attempting to send email to ${to} with subject: ${subject}`);
      
      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [to],
        subject,
        html,
      });

      if (error) {
        console.error('Resend API returned an error:', JSON.stringify(error, null, 2));
        // If domain not verified, try fallback
        if (error.message.includes('not verified') || error.message.includes('unauthorized')) {
           console.warn('Domain verification issue detected. Ensure notifications@errandr.shop is verified in Resend.');
        }
        throw new InternalServerErrorException(error.message);
      }

      console.log('Email sent successfully:', data?.id);
      return data;
    } catch (err) {
      console.error('Email sending failed critically:', err.message);
      if (err instanceof InternalServerErrorException) throw err;
      throw new InternalServerErrorException(err.message || 'Email delivery failed');
    }
  }

  private wrapHtml(content: string, previewText: string = '') {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Errandr</title>
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px; -webkit-font-smoothing: antialiased; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; outline: 1px solid #e4e4e7; }
    .header { padding: 40px 40px 20px; text-align: left; }
    .logo { color: #111827; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; text-decoration: none; display: flex; align-items: center; gap: 8px; }
    .logo-icon { width: 34px; height: 34px; background: linear-gradient(135deg, #0284c7, #22c55e); clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%); display: inline-block; vertical-align: middle; margin-right: 12px; }
    .content { padding: 0 40px 40px; color: #1f2937; line-height: 1.6; font-size: 16px; }
    .footer { padding: 40px; text-align: left; color: #6b7280; font-size: 14px; background: #fafafa; border-top: 1px solid #f4f4f5; }
    .button { display: inline-block; padding: 14px 28px; background: #34a853; color: #ffffff !important; text-decoration: none; border-radius: 24px; font-weight: 500; margin: 24px 0; font-size: 15px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 16px; }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .otp-code { font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #111827; background: #fafafa; padding: 24px 32px; border-radius: 8px; display: inline-block; margin: 24px 0; border: 1px solid #e5e7eb; }
    h1 { margin: 0 0 24px 0; font-size: 22px; font-weight: 700; color: #111827; }
    p { margin: 0 0 16px 0; }
    .footer p { margin: 0 0 4px 0; }
    .social-links { margin-top: 32px; }
    .social-links a { display: inline-block; margin-right: 16px; text-decoration: none; color: #111827; font-weight: 600; }
  </style>
</head>
<body>
  <div style="display: none; max-height: 0px; overflow: hidden;">${previewText}</div>
  <div class="container">
    <div class="header">
      <a href="https://errandr.shop" class="logo">
        <span class="logo-icon"></span>
        Errandr
      </a>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p style="font-weight: 700; color: #111827; margin-bottom: 8px;">Errandr Ltd</p>
      <p>Local Airport Road</p>
      <p>42 Murtala Mohammed International Airport</p>
      <p>Lagos 100271</p>
      <p>Nigeria</p>
      <div class="social-links">
        <a href="#">Instagram</a>
        <a href="#">Facebook</a>
        <a href="#">LinkedIn</a>
        <a href="#">Twitter</a>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  }

  async sendOrderConfirmation(to: string, orderNumber: string, total: number) {
    const html = this.wrapHtml(`
      <div class="badge badge-blue">Order Confirmed</div>
      <h1>Success! Your order is placed 🍔</h1>
      <p>Hi there,</p>
      <p>Great news! Your order <strong>#${orderNumber}</strong> has been received by our vendors. Our errandr are being notified now.</p>
      <div style="background: #f8fafc; padding: 20px; border-radius: 12px; margin: 24px 0;">
        <p style="margin: 0; font-size: 14px; color: #64748b;">Order Total</p>
        <p style="margin: 4px 0 0 0; font-size: 24px; font-weight: 700; color: #0061FF;">₦${total.toLocaleString()}</p>
      </div>
      <p>You can track the live progress of your delivery directly from your dashboard.</p>
      <a href="https://student.errandr.shop/orders/${orderNumber}" class="button">Track My Order</a>
    `, `Your order #${orderNumber} has been confirmed!`);
    
    return this.sendEmail(to, `Order Confirmed - #${orderNumber}`, html);
  }

  async sendPayoutNotification(to: string, amount: number, description: string) {
    const html = this.wrapHtml(`
      <div class="badge badge-blue">Payment Received</div>
      <h1>Funds added to your wallet 💸</h1>
      <p>Hi,</p>
      <p>Your Errandr wallet has just been credited with a new payment.</p>
      <div style="background: #f8fafc; padding: 24px; border-radius: 12px; margin: 24px 0; text-align: center;">
        <p style="margin: 0; font-size: 14px; color: #64748b;">Credit Amount</p>
        <p style="margin: 8px 0 0 0; font-size: 32px; font-weight: 800; color: #10b981;">+₦${amount.toLocaleString()}</p>
        <p style="margin: 12px 0 0 0; font-size: 14px; color: #1e293b;">${description}</p>
      </div>
      <p>Keep up the great work! Your earnings are available for withdrawal according to your preferences.</p>
      <a href="https://errandr.shop/wallet" class="button">View Wallet</a>
    `, `You've received ₦${amount.toLocaleString()} in your wallet.`);

    return this.sendEmail(to, 'Wallet Credited - Errandr', html);
  }

  async sendAuthOTP(to: string, otp: string) {
    const html = this.wrapHtml(`
      <h1>Your verification code</h1>
      <p>Hello!</p>
      <p>Please find below your verification code to continue:</p>
      <div style="text-align: left;">
        <div class="otp-code">${otp}</div>
      </div>
      <p style="margin-top: 8px;">Don't share this code with anyone. Our employees will never ask for the code.</p>
    `, `Your Errandr verification code is ${otp}`);

    return this.sendEmail(to, 'Your Verification Code', html);
  }

  async sendSignupOTP(to: string, firstName: string, otp: string) {
    const html = this.wrapHtml(`
      <div class="badge badge-blue">Almost There! 🎯</div>
      <h1>Hey ${firstName}, let's verify your email! 🙌</h1>
      <p>Welcome to Errandr! We're <strong>so hyped</strong> to have you here. Just one tiny step — pop this code into the app to verify your email and get your account rolling.</p>
      <div style="text-align: center; margin: 32px 0;">
        <div class="otp-code">${otp}</div>
      </div>
      <p style="font-size: 14px; color: #64748b;">⏰ This code expires in <strong>10 minutes</strong>. If it times out, no worries — just tap "Resend" and we'll fire a new one your way.</p>
      <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">Didn't sign up on Errandr? You can safely ignore this email — someone probably mistyped their address. It happens! 😅</p>
    `, `Your Errandr code is ${otp}. Valid for 10 minutes.`);

    return this.sendEmail(to, `${otp} — Verify Your Email 📬`, html);
  }

  async sendVendorWelcome(to: string, firstName: string, storeName: string) {
    const html = this.wrapHtml(`
      <div class="badge badge-blue">You're In! 🎉</div>
      <h1>Welcome to the Errandr Vendors Family, ${firstName}! 🏠</h1>
      <p>Congratulations on setting up <strong>${storeName}</strong>! Your store is now under review, and our team typically approves new vendors within 24 hours.</p>

      <div style="background: linear-gradient(135deg, #f8fafc, #eff6ff); padding: 28px; border-radius: 16px; margin: 32px 0; border-left: 4px solid #065fdb;">
        <p style="font-style: italic; font-size: 16px; color: #1e293b; margin: 0 0 16px 0; line-height: 1.7;">
          "We built Errandr because we believe every student vendor, kitchen, and small business on campus deserves a beautiful digital storefront and access to thousands of hungry students. You're not just a vendor — you're a campus legend in the making."
        </p>
        <p style="margin: 0; font-weight: 700; color: #065fdb; font-size: 14px;">— The Errandr Team 💙</p>
      </div>

      <h2 style="font-size: 16px; color: #111827; margin-top: 32px;">Here's how to hit the ground running:</h2>
      <div style="margin: 20px 0;">
        <div style="display: flex; gap: 12px; margin-bottom: 16px; align-items: flex-start;">
          <span style="background: #eff6ff; color: #065fdb; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0;">1</span>
          <div>
            <p style="margin: 0; font-weight: 700; color: #111827; font-size: 14px;">Add your menu items</p>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Head to Inventory → New Product. Add photos, descriptions, and pricing.</p>
          </div>
        </div>
        <div style="display: flex; gap: 12px; margin-bottom: 16px; align-items: flex-start;">
          <span style="background: #eff6ff; color: #065fdb; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0;">2</span>
          <div>
            <p style="margin: 0; font-weight: 700; color: #111827; font-size: 14px;">Set your operating hours</p>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Go to Settings to define when students can order from you.</p>
          </div>
        </div>
        <div style="display: flex; gap: 12px; margin-bottom: 16px; align-items: flex-start;">
          <span style="background: #eff6ff; color: #065fdb; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0;">3</span>
          <div>
            <p style="margin: 0; font-weight: 700; color: #111827; font-size: 14px;">Link your bank account</p>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Set up your payout details in Wallet settings so we can send you money.</p>
          </div>
        </div>
        <div style="display: flex; gap: 12px; align-items: flex-start;">
          <span style="background: #eff6ff; color: #065fdb; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; flex-shrink: 0;">4</span>
          <div>
            <p style="margin: 0; font-weight: 700; color: #111827; font-size: 14px;">Go online & start selling!</p>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">Toggle your store status to "Online" and watch the orders roll in 🚀</p>
          </div>
        </div>
      </div>

      <a href="https://vendor.errandr.shop/dashboard" class="button">Open My Dashboard →</a>

      <p style="color: #94a3b8; font-size: 13px; margin-top: 24px;">Need help? Reply to this email or reach us at <a href="mailto:support@errandr.shop" style="color: #065fdb;">support@errandr.shop</a>. We're always around 💪</p>
    `, `Welcome ${firstName}! Your store ${storeName} is being set up on Errandr.`);

    return this.sendEmail(to, `Welcome to Errandr, ${firstName}! 🎉`, html);
  }

  async sendPasswordResetOTP(to: string, otp: string) {
    const html = this.wrapHtml(`
      <div class="badge badge-blue">Password Reset Action</div>
      <h1>Change your password 🔐</h1>
      <p>Hello,</p>
      <p>We received a request to reset your password. Use the verification code below to securely change it:</p>
      <div style="text-align: center; margin: 32px 0;">
        <div class="otp-code">${otp}</div>
      </div>
      <p style="font-size: 14px; color: #64748b;">⏰ This code expires in <strong>10 minutes</strong>. If you didn't request a password reset, you can safely ignore this email — your account is strictly protected.</p>
    `, `Your Errandr password reset code is ${otp}. Valid for 10 minutes.`);

    return this.sendEmail(to, `${otp} — Reset Your Password 🔐`, html);
  }

  async sendOrderStatusUpdate(to: string, orderNumber: string, status: string, note?: string) {
    const html = this.wrapHtml(`
      <div class="badge badge-blue">Order Update</div>
      <h1>Your delivery status changed 🏃</h1>
      <p>Your order <strong>#${orderNumber}</strong> is now <span style="color: #0061FF; font-weight: 700;">${status}</span>.</p>
      ${note ? `
      <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0;">
        <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.5;">${note}</p>
      </div>
      ` : ''}
      <p>Our errandr are working hard to get your items to you as quickly as possible.</p>
      <a href="https://student.errandr.shop/orders/${orderNumber}" class="button">View Status</a>
    `, `Order #${orderNumber} is now ${status}`);

    return this.sendEmail(to, `Order Update: ${status} - #${orderNumber}`, html);
  }
}
