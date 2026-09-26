import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { LegalAcceptance } from 'src/modules/identity/entities/legal-acceptance.entity';
import { UserPersona } from 'src/modules/identity/entities/user-persona.entity';
import { LegalDocumentType } from 'src/modules/identity/enums/legal-document-type.enum';
import { UserPersonaType } from 'src/modules/identity/enums/user-persona-type.enum';
import { OrganizationMembership } from 'src/modules/organization/entities/organization-membership.entity';
import { Organization } from 'src/modules/organization/entities/organization.entity';
import { OrganizationMembershipRole } from 'src/modules/organization/enums/organization-membership-role.enum';
import { OrganizationMembershipStatus } from 'src/modules/organization/enums/organization-membership-status.enum';
import { OrganizationType } from 'src/modules/organization/enums/organization-type.enum';
import { OrganizationVerificationStatus } from 'src/modules/organization/enums/organization-verification-status.enum';
import { ProfessionalAvailability } from 'src/modules/professional/entities/professional-availability.entity';
import { ProfessionalReview } from 'src/modules/professional/entities/professional-review.entity';
import {
  ConsultationType,
  Professional,
} from 'src/modules/professional/entities/professional.entity';
import { Speciality } from 'src/modules/speciality/entities/speciality.entity';
import { User } from 'src/modules/user/entities/user.entity';
import { AccountStatus } from 'src/modules/user/enums/account-status.enum';
import { UserRole } from 'src/modules/user/enums/user-role.enum';

// ── Date helpers ──────────────────────────────────────────────────────────────

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function formatDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ── Password helper ───────────────────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  // eslint-disable-next-line no-restricted-syntax
  const saltRounds = parseInt(process.env.HASH_SALT ?? '10', 10);
  return bcrypt.hash(plain, saltRounds);
}

// ── Find-or-create helpers ────────────────────────────────────────────────────

interface IFindOrCreateResult<T> {
  entity: T;
  created: boolean;
}

// Seeded accounts skip the verification challenge and land directly in the
// `active` lifecycle state. `is_active`/`is_verified` are legacy mirrors of
// `account_status` and are written only so the legacy guards keep working
// until they are removed (docs/05-rework-plan.md, step 7).
export async function findOrCreateUser(
  repo: Repository<User>,
  data: {
    email: string;
    password_plain: string;
    first_name: string;
    last_name: string;
    role: UserRole[];
  },
): Promise<IFindOrCreateResult<User>> {
  const email = data.email.trim().toLowerCase();
  const existing = await repo.findOne({ where: { email } });
  if (existing) {
    return { entity: existing, created: false };
  }
  const password = await hashPassword(data.password_plain);
  const user = repo.create({
    email,
    password,
    first_name: data.first_name,
    last_name: data.last_name,
    role: data.role,
    account_status: AccountStatus.ACTIVE,
    email_verified_at: new Date(),
    is_active: true,
    is_verified: true,
  });
  const saved = await repo.save(user);
  return { entity: saved, created: true };
}

// ── Identity helpers ──────────────────────────────────────────────────────────

// Personas describe how a human uses OHealth. They are not authorization roles
// and never imply organization access (docs/03-domain-model.md).
export async function ensureUserPersona(
  repo: Repository<UserPersona>,
  data: { user_id: string; persona_type: UserPersonaType },
): Promise<IFindOrCreateResult<UserPersona>> {
  const existing = await repo.findOne({
    where: { user_id: data.user_id, persona_type: data.persona_type },
  });
  if (existing) {
    return { entity: existing, created: false };
  }
  const persona = repo.create({
    user_id: data.user_id,
    persona_type: data.persona_type,
    is_active: true,
  });
  const saved = await repo.save(persona);
  return { entity: saved, created: true };
}

// Legal acceptance is versioned evidence, not a boolean on the signup request.
export async function ensureLegalAcceptance(
  repo: Repository<LegalAcceptance>,
  data: {
    user_id: string;
    document_type: LegalDocumentType;
    document_version: string;
  },
): Promise<IFindOrCreateResult<LegalAcceptance>> {
  const existing = await repo.findOne({
    where: {
      user_id: data.user_id,
      document_type: data.document_type,
      document_version: data.document_version,
    },
  });
  if (existing) {
    return { entity: existing, created: false };
  }
  const acceptance = repo.create({
    user_id: data.user_id,
    document_type: data.document_type,
    document_version: data.document_version,
    accepted_at: new Date(),
    ip_address: null,
    user_agent: 'ohealth-seed',
  });
  const saved = await repo.save(acceptance);
  return { entity: saved, created: true };
}

// ── Organization helpers ──────────────────────────────────────────────────────

export async function findOrCreateOrganization(
  repo: Repository<Organization>,
  data: {
    organization_type: OrganizationType;
    name: string;
    registration_number: string;
    location: string;
    contact_email: string;
    contact_phone: string;
    verification_status: OrganizationVerificationStatus;
  },
): Promise<IFindOrCreateResult<Organization>> {
  const existing = await repo.findOne({
    where: { registration_number: data.registration_number },
  });
  if (existing) {
    return { entity: existing, created: false };
  }
  const organization = repo.create({
    organization_type: data.organization_type,
    name: data.name,
    registration_number: data.registration_number,
    location: data.location,
    contact_email: data.contact_email,
    contact_phone: data.contact_phone,
    verification_status: data.verification_status,
    rejection_reason: null,
    is_active: true,
  });
  const saved = await repo.save(organization);
  return { entity: saved, created: true };
}

