import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SystemSetting } from '../admin/schemas/system-setting.schema';
import { User } from '../users/schemas/user.schema';
import { Errander } from './schemas/errander.schema';

export interface NinjaShiftSlot {
  shiftId: string;
  name: string;
  startTime: string; // '09:00'
  endTime: string;   // '14:00'
  timeLabel: string; // '9:00 AM – 2:00 PM'
}

export interface NinjaAssignment {
  shiftId: string;
  ninjaName: string;
}

export interface DaySchedule {
  day: string; // 'Monday', 'Tuesday', ...
  dayIndex: number; // 1 = Monday, ..., 7 = Sunday
  slots: NinjaAssignment[];
}

export interface NinjaRosterEntry {
  id: string;
  name: string;
  phone: string;
  userId?: string;
  userEmail?: string;
  isActive: boolean;
  notes?: string;
}

export interface ManagerConfig {
  name: string;
  phone: string;
  enabled: boolean;
}

export interface NinjaShiftSettings {
  enabled: boolean;
  timezone: string;
  offHoursFallback: 'all' | 'none';
  directWhatsAppEnabled: boolean;
  manager?: ManagerConfig;
  shifts: NinjaShiftSlot[];
  ninjas: NinjaRosterEntry[];
  schedule: DaySchedule[];
}

export const DEFAULT_NINJA_SHIFTS: NinjaShiftSlot[] = [
  {
    shiftId: 'shift_1',
    name: 'Morning Shift',
    startTime: '09:00',
    endTime: '14:00',
    timeLabel: '9:00 AM – 2:00 PM',
  },
  {
    shiftId: 'shift_2',
    name: 'Afternoon Shift',
    startTime: '14:00',
    endTime: '19:00',
    timeLabel: '2:00 PM – 7:00 PM',
  },
  {
    shiftId: 'shift_3',
    name: 'Night Shift',
    startTime: '19:00',
    endTime: '23:00',
    timeLabel: '7:00 PM – 11:00 PM',
  },
];

export const DEFAULT_MANAGER: ManagerConfig = {
  name: 'Kim',
  phone: '+2348052854256',
  enabled: true,
};

export const DEFAULT_NINJA_ROSTER: NinjaRosterEntry[] = [
  { id: 'ninja_ife', name: 'Ife', phone: '+2348179495795', userId: '6a89a7a17c25d2ef0dcfbaeb', userEmail: 'ifechukwuethel@gmail.com', isActive: true, notes: 'Customer Service Representative' },
  { id: 'ninja_brandy', name: 'Brandy', phone: '+2348139908262', userId: '6a84524262af2bddc4e7a9cb', userEmail: 'ajayiatilola03@gmail.com', isActive: true, notes: 'Customer Service Representative' },
  { id: 'ninja_ruth', name: 'Ruth', phone: '+2348106600919', userId: '', userEmail: '', isActive: true, notes: 'Customer Service Representative' },
];

/**
 * Official Weekly Shift Schedule from Erranders Timetable:
 * Monday:    Ife (9-2)    | Brandy (2-7) | Ruth (7-11)
 * Tuesday:   Brandy (9-2) | Ruth (2-7)   | Ife (7-11)
 * Wednesday: Ruth (9-2)   | Ife (2-7)    | Brandy (7-11)
 * Thursday:  Ife (9-2)    | Brandy (2-7) | Ruth (7-11)
 * Friday:    Brandy (9-2) | Ruth (2-7)   | Ife (7-11)
 * Saturday:  Ruth (9-2)   | Ife (2-7)    | Brandy (7-11)
 * Sunday:    Ife (9-2)    | Brandy (2-7) | Ruth (7-11)
 */
