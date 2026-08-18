export function checkIsOpen(vendor: any): { isOpen: boolean; message: string } {
  if (!vendor.isOnline) return { isOpen: false, message: 'Closed (Manual)' };

  const now = new Date();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const currentDay = dayNames[now.getDay()];
  const currentTime = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');

  let openTime = vendor.openingTime || '08:00';
  let closeTime = vendor.closingTime || '20:00';
  let isClosedForDay = false;

  // If businessHours exists, check if ALL days are closed (meaning the user ignored the Weekly Schedule and just turned them all off)
  const allDaysClosed = vendor.businessHours && vendor.businessHours.length > 0 && vendor.businessHours.every((bh: any) => bh.isClosed);

  if (vendor.businessHours && vendor.businessHours.length > 0 && !allDaysClosed) {
    const dayConfig = vendor.businessHours.find((bh: any) => bh.day === currentDay);
    if (dayConfig) {
      if (dayConfig.isClosed) {
        isClosedForDay = true;
      } else {
        openTime = dayConfig.open || openTime;
        closeTime = dayConfig.close || closeTime;
      }
    }
  }

  if (isClosedForDay) {
    return { isOpen: false, message: 'Closed for the day' };
  }

  if (currentTime < openTime || currentTime > closeTime) {
    // Format to 12h for a prettier message if possible, or just keep as is
    return { isOpen: false, message: `Closed (Opens at ${openTime})` };
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
