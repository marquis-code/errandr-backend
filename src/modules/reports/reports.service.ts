import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Report, ReportStatus } from './schemas/report.schema';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Report.name) private reportModel: Model<Report>,
  ) {}

  async create(data: {
    reporter: string;
    vendor?: string;
    reportedUser?: string;
    order?: string;
    category: string;
    title: string;
    description: string;
    images?: string[];
  }): Promise<Report> {
    return this.reportModel.create({
      ...data,
      reporter: new Types.ObjectId(data.reporter),
      vendor: data.vendor ? new Types.ObjectId(data.vendor) : undefined,
      reportedUser: data.reportedUser ? new Types.ObjectId(data.reportedUser) : undefined,
      order: data.order ? new Types.ObjectId(data.order) : undefined,
    });
  }

  async getUserReports(userId: string): Promise<Report[]> {
    return this.reportModel
      .find({ reporter: new Types.ObjectId(userId) })
      .populate('vendor', 'storeName logo')
      .sort({ createdAt: -1 });
  }

  async getAllReports(status?: string): Promise<Report[]> {
    const filter: any = {};
    if (status) filter.status = status;
    return this.reportModel
      .find(filter)
      .populate('reporter', 'firstName lastName email')
      .populate('vendor', 'storeName logo')
      .populate('order', 'orderNumber')
      .sort({ createdAt: -1 });
  }

  async getReport(reportId: string): Promise<Report> {
    const report = await this.reportModel
      .findById(reportId)
      .populate('reporter', 'firstName lastName email avatar')
      .populate('vendor', 'storeName logo')
      .populate('order', 'orderNumber total')
      .populate('thread.sender', 'firstName lastName role');
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async addMessage(reportId: string, senderId: string, message: string, isAdmin: boolean): Promise<Report> {
    const report = await this.reportModel.findById(reportId);
    if (!report) throw new NotFoundException('Report not found');

    report.thread.push({
      sender: new Types.ObjectId(senderId),
      message,
      timestamp: new Date(),
      isAdmin,
    });

    // Auto-transition to investigating when admin responds first time
    if (isAdmin && report.status === ReportStatus.PENDING) {
      report.status = ReportStatus.INVESTIGATING;
    }

    return report.save();
  }

  async updateStatus(
    reportId: string,
    status: ReportStatus,
    adminId: string,
    adminNote?: string,
  ): Promise<Report> {
    const update: any = {
      status,
      resolvedBy: new Types.ObjectId(adminId),
    };
    if (adminNote) update.adminNote = adminNote;
    if (status === ReportStatus.RESOLVED || status === ReportStatus.DISMISSED) {
      update.resolvedAt = new Date();
    }
    const report = await this.reportModel
      .findByIdAndUpdate(reportId, update, { new: true })
      .populate('reporter', 'firstName lastName');
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  async getVendorReportStats(vendorId: string) {
    const total = await this.reportModel.countDocuments({ vendor: new Types.ObjectId(vendorId) });
    const pending = await this.reportModel.countDocuments({
      vendor: new Types.ObjectId(vendorId),
      status: ReportStatus.PENDING,
    });
    return { total, pending };
  }
}
