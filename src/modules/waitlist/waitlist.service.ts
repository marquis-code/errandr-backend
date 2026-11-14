import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationsService } from '../notifications/notifications.service';
import { WaitlistForm, WaitlistFormDocument, WaitlistResponse } from './schemas/waitlist.schema';

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    @InjectModel(WaitlistForm.name) private readonly formModel: Model<WaitlistFormDocument>,
    @InjectModel(WaitlistResponse.name) private readonly responseModel: Model<WaitlistResponse>,
    @InjectModel('Vendor') private readonly vendorModel: Model<any>,
    private readonly notificationsService: NotificationsService,
  ) {}

  private async vendorForOwner(ownerId: string) {
    const vendor = await this.vendorModel.findOne({ owner: new Types.ObjectId(ownerId) }).lean().exec();
    if (!vendor) throw new ForbiddenException('No store is linked to this account');
    return vendor as any;
  }

  private slugify(title: string): string {
    return String(title || 'waitlist')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'waitlist';
  }

  /** Create a form. Defaults give a working form immediately, so a vendor is never staring at blanks. */
  async create(ownerId: string, body: { title?: string; description?: string; fields?: any[] }) {
    const vendor = await this.vendorForOwner(ownerId);
    const title = String(body?.title || 'Join our waitlist').trim();
    let slug = this.slugify(title);

    // Slugs are unique per vendor; add a suffix rather than rejecting the create.
    const clash = await this.formModel.exists({ vendor: vendor._id, slug });
    if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const fields = (body?.fields?.length ? body.fields : [
      { key: 'name', label: 'Your name', type: 'text', required: true },
      { key: 'phone', label: 'Phone number', type: 'phone', required: true },
      { key: 'note', label: 'What do you need?', type: 'textarea', required: false },
    ]).map((f: any, i: number) => ({
      key: f.key || `field_${i + 1}`,
      label: String(f.label || `Question ${i + 1}`),
      type: ['text', 'email', 'phone', 'textarea', 'select', 'multiselect', 'date', 'number', 'image'].includes(f.type) ? f.type : 'text',
      required: Boolean(f.required),
      options: Array.isArray(f.options) ? f.options.map(String).filter(Boolean) : [],
      allowOther: Boolean(f.allowOther),
    }));

    return this.formModel.create({
      vendor: vendor._id,
      title,
      description: String(body?.description || ''),
      slug,
      fields,
      isPublished: false,
    });
  }

  async list(ownerId: string) {
    const vendor = await this.vendorForOwner(ownerId);
    return this.formModel.find({ vendor: vendor._id }).sort({ createdAt: -1 }).lean().exec();
  }

  async update(ownerId: string, formId: string, body: any) {
    const vendor = await this.vendorForOwner(ownerId);
    const form = await this.formModel.findOne({ _id: formId, vendor: vendor._id });
    if (!form) throw new NotFoundException('Form not found');

    if (body.title !== undefined) form.title = String(body.title);
    if (body.bannerImage !== undefined) form.bannerImage = String(body.bannerImage);
    if (body.description !== undefined) form.description = String(body.description);
    if (body.fields !== undefined && Array.isArray(body.fields)) form.fields = body.fields as any;
    if (body.isPublished !== undefined) form.isPublished = Boolean(body.isPublished);

    await form.save();
    return form;
  }

  /**
   * Public view of a published form, resolved by the vendor's subdomain so a customer never sees a
   * generic Erranders URL.
   */
  async publicForm(subdomain: string, slug: string) {
    const vendor = await this.vendorModel.findOne({ subdomain: String(subdomain).toLowerCase() }).select('_id storeName logo subdomain').lean().exec();
    if (!vendor) throw new NotFoundException('Store not found');

    const form = await this.formModel
      .findOne({ vendor: (vendor as any)._id, slug, isPublished: true })
      .lean()
      .exec();
    if (!form) throw new NotFoundException('This waitlist is not open');

    return { form, vendor };
  }

  /** A customer submits. This is the one path that must never silently fail. */
  async submit(subdomain: string, slug: string, answers: Record<string, any>) {
    const vendor = await this.vendorModel.findOne({ subdomain: String(subdomain).toLowerCase() }).exec();
    if (!vendor) throw new NotFoundException('Store not found');

    const form = await this.formModel.findOne({ vendor: (vendor as any)._id, slug, isPublished: true });
    if (!form) throw new NotFoundException('This waitlist is not open');

    const filled = (f: any) => {
      const v = answers?.[f.key];
      if (Array.isArray(v)) return v.length > 0;
      return String(v ?? '').trim().length > 0;
    };
    const missing = (form.fields || [])
      .filter((f: any) => f.required && !filled(f))
      .map((f: any) => f.label);
    if (missing.length > 0) {
      throw new BadRequestException(`Please fill in: ${missing.join(', ')}`);
    }

    const response = await this.responseModel.create({
      form: form._id,
      vendor: (vendor as any)._id,
      answers: answers || {},
    });

    await this.formModel.updateOne({ _id: form._id }, { $inc: { responseCount: 1 } });
    await this.notifyVendor(vendor, form, answers);
    return { success: true, id: response._id };
  }

  private async notifyVendor(vendor: any, form: any, answers: Record<string, any>) {
    try {
      const owner = await (this.vendorModel.db as any)
        .collection('users')
        .findOne({ _id: vendor.owner });
      const phone = owner?.phone || vendor.phone;
      if (!phone) return;

      const lines = (form.fields || [])
        .map((f: any) => `${f.label}: ${String(answers?.[f.key] ?? '—')}`)
        .filter(Boolean)
        .slice(0, 6);

      await this.notificationsService
        .sendWhatsApp(
          phone,
          [
            `Hi ${owner?.firstName || 'there'}, Erranders Bot here 👋`,
            '',
            `New waitlist response — ${form.title}`,
            '',
            ...lines,
            '',
            'Open your dashboard to reply:',
            'https://vendor.erranders.org/dashboard/waitlist',
          ].join('\n'),
        )
        .catch(() => {});
    } catch (e: any) {
      this.logger.warn(`Waitlist notification failed: ${e?.message || e}`);
    }
  }

  async responses(ownerId: string, formId: string) {
    const vendor = await this.vendorForOwner(ownerId);
    const form = await this.formModel.findOne({ _id: formId, vendor: vendor._id }).lean().exec();
    if (!form) throw new NotFoundException('Form not found');

    return this.responseModel.find({ form: (form as any)._id }).sort({ createdAt: -1 }).limit(200).lean().exec();
  }
}
