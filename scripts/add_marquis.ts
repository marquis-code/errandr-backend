import * as mongoose from 'mongoose';
import { Resend } from 'resend';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const FacilitatorSchemaDefinition = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    matricNumber: String,
    skill: String,
    referralCode: { type: String, required: true, unique: true },
    totalReferrals: { type: Number, default: 0 },
    tier: { type: String, default: 'starter' },
    pointsEarned: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    welcomeEmailSent: { type: Boolean, default: false },
    linkedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    phone: String,
    avatar: String,
  },
  { timestamps: true },
);

const FacilitatorModel = mongoose.model('Facilitator', FacilitatorSchemaDefinition);

function buildWelcomeEmail(name: string, referralCode: string, skill: string): string {
  const firstName = name.split(' ')[0];
  const logoUrl = 'https://erranders.org/_nuxt/logo.7u_gNOaX.png';

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700;800&display=swap');
          body { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #F8FAFC; margin: 0; padding: 0; }
          .container { max-width: 600px; width: 100%; margin: 30px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05); border: 1px solid #E2E8F0; }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #F8FAFC;">
        <div style="display: none; max-height: 0px; overflow: hidden; opacity: 0;">Welcome to the Erranders Ambassador squad, ${firstName}! Your referral code is ${referralCode}</div>
        <div class="container" style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #E2E8F0;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #7C3AED 0%, #A78BFA 50%, #FF5C1A 100%); padding: 48px 32px; text-align: center;">
            <div style="margin-bottom: 16px;"><span style="font-size: 64px;">🚀</span></div>
            <h1 style="color: #ffffff; font-size: 28px; font-weight: 800; margin: 0 0 8px; letter-spacing: -1px;">Welcome to the Squad</h1>
            <p style="color: rgba(255,255,255,0.85); font-size: 15px; margin: 0; font-weight: 500;">You're now an Erranders Campus Ambassador</p>
          </div>

          <!-- Content -->
          <div style="padding: 40px 32px; color: #1E293B;">
            <div style="display: inline-block; padding: 6px 12px; border-radius: 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-bottom: 16px; background-color: #F5F3FF; color: #7C3AED; border: 1px solid #E9D5FF;">AMBASSADOR</div>
            <h1 style="font-size: 32px; font-weight: 800; line-height: 1.2; letter-spacing: -1px; margin-bottom: 20px; color: #0F172A;">Hey ${firstName}, you're officially in! 💜</h1>
            <p style="font-size: 16px; line-height: 1.7; color: #475569; margin-top: 0; margin-bottom: 24px;">
              We're building something special at Erranders — a campus delivery ecosystem that makes life easier for every student. And now, <b>you're a key part of that mission</b>.
            </p>
            <p style="font-size: 16px; line-height: 1.7; color: #475569; margin-top: 0; margin-bottom: 32px;">
              As a Campus Ambassador, every person you bring to Erranders earns you <b>points, rewards, and recognition</b>. The more you refer, the higher you climb. Let's get it! 🔥
            </p>
            
            <!-- Referral Code Card -->
            <div style="background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); border-radius: 24px; padding: 36px 28px; text-align: center; margin: 32px 0; position: relative; overflow: hidden;">
              <div style="position: absolute; top: -30px; right: -30px; width: 120px; height: 120px; background: #FF5C1A; opacity: 0.1; border-radius: 50%;"></div>
              <div style="position: absolute; bottom: -20px; left: -20px; width: 80px; height: 80px; background: #7C3AED; opacity: 0.15; border-radius: 50%;"></div>
              <span style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; color: #FF5C1A; display: block; margin-bottom: 12px;">YOUR REFERRAL CODE</span>
              <div style="font-size: 36px; font-weight: 800; letter-spacing: 4px; color: #ffffff; font-family: 'Plus Jakarta Sans', monospace; margin-bottom: 16px;">${referralCode}</div>
              <p style="font-size: 13px; color: #94A3B8; margin: 0; line-height: 1.5;">Share this code with students, vendors, and riders.<br/>Every signup with your code = points for you! 🎯</p>
            </div>

            ${skill ? `
            <!-- Skill Badge -->
            <div style="display: flex; align-items: center; gap: 12px; background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px; padding: 16px 20px; margin-bottom: 28px;">
              <div style="width: 40px; height: 40px; background-color: #EFF6FF; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                <span style="font-size: 18px;">✨</span>
              </div>
              <div>
                <p style="margin: 0; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #94A3B8;">YOUR SUPERPOWER</p>
                <p style="margin: 4px 0 0; font-size: 15px; font-weight: 700; color: #0F172A;">${skill}</p>
              </div>
            </div>
            ` : ''}

            <!-- How it Works -->
            <div style="background-color: #FFF7ED; border-radius: 16px; padding: 24px; margin-bottom: 20px; border: 1px solid #FFEDD5;">
              <h3 style="margin-top: 0; color: #EA580C; font-weight: 800; font-size: 16px; margin-bottom: 16px;">How to Start Earning 🎮</h3>
              <div style="margin: 12px 0; color: #9A3412; font-size: 14px; line-height: 1.8;">
                <p style="margin: 8px 0;"><b>1.</b> 🗣️ Share your code <b>${referralCode}</b> with friends, classmates, and campus vendors</p>
                <p style="margin: 8px 0;"><b>2.</b> 📱 They enter your code when signing up on Erranders</p>
                <p style="margin: 8px 0;"><b>3.</b> 💰 You earn points instantly — they get a welcome bonus too!</p>
                <p style="margin: 8px 0;"><b>4.</b> 🏆 Climb the tiers: Starter → Hustler → Ambassador → Legend</p>
              </div>
            </div>

            <!-- Tier Preview -->
            <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px; padding: 24px;">
              <h3 style="margin-top: 0; font-size: 14px; font-weight: 800; color: #0F172A; margin-bottom: 16px;">🏅 Reward Tiers</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 6px 0; font-size: 13px; color: #64748B; font-weight: 600;">🌱 Starter (1–5)</td><td style="text-align: right; font-size: 13px; color: #0F172A; font-weight: 700;">100 pts each</td></tr>
                <tr><td style="padding: 6px 0; font-size: 13px; color: #64748B; font-weight: 600;">🔥 Hustler (6–15)</td><td style="text-align: right; font-size: 13px; color: #EA580C; font-weight: 700;">150 pts + ₦500</td></tr>
                <tr><td style="padding: 6px 0; font-size: 13px; color: #64748B; font-weight: 600;">💎 Ambassador (16–30)</td><td style="text-align: right; font-size: 13px; color: #7C3AED; font-weight: 700;">200 pts + ₦1,500</td></tr>
                <tr><td style="padding: 6px 0; font-size: 13px; color: #64748B; font-weight: 600;">👑 Legend (31+)</td><td style="text-align: right; font-size: 13px; color: #D97706; font-weight: 700;">300 pts + ₦3,000</td></tr>
              </table>
            </div>

            <div style="text-align: center; margin-top: 40px;">
              <a href="https://student.erranders.org" style="display: inline-block; padding: 16px 36px; background: linear-gradient(135deg, #FF5C1A, #FF8F50); color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 1.5px; box-shadow: 0 10px 30px rgba(255,92,26,0.2);">START SHARING NOW 🚀</a>
            </div>

            <p style="text-align: center; font-size: 13px; color: #94A3B8; margin-top: 32px; margin-bottom: 0; line-height: 1.6;">
              Questions? Just reply to this email — we've got your back. 💪<br/>
              Let's make Erranders the biggest thing on campus. Together.
            </p>
          </div>

          <!-- Footer -->
          <div style="padding: 48px 32px; text-align: center; color: #94A3B8; font-size: 13px; background-color: #0F172A;">
            <img src="${logoUrl}" style="height: 36px; margin-bottom: 24px; filter: brightness(0) invert(1);" alt="Erranders">
            <p style="color: #ffffff; font-weight: 800; font-size: 16px; margin-bottom: 12px; margin-top: 0;">Erranders — Campus life, elevated.</p>
            <p style="margin-bottom: 24px; line-height: 1.6; opacity: 0.7; color: #94A3B8;">We're on a mission to make every delivery on campus seamless, fast, and aggressively convenient.</p>
            <p style="margin-top: 48px; opacity: 0.4; font-size: 11px; color: #94A3B8;">© ${new Date().getFullYear()} Erranders Ltd. Lagos, Nigeria.</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

function generateBrandedCode(name: string): string {
  const firstName = name.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '');
  return `ERR-${firstName}`;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI as string);
  console.log('✅ Connected to MongoDB');

  const resend = new Resend((process.env.RESEND_API_KEY as string).replace(/['"]+/g, ''));
  const emailFrom = 'Erranders <notifications@erranders.org>';

  const user = {
    name: 'Abah Marquis',
    email: 'abahmarquis@gmail.com',
    matricNumber: '160708004',
    skill: 'Engineering'
  };

  try {
    let code = generateBrandedCode(user.name);
    
    const existing = await FacilitatorModel.findOne({ referralCode: code });
    if (existing) {
       const suffix = Math.random().toString(36).substring(2, 4).toUpperCase();
       code = `${code}${suffix}`;
    }

    const facilitator = await FacilitatorModel.create({
      ...user,
      referralCode: code,
      tier: 'starter',
      isActive: true,
      welcomeEmailSent: false,
    });
    console.log(`✅ Created: ${user.name} → Code: ${code}`);

    const html = buildWelcomeEmail(user.name, code, user.skill);
    await resend.emails.send({
      from: emailFrom,
      to: [user.email],
      subject: `Welcome to the Squad, ${user.name.split(' ')[0]}! 💜 Your Code: ${code}`,
      html,
    });

    facilitator.welcomeEmailSent = true;
    await facilitator.save();
    console.log(`   📧 Welcome email sent to ${user.email}`);

  } catch (err: any) {
    if (err.code === 11000) {
      console.log(`⏭️ ${user.name} (${user.email}) already exists in database.`);
    } else {
      console.error('❌ Failed:', err.message);
    }
  }

  await mongoose.disconnect();
  console.log('🏁 Done!');
}

main();
