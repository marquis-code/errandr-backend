import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Institution } from './schemas/institution.schema';

/** Header the mobile app sends to select the campus it is browsing. */
export const INSTITUTION_HEADER = 'x-institution-id';

/**
 * Turns a request into the institution that should scope a query.
 *
 * Precedence (from the design contract):
 *   1. the `X-Institution-Id` header (ObjectId OR slug),
 *   2. the authenticated user's `institution`,
 *   3. `null` — meaning "do not scope", the public/legacy behaviour.
 *
 * TENANCY RULE: a user pinned to institution A can never be scoped to
 * institution B, even by sending B's id in the header. The header only
 * selects among public campuses for guests; for a pinned user it merely
 * confirms (and is otherwise ignored), so it can never widen nor move
 * their tenancy. This is enforced by returning the user's own institution
 * before the header is ever consulted.
 *
 * Always returns a `Types.ObjectId` or `null` — never a string.
 */
@Injectable()
export class InstitutionResolver {
  constructor(
    @InjectModel(Institution.name) private institutionModel: Model<Institution>,
  ) {}

  async resolve(req: any): Promise<Types.ObjectId | null> {
    // 2. The authenticated user's own institution always wins — see TENANCY RULE.
    const userInstitution = this.toObjectId(req?.user?.institution);
    if (userInstitution) return userInstitution;

    // 1. Guests (and unpinned users) may pick a campus with the header.
    const headerValue = this.readHeader(req);
    if (!headerValue) return null;

    // The header accepts an ObjectId or a slug.
    const institution = Types.ObjectId.isValid(headerValue)
      ? await this.institutionModel.findById(headerValue).select('_id').exec()
      : await this.institutionModel
          .findOne({ slug: headerValue.toLowerCase() })
          .select('_id')
          .exec();

    // 3. Unknown header values fall back to "do not scope" rather than throwing,
    // so a stale selection in the app cannot break unrelated reads.
    return institution ? (institution._id as Types.ObjectId) : null;
  }

  /** Header names are lower-cased by Express; tolerate arrays and blank values. */
  private readHeader(req: any): string {
    const raw = req?.headers?.[INSTITUTION_HEADER];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (typeof value !== 'string') return '';
    return value.trim();
  }

  /** Accepts an ObjectId, a populated institution document, or nothing. */
  private toObjectId(value: any): Types.ObjectId | null {
    if (!value) return null;
    const id = typeof value === 'object' && value._id ? value._id : value;
    if (id instanceof Types.ObjectId) return id;
    if (typeof id === 'string' && Types.ObjectId.isValid(id)) {
      return new Types.ObjectId(id);
    }
    return null;
  }
}
