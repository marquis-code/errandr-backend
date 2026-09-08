  @Cron(CronExpression.EVERY_MINUTE)
  async autoOpenVendors() {
    try {
      // Find all vendors that are currently offline
      const vendors = await this.vendorModel.find({ status: 'approved', isOnline: false });
      if (!vendors.length) return;

      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Africa/Lagos',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'long'
      });
      
      const parts = formatter.formatToParts(now);
      const getPart = (type: string) => parts.find(p => p.type === type)?.value || '';
      
      const currentDay = getPart('weekday').toLowerCase();
      let hour = getPart('hour');
      if (hour === '24') hour = '00';
      const currentTime = `${hour}:${getPart('minute')}`;

      for (const vendor of vendors) {
        let openTime = vendor.openingTime || '08:00';
        let isClosedForDay = false;

        const allDaysClosed = vendor.businessHours && vendor.businessHours.length > 0 && vendor.businessHours.every((bh: any) => bh.isClosed);

        if (vendor.businessHours && vendor.businessHours.length > 0 && !allDaysClosed) {
          const dayConfig = vendor.businessHours.find((bh: any) => bh.day === currentDay);
          if (dayConfig) {
            if (dayConfig.isClosed) {
              isClosedForDay = true;
            } else {
              openTime = dayConfig.open || openTime;
            }
          }
        }

        if (isClosedForDay) continue;

        // If the current time is exactly their opening time, or if the current time is within 5 minutes of their opening time
        // Actually, just checking exact match is fine if it runs every minute. 
        // But to be safe against downtime, maybe if currentTime is between openTime and openTime + 5 mins?
        // Let's just do exact match, or if we want to catch up, we can check if it's the exact minute.
        
        if (currentTime === openTime) {
          vendor.isOnline = true;
          await vendor.save();
          this.logger.log(`Auto-opened vendor ${vendor.storeName} at their scheduled time: ${openTime}`);
        }
      }
    } catch (error) {
      this.logger.error(`Error in autoOpenVendors cron: ${error.message}`);
    }
  }
