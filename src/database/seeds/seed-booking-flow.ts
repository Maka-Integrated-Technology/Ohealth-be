/* eslint-disable no-restricted-syntax */
/* eslint-disable no-console */
/* eslint-disable import/order */
import 'reflect-metadata';
import * as dotenv from 'dotenv';

dotenv.config();

import { DataSource } from 'typeorm';

import { initializeDataSource } from 'src/database/data-source';
import { ProfessionalAvailability } from 'src/modules/professional/entities/professional-availability.entity';
import { ProfessionalReview } from 'src/modules/professional/entities/professional-review.entity';
import { Professional } from 'src/modules/professional/entities/professional.entity';
import { Speciality } from 'src/modules/speciality/entities/speciality.entity';
import { User } from 'src/modules/user/entities/user.entity';

import {
  AVAILABILITY_DAY_OFFSETS,
  AVAILABILITY_SLOTS,
  DEMO_PATIENT,
  DEMO_SEED_PASSWORD,
  SEED_PROFESSIONALS,
  SEED_REVIEWERS,
  SEED_REVIEWS,
  SEED_SPECIALITIES,
} from './data/booking-seed.data';
import {
  addDays,
  findOrCreateAvailability,
  findOrCreateProfessional,
  findOrCreateReview,
  findOrCreateSpeciality,
  findOrCreateUser,
  formatDate,
  recalculateProfessionalRating,
} from './helpers/seed-utils';

// ── Environment guard ─────────────────────────────────────────────────────────

