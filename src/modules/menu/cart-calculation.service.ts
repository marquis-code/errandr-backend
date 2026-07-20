import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MenuItem } from './schemas/menu-item.schema';
import { MenuPack } from './schemas/menu-pack.schema';
import { AddOnGroup } from './schemas/add-on.schema';

// ---- Cart input shapes (what the client sends) ----

export interface CartAddOnSelection {
  addOnGroupId: string;
  options: { optionId: string; quantity: number }[]; // includes quantity for "3x Extra Chicken"
}

export interface CartItemLine {
  type: 'item';
  itemId: string;
  quantity: number; // number of portions
  selectedModifiers?: { modifierId: string; optionId: string }[];
  addOns?: CartAddOnSelection[];
}

export interface CartPackLine {
  type: 'pack';
  packId: string;
  quantity: number; // number of packs (not portions)
  addOns?: CartAddOnSelection[];
}

export type CartLine = CartItemLine | CartPackLine;

@Injectable()
export class CartCalculationService {
  constructor(
    @InjectModel(MenuItem.name) private itemModel: Model<MenuItem>,
    @InjectModel(MenuPack.name) private packModel: Model<MenuPack>,
    @InjectModel(AddOnGroup.name) private addOnGroupModel: Model<AddOnGroup>,
  ) {}

  async calculateLineTotal(line: CartLine): Promise<number> {
    if (line.type === 'item') return this.calculateItemLine(line);
    return this.calculatePackLine(line);
  }

  async calculateCartTotal(lines: CartLine[]): Promise<{
    lines: { line: CartLine; total: number }[];
    grandTotal: number;
  }> {
    const results = await Promise.all(
      lines.map(async (line) => ({
        line,
        total: await this.calculateLineTotal(line),
      })),
    );
    const grandTotal = results.reduce((sum, r) => sum + r.total, 0);
    return { lines: results, grandTotal };
  }

  // ---- À la carte item: pricePerPortion × quantity + modifiers + add-ons ----
  private async calculateItemLine(line: CartItemLine): Promise<number> {
    const item = await this.itemModel.findById(line.itemId).lean();
    if (!item || !item.isAvailable) {
      throw new BadRequestException('Item unavailable');
    }

    let unitPrice = item.pricePerPortion;

    // Required modifiers can carry a priceDelta (e.g. "Large" swallow size)
    for (const modifier of item.modifiers) {
      const selection = line.selectedModifiers?.find(
        (m) => m.modifierId === String((modifier as any)._id),
      );
      if (modifier.isRequired && !selection) {
        throw new BadRequestException(`Missing required modifier: ${modifier.name}`);
      }
      if (selection) {
        const option = modifier.options.find(
          (o) => String((o as any)._id) === selection.optionId,
        );
        if (option) unitPrice += option.priceDelta;
      }
    }

    const baseTotal = unitPrice * line.quantity;
    const addOnTotal = await this.calculateAddOnTotal(line.addOns ?? []);

    return baseTotal + addOnTotal;
  }

  // ---- Pack: fixed bundlePrice × quantity + add-ons (no per-component pricing) ----
  private async calculatePackLine(line: CartPackLine): Promise<number> {
    const pack = await this.packModel.findById(line.packId).lean();
    if (!pack || !pack.isAvailable) {
      throw new BadRequestException('Pack unavailable');
    }

    const baseTotal = pack.bundlePrice * line.quantity;
    const addOnTotal = await this.calculateAddOnTotal(line.addOns ?? []);

    return baseTotal + addOnTotal;
  }

  // ---- Shared: extras are additive, grouped, and validated against min/max ----
  private async calculateAddOnTotal(selections: CartAddOnSelection[]): Promise<number> {
    let total = 0;

    for (const selection of selections) {
      const group = await this.addOnGroupModel.findById(selection.addOnGroupId).lean();
      if (!group || !group.isActive) continue;

      let totalSelectedInGroup = 0;
      for (const opt of selection.options) {
        totalSelectedInGroup += opt.quantity;
      }

      if (totalSelectedInGroup < group.minSelect) {
        throw new BadRequestException(`"${group.name}" requires at least ${group.minSelect} selection(s)`);
      }
      if (group.maxSelect !== null && totalSelectedInGroup > group.maxSelect) {
        throw new BadRequestException(`"${group.name}" allows at most ${group.maxSelect} selection(s)`);
      }
      if (group.selectionType === 'single' && totalSelectedInGroup > 1) {
        throw new BadRequestException(`"${group.name}" only allows one selection`);
      }

      for (const opt of selection.options) {
        const option = group.options.find((o) => String((o as any)._id) === opt.optionId);
        if (option && option.isAvailable) {
          total += option.price * opt.quantity;
        }
      }
    }

    return total;
  }
}
