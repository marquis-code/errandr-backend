import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend | null;
  private fromEmail = 'Erranders <notifications@erranders.org>';
  private primaryColor = '#FF5C1A';
  private logoUrl = 'https://res.cloudinary.com/marquis/image/upload/v1780940566/logo-light_pyjwmn.png';

  constructor(private configService: ConfigService) {
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

  async sendEmail(to: string, subject: string, html: string) {
    console.log(`\x1b[35m[EMAIL_AGENT]\x1b[0m 🚀 Triggering email to: \x1b[36m${to}\x1b[0m`);
    console.log(`\x1b[35m[EMAIL_AGENT]\x1b[0m 📎 Subject: \x1b[33m${subject}\x1b[0m`);

    if (!this.resend) {
      console.warn(`\x1b[31m[EMAIL_AGENT] ❌ RESEND_API_KEY is missing! Skipping real delivery, but trigger was SUCCESSFUL.\x1b[0m`);
      return { message: 'Development mode: Email logged to console' };
    }

    try {
      if (!to || !to.includes('@')) {
        console.error(`\x1b[31m[EMAIL_AGENT] ❌ Invalid recipient address: ${to}\x1b[0m`);
        return;
      }

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: [to],
        subject,
        html,
      });

      if (error) {
        console.error(`\x1b[31m[EMAIL_AGENT] ❌ Delivery Error: ${error.message}\x1b[0m`);
        throw new InternalServerErrorException(error.message);
      }

      console.log(`\x1b[32m[EMAIL_AGENT] ✅ Email delivered successfully! ID: ${data?.id}\x1b[0m`);
      return data;
    } catch (err: any) {
      console.error(`\x1b[31m[EMAIL_AGENT] ❌ Fatal Error: ${err.message}\x1b[0m`);
      throw new InternalServerErrorException(err.message || 'Email delivery failed');
    }
  }

  // ─── DESIGN SYSTEM ───────────────────────────────────────────────

  private getBaseStyles() {
    return `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        .container { max-width: 520px; width: 100%; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; margin-top: 20px; margin-bottom: 20px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
        .content { padding: 32px 24px; color: #3f3f46; }
        .footer { padding: 24px; text-align: center; color: #71717a; font-size: 12px; background-color: #ffffff; border-top: 1px solid #f4f4f5; }
        .btn { display: inline-block; padding: 12px 28px; background-color: #FF5C1A; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 13px; text-align: center; transition: all 0.2s; }
        .btn-light { background-color: #f4f4f5; color: #3f3f46 !important; border: 1px solid #e4e4e7; }
        .btn-green { background-color: #059669; }
        h1.title { font-size: 24px; font-weight: 700; line-height: 1.3; margin: 0 0 12px; color: #27272a; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
        .badge-orange { background-color: #FFF7ED; color: #EA580C; }
        .badge-blue { background-color: #EFF6FF; color: #2563EB; }
        .badge-green { background-color: #ECFDF5; color: #059669; }
        .badge-purple { background-color: #F5F3FF; color: #7C3AED; }
        .card { background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 12px; padding: 24px; margin: 0 0 20px; text-align: center; }
        .card-value { font-size: 28px; font-weight: 800; margin: 8px 0 16px; color: #27272a; }
        .card-label { font-size: 10px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px; margin: 0; }
        .data-table { width: 100%; border-collapse: collapse; text-align: left; }
        .data-table td { padding: 8px 0; font-size: 13px; border-bottom: 1px solid #f4f4f5; }
        .data-table tr:last-child td { border-bottom: none; }
        .data-table .label { color: #71717a; }
        .data-table .value { font-weight: 600; color: #3f3f46; text-align: right; }
        .data-table .value-highlight { font-weight: 700; color: #FF5C1A; text-align: right; }
        @media only screen and (max-width: 520px) {
          .container { margin-top: 0; margin-bottom: 0; border-radius: 0; }
          .content { padding: 24px 16px !important; }
          .footer { padding: 24px 16px !important; }
          .btn { display: block !important; width: 100% !important; box-sizing: border-box !important; }
        }
      </style>
    `;
  }

  private marketingBanner() {
    return `
      <div style="background: linear-gradient(to right, #FFF7ED, #ffffff); padding: 24px; text-align: center; border-top: 1px solid #f4f4f5; border-bottom: 1px solid #f4f4f5;">
        <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #EA580C; text-transform: uppercase; letter-spacing: 0.5px;">Join the Erranders Ecosystem</p>
        <p style="margin: 0 0 16px; font-size: 13px; color: #52525b; line-height: 1.5;">Order food & essentials · Become a vendor · Earn as a rider</p>
        <div style="display: inline-block;">
          <a href="https://student.erranders.org" style="display: inline-block; padding: 8px 16px; background: #FF5C1A; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 11px; font-weight: 600; margin: 0 4px;">Order Now</a>
          <a href="https://vendor.erranders.org/auth/register" style="display: inline-block; padding: 8px 16px; background: #ffffff; color: #52525b; text-decoration: none; border-radius: 6px; font-size: 11px; font-weight: 600; margin: 0 4px; border: 1px solid #e4e4e7;">Sell on Erranders</a>
        </div>
      </div>
    `;
  }

  private wrap(content: string, preheader: string = '') {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          ${this.getBaseStyles()}
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f5;">
          <div style="display: none; max-height: 0px; overflow: hidden; opacity: 0;">${preheader}</div>
          <div class="container">

            <!-- HEADER: Logo -->
            <div style="padding: 24px 24px 0; text-align: left;">
              <img src="${this.logoUrl}" style="height: 32px;" alt="Erranders">
            </div>

            ${content}

            <!-- MARKETING BANNER -->
            ${this.marketingBanner()}

            <!-- FOOTER -->
            <div class="footer">
              <img src="${this.logoUrl}" style="height: 24px; margin-bottom: 16px; opacity: 0.7;" alt="Erranders">
              <p style="color: #3f3f46; font-weight: 600; font-size: 13px; margin: 0 0 8px;">Erranders — Campus life, elevated.</p>
              <p style="margin: 0 0 20px; line-height: 1.5; color: #71717a; font-size: 12px;">Seamless delivery, smart commerce, and real opportunities for students across Africa.</p>
              <div style="margin-bottom: 20px;">
                <a href="https://erranders.org" style="color: #FF5C1A; text-decoration: none; font-size: 12px; margin: 0 8px; font-weight: 500;">Website</a>
                <a href="https://student.erranders.org" style="color: #FF5C1A; text-decoration: none; font-size: 12px; margin: 0 8px; font-weight: 500;">Order</a>
                <a href="https://vendor.erranders.org" style="color: #FF5C1A; text-decoration: none; font-size: 12px; margin: 0 8px; font-weight: 500;">Vendors</a>
              </div>
              <p style="margin: 0; font-size: 11px; color: #a1a1aa;">© ${new Date().getFullYear()} Erranders Ltd. Lagos, Nigeria.</p>
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

  async sendVerificationOTP(to: string, otp: string) {
    const html = this.wrap(`
      <div class="content" style="text-align: center;">
        <div class="badge badge-orange">VERIFICATION</div>
        <h1 class="title">Verify your email</h1>
        <p style="color: #52525b; font-size: 14px; line-height: 1.5; margin: 0 0 24px;">Enter the code below to complete verification. Expires in 10 minutes.</p>
        <div class="card" style="background-color: #fafafa; border-color: #f4f4f5;">
          <div style="font-size: 40px; font-weight: 700; letter-spacing: 8px; color: #FF5C1A; font-family: 'Courier New', monospace;">${otp}</div>
        </div>
        <p style="font-size: 12px; color: #a1a1aa; margin: 0;">Didn't request this? Ignore this email.</p>
      </div>
    `, `Your Erranders code: ${otp}`);
    return this.sendEmail(to, `${otp} is your verification code`, html);
  }

  async sendPasswordResetOTP(to: string, otp: string) {
    const html = this.wrap(`
      <div class="content" style="text-align: center;">
        <div class="badge badge-blue">PASSWORD RESET</div>
        <h1 class="title">Reset your password</h1>
        <p style="color: #52525b; font-size: 14px; line-height: 1.5; margin: 0 0 24px;">Enter this code to set a new password. If you didn't request this, your account is safe.</p>
        <div class="card" style="background-color: #fafafa; border-color: #f4f4f5;">
          <div style="font-size: 40px; font-weight: 700; letter-spacing: 8px; color: #2563EB; font-family: 'Courier New', monospace;">${otp}</div>
        </div>
        <p style="font-size: 12px; color: #a1a1aa; margin: 0;">Your credentials remain secure if you didn't request this.</p>
      </div>
    `, `Reset code: ${otp}`);
    return this.sendEmail(to, `${otp} — Reset Your Password`, html);
  }

  // ─── WELCOME EMAILS ─────────────────────────────────────────────

  async sendWelcomeEmail(to: string, firstName: string) {
    const html = this.wrap(`
      <div class="content">
        <div class="badge badge-orange">WELCOME 🎉</div>
        <h1 class="title">Hey ${firstName}, you're in.</h1>
        <p style="font-size: 14px; line-height: 1.6; color: #52525b; margin: 0 0 24px;">
          Erranders is your campus shortcut — food, essentials, and custom errands, delivered fast.
        </p>
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
          <a href="https://student.erranders.org" class="btn">Start Your First Order</a>
        </div>
      </div>
    `, `Welcome to Erranders, ${firstName}!`);
    return this.sendEmail(to, `Welcome to Erranders, ${firstName}! 🚀`, html);
  }

  async sendVendorWelcome(to: string, firstName: string, storeName: string) {
    const html = this.wrap(`
      <div class="content">
        <div class="badge badge-green">PARTNER ACTIVE</div>
        <h1 class="title">Welcome, ${firstName}.</h1>
        <p style="font-size: 14px; line-height: 1.6; color: #52525b; margin: 0 0 24px;">
          <b>${storeName}</b> is live on Erranders. Thousands of students are ready to discover your products.
        </p>
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
      </div>
    `, `${storeName} is live on Erranders!`);
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

    const html = this.wrap(`
      <div class="content">
        <div class="badge badge-orange">ORDER CONFIRMED</div>
        <h1 class="title">Your order is being prepped!</h1>
        <p style="color: #52525b; font-size: 14px; margin: 0 0 24px;">Order <b>#${order.orderNumber}</b> is confirmed and the vendor is preparing it now.</p>

        <div class="card" style="text-align: left;">
          <p class="card-label" style="margin-bottom: 12px;">Order Summary</p>
          <table class="data-table">
            ${itemsHtml}
            <tr>
              <td style="padding: 16px 0 0; font-size: 14px; font-weight: 600; color: #27272a; border-top: 1px solid #e4e4e7; margin-top: 8px;">Total</td>
              <td style="padding: 16px 0 0; font-size: 16px; font-weight: 700; color: #FF5C1A; text-align: right; border-top: 1px solid #e4e4e7; margin-top: 8px;">₦${order.total?.toLocaleString()}</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center;">
          <a href="https://student.erranders.org/dashboard/orders/${order._id}" class="btn">Track Order</a>
        </div>
      </div>
    `, `Order #${order.orderNumber} confirmed!`);
    return this.sendEmail(to, `🚀 Order Confirmed: #${order.orderNumber}`, html);
  }

  async sendPaymentReceipt(to: string, amount: number, reference: string, method: string = 'Card', senderName: string = 'Erranders User', dateStr?: string) {
    const displayDate = dateStr || new Date().toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const html = this.wrap(`
      <div class="content" style="text-align: center;">
        <div style="width: 48px; height: 48px; background: #ECFDF5; border: 1px solid #10B981; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin: 0 0 16px;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <h1 class="title">Payment Successful</h1>
        <p style="color: #71717a; font-size: 13px; margin: 0 0 24px;">Transaction processed securely.</p>

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

        <a href="https://student.erranders.org/dashboard" class="btn btn-light">Go to Dashboard</a>
      </div>
    `, `Receipt: ₦${amount.toLocaleString()}`);
    return this.sendEmail(to, `✅ Payment Receipt: ₦${amount.toLocaleString()}`, html);
  }

  async sendPaymentSuccess(to: string, amount: number, reference: string) {
    return this.sendPaymentReceipt(to, amount, reference);
  }

  async sendBookingReceipt(to: string, amount: number, reference: string, appointment: any, senderName: string = 'Erranders User') {
    const displayDate = new Date(appointment.scheduledDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const html = this.wrap(`
      <div class="content" style="text-align: center;">
        <div style="width: 48px; height: 48px; background: #ECFDF5; border: 1px solid #10B981; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin: 0 0 16px;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <h1 class="title">Booking Confirmed</h1>
        <p style="color: #71717a; font-size: 13px; margin: 0 0 24px;">Your appointment is booked and paid.</p>

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
        <a href="https://student.erranders.org/manage-booking" class="btn">Manage Booking</a>
      </div>
    `, `Booking Confirmed! Ref: ${reference}`);
    return this.sendEmail(to, `✅ Booking Confirmed: ₦${amount.toLocaleString()}`, html);
  }

  async sendStatusUpdate(to: string, orderNumber: string, status: string, emoji: string = '🚚') {
    const icon = status.includes('PREP') ? '🍳' : (status.includes('TRANSIT') ? '🚲' : (status.includes('DELIVER') ? '✅' : emoji));
    const html = this.wrap(`
      <div class="content" style="text-align: center;">
        <span style="font-size: 48px; display: block; margin: 0 0 16px;">${icon}</span>
        <h1 class="title" style="text-transform: capitalize;">Order ${status.replace(/_/g, ' ').toLowerCase()}</h1>
        <p style="color: #52525b; font-size: 14px; margin: 0 0 24px;">Order <b>#${orderNumber}</b> has been updated.</p>
        <a href="https://student.erranders.org/dashboard/orders" class="btn btn-light">View Order</a>
      </div>
    `, `Order #${orderNumber}: ${status}`);
    return this.sendEmail(to, `Order Update: ${status} — #${orderNumber}`, html);
  }

  async sendOrderStatusUpdate(to: string, orderNumber: string, status: string, note?: string) {
    return this.sendStatusUpdate(to, orderNumber, status);
  }

  async sendOrderDelivered(to: string, order: any) {
    const html = this.wrap(`
      <div class="content" style="text-align: center;">
        <span style="font-size: 48px; display: block; margin: 0 0 16px;">🏁</span>
        <h1 class="title">Order Delivered!</h1>
        <p style="color: #52525b; font-size: 14px; margin: 0 0 24px;">Order <b>#${order.orderNumber}</b> has been delivered. Enjoy!</p>
        <div class="card" style="background: #FFF7ED; border-color: #ffedd5; text-align: left;">
          <p style="font-size: 14px; font-weight: 700; color: #EA580C; margin: 0 0 6px;">Rate your experience ⭐</p>
          <p style="font-size: 13px; color: #9a3412; margin: 0 0 16px; line-height: 1.5;">Ratings help us maintain quality and reward top riders.</p>
          <a href="https://student.erranders.org/dashboard/orders/${order._id}" class="btn" style="padding: 8px 16px; font-size: 12px;">Tap to Rate</a>
        </div>
      </div>
    `, `Order #${order.orderNumber} delivered!`);
    return this.sendEmail(to, `Order Delivered! 🍽️ #${order.orderNumber}`, html);
  }

  // ─── SUPPORT ─────────────────────────────────────────────────────

  async sendComplaintReceipt(to: string, ticketId: string, subject: string) {
    const html = this.wrap(`
      <div class="content">
        <div class="badge badge-orange">SUPPORT TICKET</div>
        <h1 class="title">We're on it.</h1>
        <p style="color: #52525b; font-size: 14px; line-height: 1.5; margin: 0 0 24px;">We received your report regarding "<b>${subject}</b>". Ticket <b>#${ticketId}</b> has been opened.</p>
        <div class="card">
          <p class="card-label">Ticket Reference</p>
          <p class="card-value" style="color: #FF5C1A; font-family: 'Courier New', monospace; font-size: 24px;">ERR-${ticketId}</p>
        </div>
        <p style="font-size: 12px; color: #71717a; text-align: center; margin: 0;">Our team typically responds within 2–4 hours.</p>
      </div>
    `, `Support Ticket #${ticketId}`);
    return this.sendEmail(to, `Support Receipt: #${ticketId}`, html);
  }

  // ─── WALLET & PAYOUTS ───────────────────────────────────────────

  async sendPayoutNotification(to: string, amount: number, description: string) {
    const html = this.wrap(`
      <div class="content" style="text-align: center;">
        <div style="width: 48px; height: 48px; background: #ECFDF5; border: 1px solid #10B981; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin: 0 0 16px;">
          <span style="color: #10B981; font-size: 20px; font-weight: 700;">₦</span>
        </div>
        <h1 class="title">Wallet Credited</h1>
        <p style="font-size: 13px; color: #71717a; margin: 0 0 24px;">You've received a payout in your Erranders wallet.</p>
        <div class="card" style="background: #f0fdf4; border-color: #d1fae5;">
          <p class="card-label" style="color: #059669;">Settlement Amount</p>
          <p class="card-value" style="color: #059669;">+₦${amount.toLocaleString()}</p>
          <p style="font-size: 12px; color: #047857; margin: 0;">${description}</p>
        </div>
        <a href="https://student.erranders.org/dashboard/wallet" class="btn btn-green">View Wallet</a>
      </div>
    `, `You received ₦${amount.toLocaleString()}!`);
    return this.sendEmail(to, `Wallet Credited — ₦${amount.toLocaleString()}`, html);
  }

  // ─── PROMOTIONAL ────────────────────────────────────────────────

  async sendPromotionalEmail(to: string, subject: string, title: string, content: string, ctaText: string, ctaLink: string, image?: string) {
    const html = this.wrap(`
      <div class="content">
        <div class="badge badge-blue">SPECIAL OFFER</div>
        <h1 class="title">${title}</h1>
        ${image ? `<img src="${image}" style="width: 100%; border-radius: 12px; margin: 0 0 24px; display: block; border: 1px solid #e4e4e7;" alt="Promotion">` : ''}
        <p style="font-size: 14px; color: #52525b; line-height: 1.6; margin: 0 0 24px;">${content}</p>
        <div style="text-align: center;">
          <a href="${ctaLink}" class="btn">${ctaText}</a>
        </div>
      </div>
    `, title);
    return this.sendEmail(to, subject, html);
  }

  // ─── AMBASSADOR ─────────────────────────────────────────────────

  async sendFacilitatorWelcomeEmail(to: string, name: string, referralCode: string, skill: string) {
    const firstName = name.split(' ')[0];
    const html = this.wrap(`
      <div class="content">
        <div class="badge badge-purple">CAMPUS AMBASSADOR</div>
        <h1 class="title">Hey ${firstName}, you're in! 💜</h1>
        <p style="font-size: 14px; line-height: 1.6; color: #52525b; margin: 0 0 24px;">
          Every person you bring to Erranders earns you <b>points, rewards, and recognition</b>.
        </p>
        <div class="card" style="background: #fafafa;">
          <p class="card-label" style="color: #FF5C1A;">Your Referral Code</p>
          <p class="card-value" style="font-family: 'Courier New', monospace; letter-spacing: 4px;">${referralCode}</p>
          <p style="font-size: 12px; color: #71717a; margin: 0;">Share with students, vendors, and riders.</p>
        </div>
        <div style="text-align: center;">
          <a href="https://student.erranders.org" class="btn">Start Sharing</a>
        </div>
      </div>
    `, `Your referral code: ${referralCode}`);
    return this.sendEmail(to, `Welcome to the Squad, ${firstName}! Code: ${referralCode}`, html);
  }
}