export const DEFAULT_WEEKLY_SCHEDULE: DaySchedule[] = [
  {
    day: 'Monday',
    dayIndex: 1,
    slots: [
      { shiftId: 'shift_1', ninjaName: 'Ife' },
      { shiftId: 'shift_2', ninjaName: 'Brandy' },
      { shiftId: 'shift_3', ninjaName: 'Ruth' },
    ],
  },
  {
    day: 'Tuesday',
    dayIndex: 2,
    slots: [
      { shiftId: 'shift_1', ninjaName: 'Brandy' },
      { shiftId: 'shift_2', ninjaName: 'Ruth' },
      { shiftId: 'shift_3', ninjaName: 'Ife' },
    ],
  },
  {
    day: 'Wednesday',
    dayIndex: 3,
    slots: [
      { shiftId: 'shift_1', ninjaName: 'Ruth' },
      { shiftId: 'shift_2', ninjaName: 'Ife' },
      { shiftId: 'shift_3', ninjaName: 'Brandy' },
    ],
  },
  {
    day: 'Thursday',
    dayIndex: 4,
    slots: [
      { shiftId: 'shift_1', ninjaName: 'Ife' },
      { shiftId: 'shift_2', ninjaName: 'Brandy' },
      { shiftId: 'shift_3', ninjaName: 'Ruth' },
    ],
  },
  {
    day: 'Friday',
    dayIndex: 5,
    slots: [
      { shiftId: 'shift_1', ninjaName: 'Brandy' },
      { shiftId: 'shift_2', ninjaName: 'Ruth' },
      { shiftId: 'shift_3', ninjaName: 'Ife' },
    ],
  },
  {
    day: 'Saturday',
    dayIndex: 6,
    slots: [
      { shiftId: 'shift_1', ninjaName: 'Ruth' },
      { shiftId: 'shift_2', ninjaName: 'Ife' },
      { shiftId: 'shift_3', ninjaName: 'Brandy' },
    ],
  },
  {
    day: 'Sunday',
    dayIndex: 7,
    slots: [
      { shiftId: 'shift_1', ninjaName: 'Ife' },
      { shiftId: 'shift_2', ninjaName: 'Brandy' },
      { shiftId: 'shift_3', ninjaName: 'Ruth' },
    ],
  },
];

@Injectable()
export class NinjaShiftsService {
  private readonly logger = new Logger(NinjaShiftsService.name);
  private cache: { data: NinjaShiftSettings; expiry: number } | null = null;

