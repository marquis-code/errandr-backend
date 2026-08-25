import { checkIsOpen } from '../src/utils/vendor-helpers';

const vendor = {
    isOnline: true,
    openingTime: "19:00",
    closingTime: "23:00",
    businessHours: [
        {
            day: "monday",
            open: "19:00",
            close: "23:00",
            isClosed: false
        }
    ]
};

console.log(checkIsOpen(vendor));
