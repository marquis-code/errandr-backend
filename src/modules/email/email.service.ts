import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private resend: Resend | null;
  private fromEmail = 'Erranders <notifications@erranders.org>';
  private primaryColor = '#FF5C1A'; // Erranders Orange
  private secondaryColor = '#0F172A'; // Sleek Slate
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
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800&display=swap');
        body { 
          font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
          background-color: #F8FAFC; 
          margin: 0; 
          padding: 0; 
          -webkit-font-smoothing: antialiased; 
        }
        .container { 
          max-width: 600px; 
          width: 100%;
          margin: 30px auto; 
          background-color: #ffffff; 
          border-radius: 24px; 
          overflow: hidden; 
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05); 
          border: 1px solid #E2E8F0;
        }
        .header-banner { 
          background: linear-gradient(135deg, #FF5C1A 0%, #FF8F50 100%); 
          padding: 0; 
          text-align: center; 
          line-height: 0; 
        }
        .content { 
          padding: 40px 32px; 
          color: #1E293B; 
        }
        .footer { 
          padding: 48px 32px; 
          text-align: center; 
          color: #94A3B8; 
          font-size: 13px; 
          background-color: #0F172A; 
        }
        .button { 
          display: inline-block; 
          padding: 16px 36px; 
          background-color: #FF5C1A; 
          color: #ffffff !important; 
          text-decoration: none; 
          border-radius: 12px; 
          font-weight: 700; 
          font-size: 14px; 
          text-transform: uppercase; 
          letter-spacing: 1.5px;
          text-align: center;
          transition: all 0.2s ease;
        }
        .item-card { 
          background-color: #F8FAFC; 
          border-radius: 16px; 
          padding: 20px; 
          margin-bottom: 20px; 
          border: 1px solid #E2E8F0; 
        }
        .receipt-card { 
          background-color: #0F172A; 
          border-radius: 20px; 
          padding: 32px; 
          color: #ffffff; 
          margin-top: 32px; 
        }
        .label { 
          font-size: 11px; 
          font-weight: 800; 
          text-transform: uppercase; 
          letter-spacing: 1.5px; 
          color: #64748B; 
          margin-bottom: 8px; 
          display: block; 
        }
        .title { 
          font-size: 32px; 
          font-weight: 800; 
          line-height: 1.2; 
          letter-spacing: -1px; 
          margin-bottom: 20px; 
          color: #0F172A; 
        }
        .otp-box { 
          background-color: #FFF7ED; 
          border-radius: 16px; 
          padding: 32px; 
          text-align: center; 
          margin: 30px 0; 
          border: 2px dashed #FFD8A8; 
        }
        .otp-code { 
          font-size: 48px; 
          font-weight: 800; 
          letter-spacing: 10px; 
          color: #FF5C1A; 
          font-family: monospace; 
        }
        .badge { 
          display: inline-block; 
          padding: 6px 12px; 
          border-radius: 8px; 
          font-size: 11px; 
          font-weight: 700; 
          text-transform: uppercase; 
          margin-bottom: 16px; 
        }
        .badge-orange { 
          background-color: #FFF7ED; 
          color: #EA580C; 
          border: 1px solid #FFEDD5; 
        }
        .badge-blue { 
          background-color: #EFF6FF; 
          color: #2563EB; 
          border: 1px solid #DBEAFE; 
        }
        .badge-green { 
          background-color: #ECFDF5; 
          color: #059669; 
          border: 1px solid #D1FAE5; 
        }
        
        @media only screen and (max-width: 600px) {
          .container {
            margin: 0 auto !important;
            border-radius: 0px !important;
            border: none !important;
            width: 100% !important;
            max-width: 100% !important;
          }
          .content {
            padding: 30px 20px !important;
          }
          .footer {
            padding: 40px 20px !important;
          }
          .title {
            font-size: 26px !important;
          }
          .otp-code {
            font-size: 36px !important;
            letter-spacing: 6px !important;
          }
          .button {
            display: block !important;
            width: 100% !important;
            box-sizing: border-box !important;
            padding: 16px 20px !important;
          }
        }
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
        <body style="margin: 0; padding: 0; background-color: #F8FAFC;">
          <div style="display: none; max-height: 0px; overflow: hidden; opacity: 0;">${preheader}</div>
          <div class="container" style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #E2E8F0;">
            ${content}
            <div class="footer" style="padding: 48px 32px; text-align: center; color: #94A3B8; font-size: 13px; background-color: #0F172A !important;">
              <img src="${this.logoUrl}" style="height: 36px; margin-bottom: 24px; filter: brightness(0) invert(1);" alt="Erranders">
              <p style="color: #ffffff !important; font-weight: 800; font-size: 16px; margin-bottom: 12px; margin-top: 0;">Erranders — Campus life, elevated.</p>
              <p style="margin-bottom: 24px; line-height: 1.6; opacity: 0.7; color: #94A3B8;">We're on a mission to make every delivery on campus seamless, fast, and aggressively convenient.</p>
              <div style="margin-top: 30px;">
                <a href="https://instagram.com/erranders_ng" style="margin: 0 12px; text-decoration: none; display: inline-block;"><img src="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" width="20" style="filter: brightness(0) invert(1); opacity: 0.6;"></a>
                <a href="https://twitter.com/erranders_ng" style="margin: 0 12px; text-decoration: none; display: inline-block;"><img src="https://cdn-icons-png.flaticon.com/512/733/733579.png" width="20" style="filter: brightness(0) invert(1); opacity: 0.6;"></a>
              </div>
              <p style="margin-top: 48px; opacity: 0.4; font-size: 11px; color: #94A3B8;">© ${new Date().getFullYear()} Erranders Ltd. Lagos, Nigeria.</p>
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
        <div class="badge badge-orange">SECURITY CHECK</div>
        <h1 class="title">Verify your email</h1>
        <p style="color: #64748B; font-size: 16px; line-height: 1.6; margin-top: 0; margin-bottom: 24px;">Use the code below to complete your sign-up. This code expires in 10 minutes to keep your account secure.</p>
        
        <div class="otp-box">
          <div class="otp-code">${otp}</div>
        </div>
        
        <p style="font-size: 13px; color: #94A3B8; margin-top: 24px; margin-bottom: 0;">Didn't request this code? You can safely ignore this email.</p>
      </div>
    `, `Your Erranders verify code: ${otp}`);
    return this.sendEmail(to, `${otp} is your verification code`, html);
  }

  async sendPasswordResetOTP(to: string, otp: string) {
    const html = this.wrap(`
      <div class="content" style="text-align: center;">
        <div class="badge badge-blue">PASSWORD RESET</div>
        <h1 class="title">Securing your account</h1>
        <p style="color: #64748B; font-size: 16px; line-height: 1.6; margin-top: 0; margin-bottom: 24px;">Enter the code below to reset your Erranders password. If you didn't ask for this, your account is still safe, and you can ignore this.</p>
        
        <div class="otp-box" style="border-color: #BFDBFE; background-color: #F0F6FF;">
          <div class="otp-code" style="color: #2563EB;">${otp}</div>
        </div>
        
        <p style="font-size: 13px; color: #94A3B8; margin-top: 24px; margin-bottom: 0;">If you didn't request a password reset, your credentials remain secure.</p>
      </div>
    `, `Reset your password with code: ${otp}`);
    return this.sendEmail(to, `${otp} — Reset Your Password`, html);
  }

  // WELCOME
  async sendWelcomeEmail(to: string, firstName: string) {
    const html = this.wrap(`
      <div class="header-banner" style="background: linear-gradient(135deg, #FF5C1A 0%, #FF8F50 100%);">
        <img src="https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=1000" style="width: 100%; height: 240px; object-fit: cover; opacity: 0.9;" />
      </div>
      <div class="content">
        <div class="badge badge-orange">YOU'RE LEGIT 🎉</div>
        <h1 class="title">Welcome home,<br/>${firstName}.</h1>
        <p style="font-size: 16px; line-height: 1.7; color: #475569; margin-bottom: 32px; margin-top: 0;">
          Erranders is officially in your pocket. We built this to solve the campus hustle – so you can focus on classes (or naps) while we handle the moves.
        </p>
        
        <div class="item-card" style="background-color: #FFF7ED; border-color: #FFEDD5;">
          <h3 style="margin-top: 0; color: #EA580C; font-weight: 800; font-size: 16px; margin-bottom: 12px;">Your Erranders Staples:</h3>
          <p style="margin: 8px 0; color: #9A3412; font-size: 14px;">🍔 <b>Campus Bites:</b> The best spots on campus, delivered fast.</p>
          <p style="margin: 8px 0; color: #9A3412; font-size: 14px;">🚲 <b>Quick Errands:</b> Need a printout or a grocery run? We're on it.</p>
          <p style="margin: 8px 0; color: #9A3412; font-size: 14px;">💰 <b>Wallet:</b> Cashless is better. Fund your wallet and checkout in 1-tap.</p>
        </div>

        <div style="text-align: center; margin-top: 40px;">
          <a href="https://student.erranders.org" class="button" style="box-shadow: 0 10px 20px rgba(255,92,26,0.15);">START YOUR FIRST ORDER</a>
        </div>
      </div>
    `, `Welcome to the Erranders family, ${firstName}!`);
    return this.sendEmail(to, `Welcome to Erranders, ${firstName}! 🚀`, html);
  }

  async sendVendorWelcome(to: string, firstName: string, storeName: string) {
    const html = this.wrap(`
      <div class="header-banner" style="background: linear-gradient(135deg, #059669 0%, #34D399 100%);">
        <img src="https://images.unsplash.com/photo-1556742044-3c52d6e88c62?w=1000" style="width: 100%; height: 240px; object-fit: cover; opacity: 0.9;" />
      </div>
      <div class="content">
        <div class="badge badge-green">PARTNER STATUS: ACTIVE</div>
        <h1 class="title">Welcome to the inner circle, ${firstName}.</h1>
        <p style="font-size: 16px; line-height: 1.7; color: #475569; margin-top: 0; margin-bottom: 24px;">
          Setting up <b>${storeName}</b> is a power move. We're ready to show your products to thousands of students across campus. 
        </p>
        
        <div style="margin: 30px 0; border-left: 4px solid #FF5C1A; padding-left: 20px; background-color: #F8FAFC; padding-top: 12px; padding-bottom: 12px; border-radius: 0 12px 12px 0;">
           <p style="font-style: italic; color: #64748B; font-size: 15px; line-height: 1.6; margin: 0;">"The future of campus commerce is digital, and you're leading the charge."</p>
        </div>

        <div style="text-align: center; margin-top: 32px;">
          <a href="https://vendor.erranders.org" class="button" style="background-color: #059669; box-shadow: 0 10px 20px rgba(5,150,105,0.15);">MANAGE MY STORE</a>
        </div>
      </div>
    `, `Welcome Partner! Your store ${storeName} is ready.`);
    return this.sendEmail(to, `Welcome to Erranders Vendors, ${firstName}! 🏠`, html);
  }

  // ORDERS & PAYMENTS
  async sendOrderConfirmation(to: string, order: any) {
    const itemsHtml = order.items?.map(item => `
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #E2E8F0;">
        <div style="display: flex; align-items: center; gap: 12px;">
           <div style="width: 54px; height: 54px; background-color: #F8FAFC; border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden; border: 1px solid #E2E8F0; vertical-align: middle;">
              ${item.image ? `<img src="${item.image}" style="width: 100%; height: 100%; object-fit: cover;">` : '🍴'}
           </div>
           <div style="margin-left: 12px; display: inline-block; vertical-align: middle;">
              <p style="margin: 0; font-weight: 700; font-size: 14px; color: #0F172A;">${item.name}</p>
              <p style="margin: 4px 0 0; font-size: 12px; color: #64748B; font-weight: 600;">Quantity: ${item.quantity}</p>
           </div>
        </div>
        <p style="margin: 0; font-weight: 700; font-size: 15px; color: #0F172A;">₦${(item.price * item.quantity).toLocaleString()}</p>
      </div>
    `).join('') || '';

    const html = this.wrap(`
      <div class="content">
        <div class="badge badge-orange">RESTAURANT CONFIRMED</div>
        <h1 class="title">It's on, ${order.customerName?.split(' ')[0] || 'Erranders User'}! 🍔</h1>
        <p style="color: #64748B; font-size: 16px; line-height: 1.6; margin-bottom: 30px; margin-top: 0;">Your order <b>#${order.orderNumber}</b> is officially being prepped. Our dispatchers are standing by.</p>
        
        <img src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1000&auto=format&fit=crop&q=80" style="width: 100%; height: 200px; object-fit: cover; border-radius: 20px; margin-bottom: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">

        <div class="item-card" style="padding: 24px;">
          <span class="label" style="margin-bottom: 16px;">ORDER SUMMARY</span>
          <div style="margin-bottom: 24px;">
            ${itemsHtml}
          </div>
          
          <div style="background-color: #F8FAFC; border-radius: 16px; padding: 20px; border: 1px solid #E2E8F0;">
             <div style="display: flex; justify-content: space-between; font-size: 14px; color: #64748B; margin-bottom: 10px;">
                <span>Subtotal</span>
                <span style="font-weight: 600; color: #0F172A;">₦${order.subtotal?.toLocaleString()}</span>
             </div>
             <div style="display: flex; justify-content: space-between; font-size: 14px; color: #64748B; margin-bottom: 10px;">
                <span>Delivery Fee</span>
                <span style="font-weight: 600; color: #0F172A;">₦${order.deliveryFee?.toLocaleString() || 0}</span>
             </div>
             <div style="display: flex; justify-content: space-between; font-size: 14px; color: #64748B; margin-bottom: 10px;">
                <span>Packaging & Fees</span>
                <span style="font-weight: 600; color: #0F172A;">₦${((order.packagingFee || 0) + (order.serviceFee || 0)).toLocaleString()}</span>
             </div>
             <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 800; color: #FF5C1A; margin-top: 16px; padding-top: 16px; border-top: 2px dashed #E2E8F0;">
                <span>Total</span>
                <span>₦${order.total?.toLocaleString()}</span>
             </div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 32px;">
          <a href="https://student.erranders.org/dashboard/orders/${order._id}" class="button" style="box-shadow: 0 10px 20px rgba(255,92,26,0.15);">TRACK MY CHOP 🚀</a>
        </div>
        
        <div style="margin-top: 48px; text-align: center;">
          <p style="font-size: 11px; color: #64748B; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 4px;">Delivery Address</p>
          <p style="font-size: 14px; color: #0F172A; font-weight: 700; margin-top: 0;">${order.deliveryAddress || 'Campus Pickup'}</p>
        </div>
      </div>
    `, `Your order #${order.orderNumber} is being prepared!`);
    return this.sendEmail(to, `🚀 Order Confirmed: #${order.orderNumber}`, html);
  }

  async sendPaymentReceipt(to: string, amount: number, reference: string, method: string = 'card') {
    const isTopup = reference.includes('TOPUP') || method === 'wallet_topup';
    const html = this.wrap(`
      <div class="content">
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="width: 70px; height: 70px; background-color: ${isTopup ? '#ECFDF5' : '#FFF7ED'}; border-radius: 20px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
            <span style="font-size: 32px;">${isTopup ? '💰' : '💸'}</span>
          </div>
          <h1 class="title">${isTopup ? 'Wallet Funded!' : 'Payment Received!'}</h1>
          <p style="color: #64748B; font-size: 16px; margin-top: 0; margin-bottom: 24px;">${isTopup ? 'Your Erranders balance has been updated.' : 'Your order payment has been verified and confirmed.'}</p>
        </div>

        <div class="receipt-card" style="background-color: ${isTopup ? '#059669' : '#0F172A'}; padding: 30px; border-radius: 20px; color: #ffffff; text-align: center;">
          <span class="label" style="color: rgba(255,255,255,0.7);">${isTopup ? 'ADDED TO WALLET' : 'AMOUNT PAID'}</span>
          <h2 style="font-size: 44px; font-weight: 800; margin: 8px 0; letter-spacing: -2px; color: #ffffff;">₦${amount.toLocaleString()}</h2>
          <p style="color: rgba(255,255,255,0.6); font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 800; margin-bottom: 0;">${isTopup ? 'READY TO SPEND' : `VIA ${method.toUpperCase()}`}</p>
          
          <div style="margin-top: 30px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px;">
             <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 10px; opacity: 0.8;">
                <span style="font-weight: 500;">Reference</span>
                <span style="font-family: monospace; font-weight: 700;">${reference}</span>
             </div>
             <div style="display: flex; justify-content: space-between; font-size: 14px; opacity: 0.8;">
                <span style="font-weight: 500;">Status</span>
                <span style="color: #ffffff; font-weight: 700; background: rgba(255,255,255,0.2); padding: 4px 10px; border-radius: 6px; font-size: 10px;">SUCCESS</span>
             </div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 32px;">
          <a href="https://student.erranders.org/dashboard${isTopup ? '/wallet' : '/orders'}" class="button" style="box-shadow: 0 10px 20px rgba(255,92,26,0.15);">${isTopup ? 'VIEW MY BALANCE' : 'TRACK MY ORDER'}</a>
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
        <span style="font-size: 64px; margin-bottom: 20px; display: block;">${emoji === '🚚' && status.includes('PREP') ? '🍳' : (status.includes('TRANSIT') ? '🚲' : emoji)}</span>
        <h1 class="title" style="text-transform: capitalize;">moving fast!<br/>your order is ${status.replace(/_/g, ' ')?.toLowerCase()}.</h1>
        <p style="color: #64748B; font-size: 16px; line-height: 1.6; margin-top: 0; margin-bottom: 24px;">Good things coming your way. Your order <b>#${orderNumber}</b> has been updated to its next stage.</p>
        
        <div style="margin: 40px 0; text-align: center;">
          <a href="https://student.erranders.org/dashboard/orders" class="button" style="box-shadow: 0 10px 20px rgba(255,92,26,0.15);">VIEW LIVE TRACKING</a>
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
        <img src="https://images.unsplash.com/photo-1526367790999-0150786486a9?w=800" style="width: 100%; border-radius: 24px; margin-bottom: 30px; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
        <h1 class="title">Order Handed Over! 🏁</h1>
        <p style="color: #64748B; font-size: 16px; line-height: 1.6; margin-top: 0; margin-bottom: 24px;">Your order <b>#${order.orderNumber}</b> has been delivered. We hope you have a legendary appetite!</p>
        
        <div style="margin: 40px 0; background-color: #FFF7ED; border-radius: 24px; padding: 30px; text-align: left; border: 1px solid #FFEDD5;">
          <h2 style="margin-top: 0; font-size: 20px; font-weight: 800; color: #FF5C1A; margin-bottom: 8px;">Was it legendary? ⭐</h2>
          <p style="margin-bottom: 24px; font-weight: 500; color: #9A3412; font-size: 14px; line-height: 1.5;">Rating your experience helps us keep Erranders standards high and rewards our top riders.</p>
          <a href="https://student.erranders.org/dashboard/orders/${order._id}" style="background-color: #FF5C1A; color: #ffffff; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 13px; display: inline-block;">TAP TO RATE</a>
        </div>
      </div>
    `, `Order #${order.orderNumber} successfully delivered!`);
    return this.sendEmail(to, `Order Delivered! Enjoy 🍽️ — #${order.orderNumber}`, html);
  }

  async sendComplaintReceipt(to: string, ticketId: string, subject: string) {
    const html = this.wrap(`
      <div class="content">
        <div class="badge badge-orange">SUPPORT TICKET</div>
        <h1 class="title">We're on the case. 🛠️</h1>
        <p style="color: #64748B; font-size: 16px; line-height: 1.6; margin-top: 0; margin-bottom: 24px;">We received your report regarding <b>"${subject}"</b>. Our support leads have opened ticket <b>#${ticketId}</b> and are diving in aggressively.</p>
        
        <div class="otp-box" style="border-color: #FFD8A8; background-color: #FFF7ED; padding: 24px;">
           <span class="label">TICKET REFERENCE</span>
           <div style="font-size: 24px; font-weight: 800; color: #FF5C1A; font-family: monospace;">ERR-${ticketId}</div>
        </div>
        
        <p style="color: #64748B; font-size: 13px; text-align: center; margin-top: 24px; margin-bottom: 0;">Hang tight! We usually resolve campus issues within a few clock cycles.</p>
      </div>
    `, `Re: ${subject} [Ticket #${ticketId}] - We've received your report.`);
    return this.sendEmail(to, `Support Receipt: #${ticketId} — Erranders`, html);
  }

  async sendPayoutNotification(to: string, amount: number, description: string) {
    const html = this.wrap(`
      <div class="content" style="text-align: center;">
        <div style="font-size: 64px; margin-bottom: 20px;">💰</div>
        <h1 class="title">Wallet Credited!</h1>
        <p style="font-size: 16px; color: #64748B; margin-top: 0; margin-bottom: 30px;">You've just received a payout in your Erranders wallet.</p>
        
        <div class="item-card" style="background-color: #059669; border: none; color: #ffffff; padding: 30px; text-align: center; border-radius: 20px;">
           <span class="label" style="color: rgba(255,255,255,0.7);">SETTLEMENT AMOUNT</span>
           <h2 style="font-size: 36px; font-weight: 800; margin: 8px 0; color: #ffffff;">+₦${amount.toLocaleString()}</h2>
           <p style="font-size: 13px; opacity: 0.9; margin-bottom: 0;">${description}</p>
        </div>
        
        <div style="margin-top: 30px;">
          <a href="https://student.erranders.org/dashboard/wallet" class="button">VIEW WALLET</a>
        </div>
      </div>
    `, `You've received ₦${amount.toLocaleString()}!`);
    return this.sendEmail(to, `Wallet Credited — Erranders`, html);
  }

  async sendPromotionalEmail(to: string, subject: string, title: string, content: string, ctaText: string, ctaLink: string, image?: string) {
    const html = this.wrap(`
      <div class="content">
        <div class="badge badge-blue">OFFER INSIDE 🎁</div>
        <h1 class="title">${title}</h1>
        ${image ? `<img src="${image}" style="width: 100%; border-radius: 20px; margin-bottom: 24px;" alt="Promotion">` : ''}
        <p style="font-size: 16px; color: #4B5563; line-height: 1.6; margin-top: 0; margin-bottom: 24px;">${content}</p>
        <div style="text-align: center; margin-top: 40px;">
          <a href="${ctaLink}" class="button">${ctaText}</a>
        </div>
        <p style="font-size: 12px; color: #9CA3AF; text-align: center; margin-top: 48px; margin-bottom: 0;">Don't want these emails? Manage settings in your profile.</p>
      </div>
    `, title);
    return this.sendEmail(to, subject, html);
  }
}