  constructor(
    @InjectModel(SystemSetting.name) private readonly settingModel: Model<SystemSetting>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Errander.name) private readonly erranderModel: Model<Errander>,
  ) {}

  /**
   * Get the complete shift settings, seeding defaults if not yet present in DB.
   */
  async getScheduleSettings(skipCache = false): Promise<NinjaShiftSettings> {
    const now = Date.now();
    if (!skipCache && this.cache && this.cache.expiry > now) {
      return this.cache.data;
    }

    try {
      let setting = await this.settingModel.findOne({ key: 'ninja_shifts_schedule' }).exec();

      if (!setting || !setting.value) {
        this.logger.log('Seeding initial Errand Ninja Weekly Shift Schedule into DB...');
        const initialValue: NinjaShiftSettings = {
          enabled: true,
          timezone: 'Africa/Lagos',
          offHoursFallback: 'all',
          directWhatsAppEnabled: true,
          manager: DEFAULT_MANAGER,
          shifts: DEFAULT_NINJA_SHIFTS,
          ninjas: DEFAULT_NINJA_ROSTER,
          schedule: DEFAULT_WEEKLY_SCHEDULE,
        };

        setting = await this.settingModel.create({
          key: 'ninja_shifts_schedule',
          value: initialValue,
        });

        this.cache = { data: initialValue, expiry: now + 15000 };
        return initialValue;
      }

      const val = setting.value as any;
      const merged: NinjaShiftSettings = {
        enabled: val.enabled ?? true,
        timezone: val.timezone || 'Africa/Lagos',
        offHoursFallback: val.offHoursFallback || 'all',
        directWhatsAppEnabled: val.directWhatsAppEnabled ?? true,
        manager: val.manager || DEFAULT_MANAGER,
        shifts: Array.isArray(val.shifts) && val.shifts.length ? val.shifts : DEFAULT_NINJA_SHIFTS,
        ninjas: Array.isArray(val.ninjas) && val.ninjas.length ? val.ninjas : DEFAULT_NINJA_ROSTER,
        schedule: Array.isArray(val.schedule) && val.schedule.length ? val.schedule : DEFAULT_WEEKLY_SCHEDULE,
      };

      this.cache = { data: merged, expiry: now + 15000 };
      return merged;
    } catch (e: any) {
      this.logger.error(`Error loading ninja shift schedule: ${e.message}`);
      return {
        enabled: true,
        timezone: 'Africa/Lagos',
        offHoursFallback: 'all',
        directWhatsAppEnabled: true,
        manager: DEFAULT_MANAGER,
        shifts: DEFAULT_NINJA_SHIFTS,
        ninjas: DEFAULT_NINJA_ROSTER,
        schedule: DEFAULT_WEEKLY_SCHEDULE,
      };
    }
  }

  /**
   * Save updated schedule and roster settings from the Admin.
   */
  async updateScheduleSettings(update: Partial<NinjaShiftSettings>): Promise<NinjaShiftSettings> {
    let setting = await this.settingModel.findOne({ key: 'ninja_shifts_schedule' }).exec();
    if (!setting) {
      setting = new this.settingModel({ key: 'ninja_shifts_schedule' });
    }

    const current = (setting.value || {}) as any;
    const next: NinjaShiftSettings = {
      enabled: update.enabled !== undefined ? update.enabled : (current.enabled ?? true),
      timezone: update.timezone || current.timezone || 'Africa/Lagos',
      offHoursFallback: update.offHoursFallback || current.offHoursFallback || 'all',
      directWhatsAppEnabled: update.directWhatsAppEnabled !== undefined ? update.directWhatsAppEnabled : (current.directWhatsAppEnabled ?? true),
      manager: update.manager || current.manager || DEFAULT_MANAGER,
      shifts: update.shifts || current.shifts || DEFAULT_NINJA_SHIFTS,
      ninjas: update.ninjas || current.ninjas || DEFAULT_NINJA_ROSTER,
      schedule: update.schedule || current.schedule || DEFAULT_WEEKLY_SCHEDULE,
    };

    setting.value = next;
    setting.markModified('value');
    await setting.save();

    this.cache = { data: next, expiry: Date.now() + 15000 };
    this.logger.log(`Errand Ninja Weekly Shift Schedule updated successfully by Admin`);
    return next;
  }

  /**
   * Reset timetable to the official timetable from the user's weekly schedule.
   */
  async resetToDefaultSchedule(): Promise<NinjaShiftSettings> {
    const defaultData: NinjaShiftSettings = {
      enabled: true,
      timezone: 'Africa/Lagos',
      offHoursFallback: 'all',
      directWhatsAppEnabled: true,
      manager: DEFAULT_MANAGER,
      shifts: DEFAULT_NINJA_SHIFTS,
      ninjas: DEFAULT_NINJA_ROSTER,
      schedule: DEFAULT_WEEKLY_SCHEDULE,
    };

    let setting = await this.settingModel.findOne({ key: 'ninja_shifts_schedule' }).exec();
    if (!setting) {
      setting = new this.settingModel({ key: 'ninja_shifts_schedule' });
    }

    // Keep existing phone numbers and userId links if already filled in
    if (setting.value?.ninjas && Array.isArray(setting.value.ninjas)) {
      const existingMap = new Map<string, NinjaRosterEntry>(
        setting.value.ninjas.map((n: NinjaRosterEntry) => [n.name.toLowerCase(), n])
      );
      for (const defNinja of defaultData.ninjas) {
        const existing = existingMap.get(defNinja.name.toLowerCase());
        if (existing) {
          if (existing.phone) defNinja.phone = existing.phone;
          if (existing.userId) defNinja.userId = existing.userId;
          if (existing.userEmail) defNinja.userEmail = existing.userEmail;
        }
      }
    }

    setting.value = defaultData;
    setting.markModified('value');
    await setting.save();

    this.cache = { data: defaultData, expiry: Date.now() + 15000 };
    return defaultData;
  }

  /**
   * Determine who is currently on duty right now based on Nigeria (Africa/Lagos) time.
   */
  async getCurrentDutyStatus(targetDate?: Date) {
    const settings = await this.getScheduleSettings();
    const now = targetDate || new Date();

    // 1. Format current time in Africa/Lagos WAT
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: settings.timezone || 'Africa/Lagos',
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = dtf.formatToParts(now);
    const day = parts.find((p) => p.type === 'weekday')?.value || 'Monday';
    const hourStr = parts.find((p) => p.type === 'hour')?.value || '00';
    const minStr = parts.find((p) => p.type === 'minute')?.value || '00';

    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minStr, 10);
    const totalMinutes = hour * 60 + minute;
    const timeFormatted = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

    // 2. Find matching shift for this time
    let activeShift: NinjaShiftSlot | null = null;
    for (const shift of settings.shifts) {
      const [sH, sM] = shift.startTime.split(':').map((x) => parseInt(x, 10));
      const [eH, eM] = shift.endTime.split(':').map((x) => parseInt(x, 10));
      const startMin = sH * 60 + (sM || 0);
      const endMin = eH * 60 + (eM || 0);

      if (totalMinutes >= startMin && totalMinutes < endMin) {
        activeShift = shift;
        break;
      }
    }

    // 3. Find assigned ninja for this day and shift
    const daySchedule = settings.schedule.find((s) => s.day.toLowerCase() === day.toLowerCase());
    let assignedNinjaName = '';
    if (daySchedule && activeShift) {
      const slotAssignment = daySchedule.slots.find((sl) => sl.shiftId === activeShift!.shiftId);
      if (slotAssignment) {
        assignedNinjaName = slotAssignment.ninjaName;
      }
    }

    // 4. Resolve assigned ninja profile from roster
    const rosterNinja = settings.ninjas.find(
      (n) => n.name.toLowerCase() === assignedNinjaName.toLowerCase() && n.isActive
    );

    // If ninja is missing phone or userId in settings, try finding user in DB
    let resolvedPhone = rosterNinja?.phone || '';
    let resolvedUserId = rosterNinja?.userId || '';
    let resolvedUserEmail = rosterNinja?.userEmail || '';

    if (assignedNinjaName && (!resolvedPhone || !resolvedUserId)) {
      const matchedUser = await this.userModel
        .findOne({
          $or: [
            { firstName: new RegExp(`^${assignedNinjaName}$`, 'i') },
            { lastName: new RegExp(`^${assignedNinjaName}$`, 'i') },
          ],
        })
        .select('_id phone email firstName lastName')
        .lean()
        .exec();

      if (matchedUser) {
        if (!resolvedPhone && matchedUser.phone) resolvedPhone = matchedUser.phone;
        if (!resolvedUserId) resolvedUserId = String(matchedUser._id);
        if (!resolvedUserEmail && matchedUser.email) resolvedUserEmail = matchedUser.email;
      }
    }

    // Next upcoming shift
    let nextShiftInfo: any = null;
    if (settings.shifts.length) {
      const currentIndex = activeShift ? settings.shifts.findIndex((s) => s.shiftId === activeShift!.shiftId) : -1;
      const nextIndex = (currentIndex + 1) % settings.shifts.length;
      const nextSlot = settings.shifts[nextIndex];
      const nextDay = currentIndex === settings.shifts.length - 1 ? this.getNextDay(day) : day;
      const nextDaySched = settings.schedule.find((s) => s.day.toLowerCase() === nextDay.toLowerCase());
      const nextAssignment = nextDaySched?.slots.find((sl) => sl.shiftId === nextSlot.shiftId);

      nextShiftInfo = {
        shift: nextSlot,
        day: nextDay,
        assignedNinja: nextAssignment?.ninjaName || 'Unassigned',
      };
    }

    return {
      enabled: settings.enabled,
      timezone: settings.timezone,
      currentDay: day,
      currentTime: timeFormatted,
      isShiftActive: !!activeShift,
      currentShift: activeShift,
      assignedNinjaName: assignedNinjaName || 'None',
      onDutyNinja: assignedNinjaName
        ? {
            name: assignedNinjaName,
            phone: resolvedPhone,
            userId: resolvedUserId,
            email: resolvedUserEmail,
            notes: rosterNinja?.notes || '',
          }
        : null,
      nextShift: nextShiftInfo,
      offHoursFallback: settings.offHoursFallback,
      manager: settings.manager || DEFAULT_MANAGER,
    };
  }

  /**
   * Helper called by OrdersService when a new errand is placed.
   * Returns whether shift-filtering applies and the list of on-duty recipient phones & userIds.
   */
  async getCurrentDutyRecipients() {
    const settings = await this.getScheduleSettings();
    const status = await this.getCurrentDutyStatus();

    const managerPhone = (settings.manager?.enabled !== false && settings.manager?.phone) ? settings.manager.phone : '';
    const managerName = settings.manager?.name || 'Kim';

    if (!status.enabled) {
      return {
        enabled: false,
        isShiftActive: false,
        currentDay: status.currentDay,
        currentShift: status.currentShift,
        onDutyNinjas: [],
        onDutyPhones: [],
        onDutyUserIds: [],
        onDutyNames: [],
        offHoursFallback: status.offHoursFallback,
        manager: settings.manager || DEFAULT_MANAGER,
        managerPhone,
        managerName,
      };
    }

    const onDutyNinjas: any[] = [];
    const onDutyPhones: string[] = [];
    const onDutyUserIds: string[] = [];
    const onDutyNames: string[] = [];

    if (status.isShiftActive && status.onDutyNinja) {
      onDutyNinjas.push(status.onDutyNinja);
      onDutyNames.push(status.onDutyNinja.name);
      if (status.onDutyNinja.phone) {
        onDutyPhones.push(status.onDutyNinja.phone);
      }
      if (status.onDutyNinja.userId) {
        onDutyUserIds.push(status.onDutyNinja.userId);
      }
    }

    return {
      enabled: true,
      isShiftActive: status.isShiftActive,
      currentDay: status.currentDay,
      currentShift: status.currentShift,
      onDutyNinjas,
      onDutyPhones,
      onDutyUserIds,
      onDutyNames,
      offHoursFallback: status.offHoursFallback,
      manager: settings.manager || DEFAULT_MANAGER,
      managerPhone,
      managerName,
    };
  }

  private getNextDay(day: string): string {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const idx = days.findIndex((d) => d.toLowerCase() === day.toLowerCase());
    return days[(idx + 1) % days.length];
  }
}