// Organization access is always scoped to one organization through a
// membership — never through a global user role.
export async function ensureOrganizationMembership(
  repo: Repository<OrganizationMembership>,
  data: {
    organization_id: string;
    user_id: string;
    role: OrganizationMembershipRole;
  },
): Promise<IFindOrCreateResult<OrganizationMembership>> {
  const existing = await repo.findOne({
    where: { organization_id: data.organization_id, user_id: data.user_id },
  });
  if (existing) {
    return { entity: existing, created: false };
  }
  const membership = repo.create({
    organization_id: data.organization_id,
    user_id: data.user_id,
    role: data.role,
    status: OrganizationMembershipStatus.ACTIVE,
    permission_overrides: [],
    invited_by_user_id: null,
    joined_at: new Date(),
  });
  const saved = await repo.save(membership);
  return { entity: saved, created: true };
}

export async function findOrCreateSpeciality(
  repo: Repository<Speciality>,
  data: {
    name: string;
    description?: string;
    icon?: string;
    is_active?: boolean;
  },
): Promise<IFindOrCreateResult<Speciality>> {
  const existing = await repo.findOne({ where: { name: data.name } });
  if (existing) {
    return { entity: existing, created: false };
  }
  const speciality = repo.create({
    name: data.name,
    description: data.description,
    icon: data.icon,
    is_active: data.is_active ?? true,
  });
  const saved = await repo.save(speciality);
  return { entity: saved, created: true };
}

export async function findOrCreateProfessional(
  repo: Repository<Professional>,
  data: {
    user_id: string;
    speciality_id: string;
    image?: string;
    about?: string;
    years_of_experience: number;
    consultation_fee: number;
    consultation_type: ConsultationType;
    is_available: boolean;
    is_active: boolean;
  },
): Promise<IFindOrCreateResult<Professional>> {
  const existing = await repo.findOne({ where: { user_id: data.user_id } });
  if (existing) {
    return { entity: existing, created: false };
  }
  const professional = repo.create({
    user_id: data.user_id,
    speciality_id: data.speciality_id,
    image: data.image,
    about: data.about,
    years_of_experience: data.years_of_experience,
    consultation_fee: data.consultation_fee,
    consultation_type: data.consultation_type,
    is_available: data.is_available,
    is_active: data.is_active,
  });
  const saved = await repo.save(professional);
  return { entity: saved, created: true };
}

export async function findOrCreateAvailability(
  repo: Repository<ProfessionalAvailability>,
  data: {
    professional_id: string;
    date: string;
    start_time: string;
    end_time: string;
  },
): Promise<IFindOrCreateResult<ProfessionalAvailability>> {
  const existing = await repo.findOne({
    where: {
      professional_id: data.professional_id,
      date: data.date,
      start_time: data.start_time,
    },
  });
  if (existing) {
    return { entity: existing, created: false };
  }
  const availability = repo.create({
    professional_id: data.professional_id,
    date: data.date,
    start_time: data.start_time,
    end_time: data.end_time,
    is_available: true,
  });
  const saved = await repo.save(availability);
  return { entity: saved, created: true };
}

// Unique per seed: one review per (reviewer, professional) pair.
// There is no DB-level unique constraint on this combination, but the seed
// enforces it so repeated runs do not accumulate duplicate review rows.
export async function findOrCreateReview(
  repo: Repository<ProfessionalReview>,
  data: {
    reviewer_id: string;
    professional_id: string;
    rating: number;
    comment?: string;
  },
): Promise<IFindOrCreateResult<ProfessionalReview>> {
  const existing = await repo.findOne({
    where: {
      reviewer_id: data.reviewer_id,
      professional_id: data.professional_id,
    },
  });
  if (existing) {
    return { entity: existing, created: false };
  }
  const review = repo.create({
    reviewer_id: data.reviewer_id,
    professional_id: data.professional_id,
    rating: data.rating,
    comment: data.comment,
  });
  const saved = await repo.save(review);
  return { entity: saved, created: true };
}

// ── Rating recalculation ──────────────────────────────────────────────────────

export async function recalculateProfessionalRating(
  profRepo: Repository<Professional>,
  reviewRepo: Repository<ProfessionalReview>,
  professionalId: string,
): Promise<void> {
  const result = await reviewRepo
    .createQueryBuilder('r')
    .select('AVG(r.rating)', 'avg')
    .addSelect('COUNT(r.id)', 'count')
    .where('r.professional_id = :id', { id: professionalId })
    .getRawOne<{ avg: string; count: string }>();

  const rating = parseFloat(result?.avg ?? '0') || 0;
  const totalReviews = parseInt(result?.count ?? '0', 10) || 0;

  await profRepo.update(professionalId, {
    rating: Math.round(rating * 100) / 100,
    total_reviews: totalReviews,
  });
}
