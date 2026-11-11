/**
 * One referral code format, everywhere: ERR-FIRSTNAME.
 *
 * Names repeat — two students called Abah, three called Test — so the base is the first name and
 * a number only appears when it is needed.
 *
 * A referral code is money: whoever holds it gets credited for everyone who signs up with it. Two
 * students sharing a code means one of them is paid for the other's referrals, and nobody finds
 * out until somebody complains. Hence the collision check, which must run against the database
 * rather than being assumed.
 */
export const REFERRAL_PREFIX = 'ERR';

export function referralCodeBase(firstName?: string): string {
  const cleaned = String(firstName || '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    // Long enough to stay recognisable, short enough to type on a phone.
    .slice(0, 14);

  return `${REFERRAL_PREFIX}-${cleaned || 'USER'}`;
}

/**
 * ERR-ABAH, then ERR-ABAH2, ERR-ABAH3 …
 *
 * The first claimant keeps the clean code; later arrivals get a suffix. Appending reads better
 * than a random string and stays guessable, which is the point of using a name at all.
 */
export async function uniqueReferralCode(
  firstName: string | undefined,
  exists: (code: string) => Promise<boolean>,
  excludeUserId?: string,
): Promise<string> {
  const base = referralCodeBase(firstName);

  if (!(await exists(base))) return base;

  for (let n = 2; n < 500; n += 1) {
    const candidate = `${base}${n}`;
    if (!(await exists(candidate))) return candidate;
  }

  // Practically unreachable; better than returning a duplicate that would split someone's credit.
  return `${base}${Date.now().toString(36).toUpperCase().slice(-4)}`;
}
