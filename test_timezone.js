const now = new Date();
const lagosTimeStr = now.toLocaleString('en-US', { timeZone: 'Africa/Lagos', hour12: false });
const [datePart, timePart] = lagosTimeStr.split(', ');
const [hour, minute] = timePart.split(':');
const currentTime = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
const dayIndex = new Date(lagosTimeStr).getDay();
const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const currentDay = dayNames[dayIndex];
console.log({ currentTime, currentDay });
