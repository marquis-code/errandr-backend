import { Injectable, UnauthorizedException, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from '../users/schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email/email.service';
import { WalletsService } from '../wallets/wallets.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    private walletsService: WalletsService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existing = await this.userModel.findOne({ email: registerDto.email });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 12);
    const user = await this.userModel.create({
      ...registerDto,
      password: hashedPassword,
    });

    // Initialize Wallet
    await this.walletsService.getOrCreateWallet((user._id as unknown) as string);

    // Generate OTP and send verification email
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    await user.save();

    await this.emailService.sendSignupOTP(user.email, user.firstName, otp);

    const token = this.generateToken(user);

    return {
      user: this.sanitizeUser(user),
      token,
      requiresVerification: true,
      message: 'Almost there! We sent a verification code to your email 📬',
    };
  }

  async login(loginDto: LoginDto) {
    const user = await this.userModel.findOne({ email: loginDto.email });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.generateToken(user);

    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  async firebaseLogin(firebaseUid: string, email: string, name: string) {
    let user = await this.userModel.findOne({ firebaseUid });

    if (!user) {
      user = await this.userModel.findOne({ email });
      if (user) {
        user.firebaseUid = firebaseUid;
        await user.save();
      } else {
        const nameParts = name.split(' ');
        user = await this.userModel.create({
          firstName: nameParts[0] || '',
          lastName: nameParts.slice(1).join(' ') || '',
          email,
          firebaseUid,
          isVerified: true,
        });
      }
    }

    const token = this.generateToken(user);

    return {
      user: this.sanitizeUser(user),
      token,
    };
  }

  async sendOTP(email: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) throw new NotFoundException('User not found');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    await user.save();

    await this.emailService.sendSignupOTP(email, user.firstName, otp);
    return { success: true, message: 'Fresh code on the way! Check your inbox 💌' };
  }

  async verifyOTP(email: string, otp: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) throw new NotFoundException('User not found');

    if (!user.otp || !user.otpExpiry) {
      throw new BadRequestException('No OTP was requested. Tap "Resend" to get a new one ✨');
    }

    if (new Date() > user.otpExpiry) {
      throw new BadRequestException('That code expired! Tap "Resend" for a fresh one ⏰');
    }

    if (user.otp !== otp) {
      throw new BadRequestException('Hmm, that code doesn\'t match. Double-check and try again 🔢');
    }

    user.isVerified = true;
    user.otp = null as any;
    user.otpExpiry = null as any;
    await user.save();

    return {
      success: true,
      message: 'Email verified! You\'re officially legit 🎉',
      user: this.sanitizeUser(user),
    };
  }

  async forgotPassword(email: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) {
      // Return success even if not found to prevent email enumeration
      return { success: true, message: 'If an account exists, a reset code has been sent 📬' };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    await user.save();

    await this.emailService.sendPasswordResetOTP(email, otp);
    return { success: true, message: 'Reset code sent! Check your inbox 💌' };
  }

  async verifyResetOTP(email: string, otp: string) {
    const user = await this.userModel.findOne({ email });
    if (!user) throw new NotFoundException('User not found');

    if (!user.resetPasswordOtp || !user.resetPasswordOtpExpiry) {
      throw new BadRequestException('No reset code was requested. Start the flow again ✨');
    }

    if (new Date() > user.resetPasswordOtpExpiry) {
      throw new BadRequestException('That code expired! Request a new one ⏰');
    }

    if (user.resetPasswordOtp !== otp) {
      throw new BadRequestException('Hmm, that code doesn\'t match. Double-check and try again 🔢');
    }

    return {
      success: true,
      message: 'Code verified! Now choose a strong new password 🔐'
    };
  }

  async resetPassword(resetDto: any) {
    const { email, otp, newPassword } = resetDto;
    const user = await this.userModel.findOne({ email });
    if (!user) {
      throw new BadRequestException('Invalid request');
    }

    if (!user.resetPasswordOtp || !user.resetPasswordOtpExpiry) {
      throw new BadRequestException('No reset code was requested. Start the flow again ✨');
    }

    if (new Date() > user.resetPasswordOtpExpiry) {
      throw new BadRequestException('That code expired! Request a new one ⏰');
    }

    if (user.resetPasswordOtp !== otp) {
      throw new BadRequestException('Hmm, that code doesn\'t match. Double-check and try again 🔢');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    user.resetPasswordOtp = null as any;
    user.resetPasswordOtpExpiry = null as any;
    await user.save();

    return {
      success: true,
      message: 'Password securely changed! You can now log in 🎉'
    };
  }

  private generateToken(user: User): string {
    return this.jwtService.sign({
      sub: user._id,
      email: user.email,
      role: user.role,
    });
  }

  private sanitizeUser(user: User) {
    const obj = user.toObject();
    delete obj.password;
    delete obj.otp;
    delete obj.otpExpiry;
    return obj;
  }
}
