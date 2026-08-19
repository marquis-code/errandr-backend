const now = new Date();
const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Africa/Lagos',
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'long'
});
const parts = formatter.formatToParts(now);
const getPart = (type) => parts.find(p => p.type === type)?.value || '';
const currentDay = getPart('weekday').toLowerCase();
let hour = getPart('hour');
if (hour === '24') hour = '00';
const currentTime = `${hour}:${getPart('minute')}`;
console.log({ currentTime, currentDay });
