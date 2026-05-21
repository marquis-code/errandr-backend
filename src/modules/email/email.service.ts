import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend | null;
  private fromEmail = 'Erranders <notifications@erranders.org>';
  private primaryColor = '#0061FF';
  private secondaryColor = '#FBBF24';
  private logoUrl = 'https://erranders.org/_nuxt/logo.7u_gNOaX.png';

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
      console.log(`\x1b[35m[EMAIL_AGENT]\x1b[0m 📝 Preview available in development logs.`);
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
    } catch (err) {
      console.error(`\x1b[31m[EMAIL_AGENT] ❌ Fatal Error: ${err.message}\x1b[0m`);
      throw new InternalServerErrorException(err.message || 'Email delivery failed');
    }
  }

  private getBaseStyles() {
    return `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800&display=swap');
        body { font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F7F7F5; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 40px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.05); }
        .header-banner { background: #FFD700; padding: 0; text-align: center; line-height: 0; }
        .content { padding: 48px; color: #1A1A1A; }
        .footer { padding: 64px 48px; text-align: center; color: #8F8F8F; font-size: 13px; background: #1A1A1A; }
        .button { display: inline-block; padding: 20px 40px; background: #1A1A1A; color: #ffffff !important; text-decoration: none; border-radius: 24px; font-weight: 800; font-size: 14px; text-transform: uppercase; letter-spacing: 2px; }
        .item-card { background: #F9FAFB; border-radius: 32px; padding: 24px; margin-bottom: 24px; border: 1px solid #F3F4F6; }
        .receipt-card { background: #1A1A1A; border-radius: 40px; padding: 40px; color: #ffffff; margin-top: 40px; }
        .label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #8F8F8F; margin-bottom: 12px; display: block; }
        .title { font-size: 36px; font-weight: 800; line-height: 1.1; letter-spacing: -1.5px; margin-bottom: 24px; color: #1A1A1A; }
        .otp-box { background: #F3F4F6; border-radius: 32px; padding: 40px; text-align: center; margin: 40px 0; border: 3px dashed #E5E7EB; }
        .otp-code { font-size: 56px; font-weight: 800; letter-spacing: 12px; color: #1A1A1A; font-family: 'Courier New', Courier, monospace; }
        .badge { display: inline-block; padding: 8px 16px; border-radius: 12px; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 24px; }
        .badge-blue { background: #E0E7FF; color: #4338CA; }
        .badge-yellow { background: #FEF9C3; color: #A16207; }
        .badge-green { background: #DCFCE7; color: #15803D; }
      </style>
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
        <body>
          <div style="display: none; max-height: 0px; overflow: hidden;">${preheader}</div>
          <div class="container">
            ${content}
            <div class="footer">
              <img src="${this.logoUrl}" style="height: 36px; margin-bottom: 32px; filter: brightness(0) invert(1);" alt="Erranders">
              <p style="color: #ffffff; font-weight: 800; font-size: 18px; margin-bottom: 16px;">Erranders — Campus life, elevated.</p>
              <p style="margin-bottom: 32px; line-height: 1.6; opacity: 0.7;">We're on a mission to make every delivery on campus seamless, fast, and aggressively convenient.</p>
              <div style="margin-top: 40px;">
                <a href="https://instagram.com/erranders_ng" style="margin: 0 12px; text-decoration: none;"><img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" width="24" style="filter: brightness(0) invert(1); opacity: 0.6;"></a>
                <a href="https://twitter.com/erranders_ng" style="margin: 0 12px; text-decoration: none;"><img src="https://cdn-icons-png.flaticon.com/512/733/733579.png" width="24" style="filter: brightness(0) invert(1); opacity: 0.6;"></a>
              </div>
              <p style="margin-top: 64px; opacity: 0.4; font-size: 11px;">© ${new Date().getFullYear()} Erranders Ltd. Lagos, Nigeria.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  // LOGS & SYSTEM
  async sendAuthOTP(to: string, otp: string) { return this.sendVerificationOTP(to, otp); }

  async sendSignupOTP(to: string, firstName: string, otp: string) {
    return this.sendVerificationOTP(to, otp);
  }

  async sendVerificationOTP(to: string, otp: string) {
    const html = this.wrap(`
      <div class="content" style="text-align: center;">
        <div class="badge badge-yellow">SECURITY CHECK</div>
        <h1 class="title">Verify your email</h1>
        <p style="color: #6B7280; font-size: 16px; line-height: 1.6;">Use the code below to complete your sign-up. This code expires in 10 minutes to keep your account aggressive and secure.</p>
        
        <div class="otp-box">
          <div class="otp-code">${otp}</div>
        </div>
        
        <p style="font-size: 13px; color: #9CA3AF;">Didn't request this code? You can safely ignore this email.</p>
      </div>
    `, `Your Erranders verify code: ${otp}`);
    return this.sendEmail(to, `${otp} is your verification code`, html);
  }

  async sendPasswordResetOTP(to: string, otp: string) {
    const html = this.wrap(`
      <div class="content" style="text-align: center;">
        <div class="badge badge-blue">PASSWORD RESET</div>
        <h1 class="title">Securing your account</h1>
        <p style="color: #6B7280; font-size: 16px;">Enter the code below to reset your Erranders password. If you didn't ask for this, your account is still safe, and you can ignore this.</p>
        
        <div class="otp-box" style="border-color: #DBEAFE; background: #EFF6FF;">
          <div class="otp-code" style="color: #1E40AF;">${otp}</div>
        </div>
      </div>
    `, `Reset your password with code: ${otp}`);
    return this.sendEmail(to, `${otp} — Reset Your Password`, html);
  }

  // WELCOME
  async sendWelcomeEmail(to: string, firstName: string) {
    const html = this.wrap(`
      <div class="header-banner">
        <img src="https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=1000" style="width: 100%; height: 300px; object-fit: cover;" />
      </div>
      <div class="content">
        <div class="badge badge-blue">YOU'RE LEGIT 🎉</div>
        <h1 class="title">Welcome home,<br/>${firstName}.</h1>
        <p style="font-size: 17px; line-height: 1.8; color: #4B5563; margin-bottom: 32px;">
          Erranders is officially in your pocket. We built this to solve the campus hustle – so you can focus on classes (or naps) while we handle the moves.
        </p>
        
        <div class="item-card" style="background: #F0F9FF; border-color: #BAE6FD;">
          <h3 style="margin-top: 0; color: #0369A1; font-weight: 800;">Your Erranders Staples:</h3>
          <p style="margin: 8px 0; color: #0C4A6E;">🍔 <b>Campus Bites:</b> The best spots on campus, delivered fast.</p>
          <p style="margin: 8px 0; color: #0C4A6E;">🚲 <b>Quick Errands:</b> Need a printout or a grocery run? We're on it.</p>
          <p style="margin: 8px 0; color: #0C4A6E;">💰 <b>Wallet:</b> Cashless is better. Fund your wallet and checkout in 1-tap.</p>
        </div>

        <div style="text-align: center; margin-top: 48px;">
          <a href="https://erranders.org" class="button">START YOUR FIRST ORDER</a>
        </div>
      </div>
    `, `Welcome to the Erranders family, ${firstName}!`);
    return this.sendEmail(to, `Welcome to Erranders, ${firstName}! 🚀`, html);
  }

  async sendVendorWelcome(to: string, firstName: string, storeName: string) {
    const html = this.wrap(`
      <div class="header-banner">
        <img src="https://images.unsplash.com/photo-1556742044-3c52d6e88c62?w=1000" style="width: 100%; height: 300px; object-fit: cover;" />
      </div>
      <div class="content">
        <div class="badge badge-green">PARTNER STATUS: ACTIVE</div>
        <h1 class="title">Welcome to the inner circle, ${firstName}.</h1>
        <p style="font-size: 17px; line-height: 1.7; color: #4B5563;">
          Setting up <b>${storeName}</b> is a power move. We're ready to show your products to thousands of students across campus. 
        </p>
        
        <div style="margin: 40px 0; border-left: 6px solid #1A1A1A; padding-left: 24px;">
           <p style="font-style: ; color: #6B7280; font-size: 16px;">"The future of campus commerce is digital, and you're leading the charge."</p>
        </div>

        <div style="text-align: center;">
          <a href="https://vendor.erranders.org" class="button">MANAGE MY STORE</a>
        </div>
      </div>
    `, `Welcome Partner! Your store ${storeName} is ready.`);
    return this.sendEmail(to, `Welcome to Erranders Vendors, ${firstName}! 🏠`, html);
  }

  // ORDERS & PAYMENTS
  async sendOrderConfirmation(to: string, order: any) {
    const itemsHtml = order.items?.map(item => `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 1px solid #F3F4F6;">
        <div style="display: flex; align-items: center; gap: 16px;">
           <div style="width: 64px; height: 64px; background: #F9FAFB; border-radius: 20px; display: flex; align-items: center; justify-content: center; font-weight: 800; overflow: hidden; border: 1px solid #F3F4F6;">
              ${item.image ? `<img src="${item.image}" style="width: 100%; height: 100%; object-fit: cover;">` : '🍴'}
           </div>
           <div>
              <p style="margin: 0; font-weight: 800; font-size: 14px; color: #1A1A1A;">${item.name}</p>
              <p style="margin: 4px 0 0; font-size: 12px; color: #8F8F8F; font-weight: 600;">Quantity: ${item.quantity}</p>
           </div>
        </div>
        <p style="margin: 0; font-weight: 800; font-size: 16px; color: #1A1A1A; letter-spacing: -0.5px;">₦${(item.price * item.quantity).toLocaleString()}</p>
      </div>
    `).join('') || '';

    const html = this.wrap(`
      <div class="content">
        <div class="badge badge-yellow" style="background: #FFF7ED; color: #C2410C;">RESTAURANT CONFIRMED</div>
        <h1 class="title">It's on, ${order.customerName?.split(' ')[0] || 'Erranders User'}! 🍔</h1>
        <p style="color: #6B7280; font-size: 17px; line-height: 1.6; margin-bottom: 40px;">Your order <b>#${order.orderNumber}</b> is officially being prepped. Our dispatchers have been alerted and are standing by.</p>
        
        <img src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1000&auto=format&fit=crop&q=80" style="width: 100%; height: 240px; object-fit: cover; border-radius: 32px; margin-bottom: 48px; box-shadow: 0 20px 40px rgba(0,0,0,0.1);">

        <div class="item-card" style="padding: 32px;">
          <span class="label" style="margin-bottom: 24px;">ORDER SUMMARY</span>
          <div style="margin-bottom: 32px;">
            ${itemsHtml}
          </div>
          
          <div style="background: #F9FAFB; border-radius: 24px; padding: 24px;">
             <div style="display: flex; justify-content: space-between; font-size: 14px; color: #6B7280; margin-bottom: 12px;">
                <span font-weight: 600;>Subtotal</span>
                <span>₦${order.subtotal?.toLocaleString()}</span>
             </div>
             <div style="display: flex; justify-content: space-between; font-size: 14px; color: #6B7280; margin-bottom: 12px;">
                <span font-weight: 600;>Delivery Fee</span>
                <span>₦${order.deliveryFee?.toLocaleString() || 0}</span>
             </div>
             <div style="display: flex; justify-content: space-between; font-size: 14px; color: #6B7280; margin-bottom: 12px;">
                <span font-weight: 600;>Packaging & Fees</span>
                <span>₦${((order.packagingFee || 0) + (order.serviceFee || 0)).toLocaleString()}</span>
             </div>
             <div style="display: flex; justify-content: space-between; font-size: 22px; font-weight: 800; color: #1A1A1A; margin-top: 20px; padding-top: 20px; border-top: 2px dashed #E5E7EB;">
                <span>Total</span>
                <span>₦${order.total?.toLocaleString()}</span>
             </div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 48px;">
          <a href="https://erranders.org/dashboard/orders/${order.orderNumber || order._id}" class="button" style="background: #1A1A1A; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">TRACK MY CHOP 🚀</a>
        </div>
        
        <div style="margin-top: 64px; text-align: center;">
          <p style="font-size: 12px; color: #9CA3AF; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Delivery Address</p>
          <p style="font-size: 14px; color: #1A1A1A; font-weight: 800; margin-top: 8px;">${order.deliveryAddress || 'Campus Pickup'}</p>
        </div>
      </div>
    `, `Your order #${order.orderNumber} is being prepared!`);
    return this.sendEmail(to, `🚀 Order Confirmed: #${order.orderNumber}`, html);
  }

  async sendPaymentReceipt(to: string, amount: number, reference: string, method: string = 'card') {
    const isTopup = reference.includes('TOPUP') || method === 'wallet_topup';
    const html = this.wrap(`
      <div class="content">
        <div style="text-align: center; margin-bottom: 40px;">
          <div style="width: 80px; height: 80px; background: ${isTopup ? '#DCFCE7' : '#EFF6FF'}; border-radius: 30px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 24px;">
            <span style="font-size: 40px;">${isTopup ? '💰' : '💸'}</span>
          </div>
          <h1 class="title">${isTopup ? 'Wallet Funded!' : 'Payment Received!'}</h1>
          <p style="color: #6B7280; font-size: 16px;">${isTopup ? 'Your Erranders balance has been aggressively updated.' : 'Your order payment has been verified and confirmed.'}</p>
        </div>

        <div class="receipt-card" style="background: ${isTopup ? '#10B981' : '#1A1A1A'};">
          <span class="label" style="color: ${isTopup ? 'rgba(255,255,255,0.7)' : '#E5E7EB'};">${isTopup ? 'ADDED TO WALLET' : 'AMOUNT PAID'}</span>
          <h2 style="font-size: 56px; font-weight: 800; margin: 8px 0; letter-spacing: -3px;">₦${amount.toLocaleString()}</h2>
          <p style="color: rgba(255,255,255,0.6); font-size: 11px; text-transform: uppercase; letter-spacing: 2px; font-weight: 800;">${isTopup ? 'READY TO SPEND' : `VIA ${method.toUpperCase()}`}</p>
          
          <div style="margin-top: 40px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 32px;">
             <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 12px; opacity: 0.8;">
                <span style="font-weight: 600;">Reference</span>
                <span style="font-family: monospace; font-weight: 800;">${reference}</span>
             </div>
             <div style="display: flex; justify-content: space-between; font-size: 14px; opacity: 0.8;">
                <span style="font-weight: 600;">Status</span>
                <span style="color: #ffffff; font-weight: 800; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 8px; font-size: 10px;">SUCCESS</span>
             </div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 48px;">
          <a href="https://erranders.org/dashboard${isTopup ? '/wallet' : '/orders'}" class="button" style="background: #1A1A1A;">${isTopup ? 'VIEW MY BALANCE' : 'TRACK MY ORDER'}</a>
        </div>
      </div>
    `, `Success! We've confirmed your payment of ₦${amount.toLocaleString()}`);
    return this.sendEmail(to, `${isTopup ? '💰 Wallet Funded' : '✅ Payment Received'}: ₦${amount.toLocaleString()}`, html);
  }

  async sendPaymentSuccess(to: string, amount: number, reference: string) {
    return this.sendPaymentReceipt(to, amount, reference);
  }

  async sendStatusUpdate(to: string, orderNumber: string, status: string, emoji: string = '🚚') {
    const html = this.wrap(`
      <div class="content" style="text-align: center;">
        <span style="font-size: 72px; margin-bottom: 24px; display: block;">${emoji === '🚚' && status.includes('PREP') ? '🍳' : (status.includes('TRANSIT') ? '🚲' : emoji)}</span>
        <h1 class="title">Moving fast!<br/>Your order is ${status.replace(/_/g, ' ')}.</h1>
        <p style="color: #6B7280; font-size: 16px; line-height: 1.6;">Good things coming your way. Your order <b>#${orderNumber}</b> has been aggressively updated to its next stage.</p>
        
        <div style="margin: 48px 0; text-align: center;">
          <a href="https://student.erranders.org/orders/${orderNumber}" class="button">VIEW LIVE TRACKING</a>
        </div>
      </div>
    `, `Update for order #${orderNumber}: ${status}`);
    return this.sendEmail(to, `Order Update: ${status} — Erranders`, html);
  }

  async sendOrderStatusUpdate(to: string, orderNumber: string, status: string, note?: string) {
    return this.sendStatusUpdate(to, orderNumber, status);
  }

  async sendOrderDelivered(to: string, order: any) {
    const html = this.wrap(`
      <div class="content" style="text-align: center;">
        <img src="https://images.unsplash.com/photo-1526367790999-0150786486a9?w=800" style="width: 100%; border-radius: 40px; margin-bottom: 40px; box-shadow: 0 30px 60px rgba(0,0,0,0.1);">
        <h1 class="title">Order Handed Over! 🏁</h1>
        <p style="color: #6B7280; font-size: 16px; line-height: 1.6;">Your order <b>#${order.orderNumber}</b> has been delivered. We hope you have an aggressive appetite!</p>
        
        <div style="margin: 48px 0; background: #FFD700; border-radius: 40px; padding: 40px; text-align: left;">
          <h2 style="margin-top: 0; font-size: 24px; font-weight: 800;">Was it legendary? ⭐</h2>
          <p style="margin-bottom: 32px; font-weight: 600;">Rating your experience helps us keep Erranders standard and rewards our top dispatchers.</p>
          <a href="https://erranders.org/orders/${order.orderNumber}/rate" style="background: #1A1A1A; color: #ffffff; padding: 16px 32px; border-radius: 16px; text-decoration: none; font-weight: 800; font-size: 13px;">TAP TO RATE</a>
        </div>
      </div>
    `, `Order #${order.orderNumber} successfully delivered!`);
    return this.sendEmail(to, `Order Delivered! Enjoy 🍽️ — #${order.orderNumber}`, html);
  }

  async sendComplaintReceipt(to: string, ticketId: string, subject: string) {
    const html = this.wrap(`
      <div class="content">
        <div class="badge badge-yellow" style="background: #FEE2E2; color: #B91C1C;">SUPPORT TICKET</div>
        <h1 class="title">We're on the case. 🛠️</h1>
        <p style="color: #6B7280; font-size: 16px; line-height: 1.6;">We recieved your report regarding <b>"${subject}"</b>. Our support leads have opened ticket <b>#${ticketId}</b> and are diving in aggressively.</p>
        
        <div class="otp-box" style="border-color: #FECACA; background: #FEF2F2; padding: 32px;">
           <span class="label">TICKET REFERENCE</span>
           <div style="font-size: 28px; font-weight: 800; color: #B91C1C; font-family: monospace;">ERR-${ticketId}</div>
        </div>
        
        <p style="color: #9CA3AF; font-size: 13px;">Hang tight! We usually resolve campus issues within a few clock cycles.</p>
      </div>
    `, `Re: ${subject} [Ticket #${ticketId}] - We've received your report.`);
    return this.sendEmail(to, `Support Receipt: #${ticketId} — Erranders`, html);
  }

  async sendPayoutNotification(to: string, amount: number, description: string) {
    const html = this.wrap(`
      <div class="content" style="text-align: center;">
        <div style="font-size: 64px; margin-bottom: 24px;">💰</div>
        <h1 class="title">Wallet Credited!</h1>
        <p style="font-size: 16px; color: #6B7280;">You've just received a payout in your Erranders wallet.</p>
        
        <div class="item-card" style="background: #10B981; border: none; color: #ffffff;">
           <span class="label" style="color: rgba(255,255,255,0.6);">SETTLEMENT AMOUNT</span>
           <h2 style="font-size: 40px; font-weight: 800; margin: 8px 0;">+₦${amount.toLocaleString()}</h2>
           <p style="font-size: 13px; opacity: 0.9;">${description}</p>
        </div>
        
        <a href="https://erranders.org/wallet" class="button">VIEW WALLET</a>
      </div>
    `, `You've received ₦${amount.toLocaleString()}!`);
    return this.sendEmail(to, `Wallet Credited — Erranders`, html);
  }

  async sendPromotionalEmail(to: string, subject: string, title: string, content: string, ctaText: string, ctaLink: string, image?: string) {
    const html = this.wrap(`
      <div class="content">
        <div class="badge badge-blue">OFFER INSIDE 🎁</div>
        <h1 class="title">${title}</h1>
        ${image ? `<img src="${image}" style="width: 100%; border-radius: 32px; margin-bottom: 24px;" alt="Promotion">` : ''}
        <p style="font-size: 16px; color: #4B5563; line-height: 1.6;">${content}</p>
        <div style="text-align: center; margin-top: 40px;">
          <a href="${ctaLink}" class="button">${ctaText}</a>
        </div>
        <p style="font-size: 12px; color: #9CA3AF; text-align: center; margin-top: 48px;">Don't want these emails? Manage settings in your profile.</p>
      </div>
    `, title);
    return this.sendEmail(to, subject, html);
  }
}
