const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'backend/src/modules/orders/services/negotiation.service.ts');
let content = fs.readFileSync(file, 'utf8');

// Import SystemSetting
if (!content.includes('SystemSetting')) {
  content = content.replace(
    `import { User } from '../../users/schemas/user.schema';`,
    `import { User } from '../../users/schemas/user.schema';\nimport { SystemSetting } from '../../admin/schemas/system-setting.schema';`
  );
}

// Inject SystemSettingModel
if (!content.includes('settingModel')) {
  content = content.replace(
    `@InjectModel(User.name) private readonly userModel: Model<User>,`,
    `@InjectModel(User.name) private readonly userModel: Model<User>,\n    @InjectModel(SystemSetting.name) private readonly settingModel: Model<SystemSetting>,`
  );
}

// Update acceptBid signature
content = content.replace(
  `async acceptBid(orderId: string, bidId: string) {`,
  `async acceptBid(orderId: string, bidId: string, customerId?: string) {`
);

// Add customerId check
if (!content.includes('Not your order')) {
  content = content.replace(
    `if (!order) {\n      throw new NotFoundException('Order not found');\n    }`,
    `if (!order) {\n      throw new NotFoundException('Order not found');\n    }\n    if (customerId && order.customer.toString() !== customerId.toString()) throw new BadRequestException('Not your order');`
  );
}

// Replace the total calculation
const oldTotalCode = `    // Update total (delivery fee wasn't added to total yet, or if it was, it was proposed)
    // First remove proposed, then add agreed
    if (order.proposedDeliveryFee) {
        order.total = order.total - order.proposedDeliveryFee + bid.bidAmount;
    } else {
        order.total = order.total + bid.bidAmount;
    }
    order.deliveryFee = bid.bidAmount;`;

const newTotalCode = `    // Process commission logic
    const newFee = bid.bidAmount;
    const baseTotal = order.total - (order.proposedDeliveryFee || 0);
    const total = baseTotal + newFee;
    
    const errandSetting = await this.settingModel.findOne({ key: 'custom_errand' }).exec();
    const commissionPercent = errandSetting?.value?.customErrandCommissionPercentage ?? 20;
    const commissionAmount = Math.round(newFee * (commissionPercent / 100)); 
    const erranderShare = newFee - commissionAmount;
    const platformShare = (order.platformShare || 0) + commissionAmount - Math.round((order.deliveryFee || 0) * (commissionPercent / 100));

    order.deliveryFee = newFee;
    order.erranderShare = erranderShare;
    order.platformShare = platformShare;
    order.erranderPayout = erranderShare;
    order.total = total;`;

content = content.replace(oldTotalCode, newTotalCode);

fs.writeFileSync(file, content);
console.log('Patched negotiation.service.ts');