function checkEnvironment(): void {
  const env = process.env.NODE_ENV;
  const allowedEnvs = [
    undefined,
    '',
    'development',
    'dev',
    'local',
    'localhost',
    'test',
  ];
  if (!allowedEnvs.includes(env)) {
    if (process.env.ALLOW_PRODUCTION_SEED !== 'true') {
      console.error(
        `[seed] Refusing to run in NODE_ENV="${env}". Set ALLOW_PRODUCTION_SEED=true to override.`,
      );
      process.exit(1);
    }
    console.warn(
      '[seed] ALLOW_PRODUCTION_SEED=true — running seed in non-development environment.',
    );
  }
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

export async function runBookingFlowSeed(): Promise<void> {
  checkEnvironment();

  console.log('[seed] Initializing database connection…');
  const ds = await initializeDataSource();

  try {
    await seedBookingFlow(ds);
  } finally {
    await ds.destroy();
  }
}

async function seedBookingFlow(ds: DataSource): Promise<void> {
  const userRepo = ds.getRepository(User);
  const specialityRepo = ds.getRepository(Speciality);
  const professionalRepo = ds.getRepository(Professional);
  const availabilityRepo = ds.getRepository(ProfessionalAvailability);
  const reviewRepo = ds.getRepository(ProfessionalReview);

  const stats = {
    specialities: 0,
    professionalUsers: 0,
    professionals: 0,
    availabilities: 0,
    reviewUsers: 0,
    reviews: 0,
  };

  const skipped: string[] = [];

  // ── 1. Demo patient ────────────────────────────────────────────────────────
  console.log('[seed] Seeding demo patient…');
  const { entity: patient, created: patientCreated } = await findOrCreateUser(
    userRepo,
    {
      ...DEMO_PATIENT,
      password_plain: DEMO_SEED_PASSWORD,
    },
  );
  if (!patientCreated) {
    skipped.push(`Existing user reused: ${patient.email}`);
  }

  // ── 2. Specialities ────────────────────────────────────────────────────────
  console.log('[seed] Seeding specialities…');
  const specialityMap = new Map<string, Speciality>();
  for (const data of SEED_SPECIALITIES) {
    const { entity, created } = await findOrCreateSpeciality(
      specialityRepo,
      data,
    );
    specialityMap.set(entity.name, entity);
    if (created) {
      stats.specialities++;
    } else {
      skipped.push(`Existing speciality reused: ${entity.name}`);
    }
  }

  // ── 3. Reviewer users ──────────────────────────────────────────────────────
  console.log('[seed] Seeding reviewer users…');
  const reviewerMap = new Map<string, User>();
  for (const data of SEED_REVIEWERS) {
    const { entity, created } = await findOrCreateUser(userRepo, {
      ...data,
      password_plain: DEMO_SEED_PASSWORD,
    });
    reviewerMap.set(entity.email, entity);
    if (created) {
      stats.reviewUsers++;
    } else {
      skipped.push(`Existing user reused: ${entity.email}`);
    }
  }

  // ── 4. Professional users + profiles ──────────────────────────────────────
  console.log('[seed] Seeding professional users and profiles…');
  const professionalProfileMap = new Map<string, Professional>(); // key = user email

  for (const entry of SEED_PROFESSIONALS) {
    const { entity: profUser, created: userCreated } = await findOrCreateUser(
      userRepo,
      {
        ...entry.user,
        password_plain: DEMO_SEED_PASSWORD,
      },
    );
    if (userCreated) {
      stats.professionalUsers++;
    } else {
      skipped.push(`Existing user reused: ${profUser.email}`);
    }

    const speciality = specialityMap.get(entry.speciality_name);
    if (!speciality) {
      throw new Error(
        `[seed] Speciality not seeded: "${entry.speciality_name}"`,
      );
    }

    const { entity: professional, created: profCreated } =
      await findOrCreateProfessional(professionalRepo, {
        ...entry.profile,
        user_id: profUser.id,
        speciality_id: speciality.id,
      });
    professionalProfileMap.set(entry.user.email, professional);
    if (profCreated) {
      stats.professionals++;
    } else {
      skipped.push(`Existing professional reused: ${profUser.email}`);
    }
  }

  // ── 5. Availability slots ──────────────────────────────────────────────────
  console.log('[seed] Seeding availability slots…');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const professional of professionalProfileMap.values()) {
    for (const offset of AVAILABILITY_DAY_OFFSETS) {
      const date = formatDate(addDays(today, offset));
      for (const slot of AVAILABILITY_SLOTS) {
        const { created } = await findOrCreateAvailability(availabilityRepo, {
          professional_id: professional.id,
          date,
          start_time: slot.start_time,
          end_time: slot.end_time,
        });
        if (created) {
          stats.availabilities++;
        }
      }
    }
  }

  // ── 6. Reviews ────────────────────────────────────────────────────────────
  console.log('[seed] Seeding reviews…');
  for (const reviewData of SEED_REVIEWS) {
    const reviewer = reviewerMap.get(reviewData.reviewer_email);
    if (!reviewer) {
      console.warn(
        `[seed] Reviewer not found in seed map: ${reviewData.reviewer_email}`,
      );
      continue;
    }
    const professional = professionalProfileMap.get(
      reviewData.professional_email,
    );
    if (!professional) {
      console.warn(
        `[seed] Professional not found in seed map: ${reviewData.professional_email}`,
      );
      continue;
    }
    const { created } = await findOrCreateReview(reviewRepo, {
      reviewer_id: reviewer.id,
      professional_id: professional.id,
      rating: reviewData.rating,
      comment: reviewData.comment,
    });
    if (created) {
      stats.reviews++;
    }
  }

  // ── 7. Recalculate denormalized ratings ────────────────────────────────────
  console.log('[seed] Recalculating professional ratings…');
  for (const professional of professionalProfileMap.values()) {
    await recalculateProfessionalRating(
      professionalRepo,
      reviewRepo,
      professional.id,
    );
  }

  // ── 8. Summary ─────────────────────────────────────────────────────────────
  if (skipped.length > 0) {
    console.log('\nSkipped (already exist):');
    for (const msg of skipped) {
      console.log(`  ${msg}`);
    }
  }

  console.log(`
Seed complete:
  - Specialities:        ${stats.specialities}
  - Professional users:  ${stats.professionalUsers}
  - Professionals:       ${stats.professionals}
  - Availability slots:  ${stats.availabilities}
  - Review users:        ${stats.reviewUsers}
  - Reviews:             ${stats.reviews}

Demo patient:
  email:    ${patient.email}
  password: ${DEMO_SEED_PASSWORD}
`);
}
