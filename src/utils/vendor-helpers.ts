export function checkIsOpen(vendor: any): { isOpen: boolean; message: string } {
  if (!vendor.isOnline) return { isOpen: false, message: 'Closed (Manual)' };

  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()];
  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

  const dayConfig = vendor.businessHours?.find((bh: any) => bh.day === currentDay);
  
  if (!dayConfig || dayConfig.isClosed) {
    return { isOpen: false, message: 'Closed for the day' };
  }

  if (currentTime < dayConfig.open || currentTime > dayConfig.close) {
    return { isOpen: false, message: `Closed (Opens at ${dayConfig.open})` };
  }

  if (vendor.breakPeriod?.enabled) {
    if (currentTime >= vendor.breakPeriod.start && currentTime <= vendor.breakPeriod.end) {
      return { isOpen: false, message: `Currently on break (Until ${vendor.breakPeriod.end})` };
    }
  }

  return { isOpen: true, message: 'Open Now' };
}

export function augmentVendor(vendor: any) {
  if (!vendor) return null;
  const { isOpen, message } = checkIsOpen(vendor);
  const vendorObj = vendor.toObject ? vendor.toObject() : vendor;
  return {
    ...vendorObj,
    isOpen,
    statusMessage: message,
  };
}
