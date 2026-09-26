import { LegalDocumentType } from 'src/modules/identity/enums/legal-document-type.enum';
import { UserPersonaType } from 'src/modules/identity/enums/user-persona-type.enum';
import { OrganizationMembershipRole } from 'src/modules/organization/enums/organization-membership-role.enum';
import { OrganizationType } from 'src/modules/organization/enums/organization-type.enum';
import { OrganizationVerificationStatus } from 'src/modules/organization/enums/organization-verification-status.enum';
import { ConsultationType } from 'src/modules/professional/entities/professional.entity';
import { UserRole } from 'src/modules/user/enums/user-role.enum';

export const DEMO_SEED_PASSWORD = 'Password123!';

// Versions recorded against every seeded account, so the legal-acceptance
// evidence trail is populated the same way registration will populate it.
export const SEED_LEGAL_DOCUMENT_VERSIONS: ReadonlyArray<{
  document_type: LegalDocumentType;
  document_version: string;
}> = [
  {
    document_type: LegalDocumentType.TERMS_OF_SERVICE,
    document_version: '1.0',
  },
  { document_type: LegalDocumentType.PRIVACY_POLICY, document_version: '1.0' },
];

export interface ISpecialitySeedData {
  name: string;
  description: string;
  icon: string;
  is_active: boolean;
}

export interface IUserSeedData {
  email: string;
  first_name: string;
  last_name: string;
  // Authoritative under the reworked identity model.
  personas: UserPersonaType[];
  // Legacy role array, retained only while the legacy guards still read it.
  role: UserRole[];
}

export interface IProfessionalProfileSeedData {
  image: string;
  about: string;
  years_of_experience: number;
  consultation_fee: number;
  consultation_type: ConsultationType;
  is_available: boolean;
  is_active: boolean;
}

export interface IProfessionalEntrySeedData {
  user: IUserSeedData;
  profile: IProfessionalProfileSeedData;
  speciality_name: string;
}

export interface IReviewSeedData {
  reviewer_email: string;
  professional_email: string;
  rating: number;
  comment: string;
}

export interface ITimeSlot {
  start_time: string;
  end_time: string;
}

// ── Demo patient ─────────────────────────────────────────────────────────────

export const DEMO_PATIENT: IUserSeedData = {
  email: 'patient.demo@healthbridge.test',
  first_name: 'Olivia',
  last_name: 'Jane',
  personas: [UserPersonaType.PATIENT],
  role: [UserRole.PATIENT],
};

// ── Specialities ─────────────────────────────────────────────────────────────

export const SEED_SPECIALITIES: ISpecialitySeedData[] = [
  {
    name: 'General Doctor',
    description:
      'Primary care consultations for common symptoms, checkups, and general health concerns.',
    icon: 'general-doctor',
    is_active: true,
  },
  {
    name: 'Nurse',
    description:
      'Nursing support, care guidance, vitals review, and follow-up health education.',
    icon: 'nurse',
    is_active: true,
  },
  {
    name: 'Nutritionist',
    description:
      'Diet, meal planning, weight management, and nutrition support.',
    icon: 'nutritionist',
    is_active: true,
  },
  {
    name: 'Counsellor',
    description:
      'Mental wellness, stress management, emotional support, and counselling sessions.',
    icon: 'counsellor',
    is_active: true,
  },
];

// ── Professional users + profiles ─────────────────────────────────────────────
// Every entry carries the healthcare-professional persona; the discipline lives
// in the speciality, never in the persona or the legacy role. The legacy role
// values below exist only to satisfy the role guards that are still in place.

export const SEED_PROFESSIONALS: IProfessionalEntrySeedData[] = [
  // ── General Doctor ────────────────────────────────────────────────────────
  {
    user: {
      email: 'pro.general.adebayo@healthbridge.test',
      first_name: 'Adebayo',
      last_name: 'Okafor',
      personas: [UserPersonaType.HEALTHCARE_PROFESSIONAL],
      role: [UserRole.DOCTOR],
    },
    profile: {
      image: 'https://i.pravatar.cc/150?u=pro.general.adebayo',
      about:
        'Dr. Adebayo Okafor is a seasoned general practitioner with over 12 years of experience in primary care, chronic disease management, and preventive health.',
      years_of_experience: 12,
      consultation_fee: 6500,
      consultation_type: ConsultationType.BOTH,
      is_available: true,
      is_active: true,
    },
    speciality_name: 'General Doctor',
  },
  {
    user: {
      email: 'pro.general.aisha@healthbridge.test',
      first_name: 'Aisha',
      last_name: 'Bello',
      personas: [UserPersonaType.HEALTHCARE_PROFESSIONAL],
      role: [UserRole.DOCTOR],
    },
    profile: {
      image: 'https://i.pravatar.cc/150?u=pro.general.aisha',
      about:
        "Dr. Aisha Bello specialises in family medicine and women's health with 8 years of clinical experience. She is known for her patient-centred approach.",
      years_of_experience: 8,
      consultation_fee: 5000,
      consultation_type: ConsultationType.VIDEO,
      is_available: true,
      is_active: true,
    },
    speciality_name: 'General Doctor',
  },
  {
    user: {
      email: 'pro.general.chisom@healthbridge.test',
      first_name: 'Chisom',
      last_name: 'Obi',
      personas: [UserPersonaType.HEALTHCARE_PROFESSIONAL],
      role: [UserRole.DOCTOR],
    },
    profile: {
      image: 'https://i.pravatar.cc/150?u=pro.general.chisom',
      about:
        'Dr. Chisom Obi is a general physician focused on acute care, health assessments, and managing long-term conditions. 10 years of hospital and telehealth experience.',
      years_of_experience: 10,
      consultation_fee: 7000,
      consultation_type: ConsultationType.CHAT,
      is_available: true,
      is_active: true,
    },
    speciality_name: 'General Doctor',
  },
  // ── Nurse (legacy role LAB_PROFESSIONAL — UserRole has no NURSE variant) ──
  {
    user: {
      email: 'pro.nurse.fatima@healthbridge.test',
      first_name: 'Fatima',
      last_name: 'Bello',
      personas: [UserPersonaType.HEALTHCARE_PROFESSIONAL],
      role: [UserRole.LAB_PROFESSIONAL],
    },
    profile: {
      image: 'https://i.pravatar.cc/150?u=pro.nurse.fatima',
      about:
        'Fatima Bello is a registered nurse with 6 years of clinical experience providing care guidance, vitals review, and patient education.',
      years_of_experience: 6,
      consultation_fee: 3000,
      consultation_type: ConsultationType.BOTH,
      is_available: true,
      is_active: true,
    },
    speciality_name: 'Nurse',
  },
  {
    user: {
      email: 'pro.nurse.daniel@healthbridge.test',
      first_name: 'Daniel',
      last_name: 'Mensah',
      personas: [UserPersonaType.HEALTHCARE_PROFESSIONAL],
      role: [UserRole.LAB_PROFESSIONAL],
    },
    profile: {
      image: 'https://i.pravatar.cc/150?u=pro.nurse.daniel',
      about:
        'Daniel Mensah is a community health nurse with 4 years of experience in follow-up care, health education, and chronic condition monitoring.',
      years_of_experience: 4,
      consultation_fee: 2500,
      consultation_type: ConsultationType.CHAT,
      is_available: true,
      is_active: true,
    },
    speciality_name: 'Nurse',
  },
  // ── Nutritionist ──────────────────────────────────────────────────────────
  {
    user: {
      email: 'pro.nutritionist.ngozi@healthbridge.test',
      first_name: 'Ngozi',
      last_name: 'Eze',
      personas: [UserPersonaType.HEALTHCARE_PROFESSIONAL],
      role: [UserRole.DOCTOR],
    },
    profile: {
      image: 'https://i.pravatar.cc/150?u=pro.nutritionist.ngozi',
      about:
        'Dr. Ngozi Eze is a clinical nutritionist with 9 years of experience helping patients achieve their health goals through personalised diet plans and lifestyle coaching.',
      years_of_experience: 9,
      consultation_fee: 5500,
      consultation_type: ConsultationType.BOTH,
      is_available: true,
      is_active: true,
    },
    speciality_name: 'Nutritionist',
  },
  {
    user: {
      email: 'pro.nutritionist.maya@healthbridge.test',
      first_name: 'Maya',
      last_name: 'Okonkwo',
      personas: [UserPersonaType.HEALTHCARE_PROFESSIONAL],
      role: [UserRole.THERAPIST],
    },
    profile: {
      image: 'https://i.pravatar.cc/150?u=pro.nutritionist.maya',
      about:
        'Maya Okonkwo is a certified nutritional therapist specialising in weight management, gut health, and sports nutrition with 5 years of practice.',
      years_of_experience: 5,
      consultation_fee: 4500,
      consultation_type: ConsultationType.VIDEO,
      is_available: true,
      is_active: true,
    },
    speciality_name: 'Nutritionist',
  },
  // ── Counsellor ────────────────────────────────────────────────────────────
  {
    user: {
      email: 'pro.counsellor.emeka@healthbridge.test',
      first_name: 'Emeka',
      last_name: 'Nwosu',
      personas: [UserPersonaType.HEALTHCARE_PROFESSIONAL],
      role: [UserRole.COUNSELLOR],
    },
    profile: {
      image: 'https://i.pravatar.cc/150?u=pro.counsellor.emeka',
      about:
        'Dr. Emeka Nwosu is a licensed counsellor with 11 years of experience in cognitive behavioural therapy, stress management, and relationship counselling.',
      years_of_experience: 11,
      consultation_fee: 7500,
      consultation_type: ConsultationType.BOTH,
      is_available: true,
      is_active: true,
    },
    speciality_name: 'Counsellor',
  },
  {
    user: {
      email: 'pro.counsellor.tola@healthbridge.test',
      first_name: 'Tola',
      last_name: 'Adeyemi',
      personas: [UserPersonaType.HEALTHCARE_PROFESSIONAL],
      role: [UserRole.COUNSELLOR],
    },
    profile: {
      image: 'https://i.pravatar.cc/150?u=pro.counsellor.tola',
      about:
        'Tola Adeyemi is a mental health counsellor focused on anxiety, grief support, and work-life balance. 7 years of practice in individual and group sessions.',
      years_of_experience: 7,
      consultation_fee: 5500,
      consultation_type: ConsultationType.CHAT,
      is_available: true,
      is_active: true,
    },
    speciality_name: 'Counsellor',
  },
];

// ── Reviewer users ────────────────────────────────────────────────────────────

export const SEED_REVIEWERS: IUserSeedData[] = [
  {
    email: 'reviewer.amara@healthbridge.test',
    first_name: 'Amara',
    last_name: 'Osei',
    personas: [UserPersonaType.PATIENT],
    role: [UserRole.PATIENT],
  },
  {
    email: 'reviewer.john@healthbridge.test',
    first_name: 'John',
    last_name: 'Taiwo',
    personas: [UserPersonaType.PATIENT],
    role: [UserRole.PATIENT],
  },
  {
    email: 'reviewer.zainab@healthbridge.test',
    first_name: 'Zainab',
    last_name: 'Musa',
    personas: [UserPersonaType.PATIENT],
    role: [UserRole.PATIENT],
  },
];

// ── Availability slot templates ───────────────────────────────────────────────
// Applied to each of AVAILABILITY_DAY_OFFSETS for every professional.

export const AVAILABILITY_SLOTS: ITimeSlot[] = [
  { start_time: '09:00', end_time: '09:30' },
  { start_time: '10:30', end_time: '11:00' },
  { start_time: '13:00', end_time: '13:30' },
  { start_time: '15:00', end_time: '15:30' },
];

// Days from today: tomorrow, +2, +3, +4, +6 (mirrors the spec's five future dates)
export const AVAILABILITY_DAY_OFFSETS: number[] = [1, 2, 3, 4, 6];

// ── Reviews ───────────────────────────────────────────────────────────────────
// Each (reviewer_email, professional_email) pair is unique — the seed enforces
// one review per reviewer-professional combination for idempotency.

export const SEED_REVIEWS: IReviewSeedData[] = [
  // General Doctor — Adebayo (3 reviews)
  {
    reviewer_email: 'reviewer.amara@healthbridge.test',
    professional_email: 'pro.general.adebayo@healthbridge.test',
    rating: 5,
    comment:
      'Dr. Okafor was incredibly thorough and attentive. Highly recommend!',
  },
  {
    reviewer_email: 'reviewer.john@healthbridge.test',
    professional_email: 'pro.general.adebayo@healthbridge.test',
    rating: 4,
    comment: 'Very professional and knowledgeable. Great experience overall.',
  },
  {
    reviewer_email: 'reviewer.zainab@healthbridge.test',
    professional_email: 'pro.general.adebayo@healthbridge.test',
    rating: 5,
    comment:
      'Excellent consultation. He listened carefully and explained everything clearly.',
  },
  // General Doctor — Aisha (2 reviews)
  {
    reviewer_email: 'reviewer.amara@healthbridge.test',
    professional_email: 'pro.general.aisha@healthbridge.test',
    rating: 5,
    comment: 'Dr. Bello is wonderful! So warm and professional.',
  },
  {
    reviewer_email: 'reviewer.john@healthbridge.test',
    professional_email: 'pro.general.aisha@healthbridge.test',
    rating: 4,
    comment: 'Great doctor, very thorough checkup.',
  },
  // General Doctor — Chisom (2 reviews)
  {
    reviewer_email: 'reviewer.zainab@healthbridge.test',
    professional_email: 'pro.general.chisom@healthbridge.test',
    rating: 4,
    comment: 'Quick and efficient consultation. Very satisfied.',
  },
  {
    reviewer_email: 'reviewer.amara@healthbridge.test',
    professional_email: 'pro.general.chisom@healthbridge.test',
    rating: 5,
    comment: 'Dr. Obi is amazing, very detailed and patient.',
  },
  // Nurse — Fatima (2 reviews)
  {
    reviewer_email: 'reviewer.john@healthbridge.test',
    professional_email: 'pro.nurse.fatima@healthbridge.test',
    rating: 5,
    comment: 'Fatima was so helpful and reassuring. Felt well cared for.',
  },
  {
    reviewer_email: 'reviewer.zainab@healthbridge.test',
    professional_email: 'pro.nurse.fatima@healthbridge.test',
    rating: 5,
    comment: 'Excellent care and follow-up. Would definitely book again.',
  },
  // Nurse — Daniel (1 review)
  {
    reviewer_email: 'reviewer.amara@healthbridge.test',
    professional_email: 'pro.nurse.daniel@healthbridge.test',
    rating: 4,
    comment: 'Daniel was kind and very informative during our session.',
  },
  // Nutritionist — Ngozi (2 reviews)
  {
    reviewer_email: 'reviewer.john@healthbridge.test',
    professional_email: 'pro.nutritionist.ngozi@healthbridge.test',
    rating: 5,
    comment:
      'Dr. Eze gave me a practical meal plan that actually works. Lost 5kg in a month!',
  },
  {
    reviewer_email: 'reviewer.zainab@healthbridge.test',
    professional_email: 'pro.nutritionist.ngozi@healthbridge.test',
    rating: 4,
    comment: 'Very knowledgeable about gut health. Great advice.',
  },
  // Nutritionist — Maya (2 reviews)
  {
    reviewer_email: 'reviewer.amara@healthbridge.test',
    professional_email: 'pro.nutritionist.maya@healthbridge.test',
    rating: 5,
    comment: "Maya's nutrition plan completely transformed my energy levels!",
  },
  {
    reviewer_email: 'reviewer.john@healthbridge.test',
    professional_email: 'pro.nutritionist.maya@healthbridge.test',
    rating: 4,
    comment: 'Great session, very tailored to my goals.',
  },
  // Counsellor — Emeka (3 reviews)
  {
    reviewer_email: 'reviewer.zainab@healthbridge.test',
    professional_email: 'pro.counsellor.emeka@healthbridge.test',
    rating: 5,
    comment: 'Dr. Nwosu has a calming presence. The session helped me a lot.',
  },
  {
    reviewer_email: 'reviewer.amara@healthbridge.test',
    professional_email: 'pro.counsellor.emeka@healthbridge.test',
    rating: 5,
    comment: 'Excellent counsellor, very empathetic and insightful.',
  },
  {
    reviewer_email: 'reviewer.john@healthbridge.test',
    professional_email: 'pro.counsellor.emeka@healthbridge.test',
    rating: 4,
    comment:
      'Very professional. Helped me understand my stress triggers better.',
  },
  // Counsellor — Tola (2 reviews)
  {
    reviewer_email: 'reviewer.amara@healthbridge.test',
    professional_email: 'pro.counsellor.tola@healthbridge.test',
    rating: 5,
    comment:
      'Tola is so easy to talk to. Really understood what I was going through.',
  },
  {
    reviewer_email: 'reviewer.zainab@healthbridge.test',
    professional_email: 'pro.counsellor.tola@healthbridge.test',
    rating: 4,
    comment: 'Great experience, very helpful session.',
  },
];

// ── Organizations and memberships ─────────────────────────────────────────────
// Organization access is modelled purely through memberships. The seeded
// organization users deliberately include a human who holds both personas and
// belongs to two organizations with different roles — the case the rework must
// support without a second account (docs/03-domain-model.md).

export interface IOrganizationSeedData {
  organization_type: OrganizationType;
  name: string;
  registration_number: string;
  location: string;
  contact_email: string;
  contact_phone: string;
  verification_status: OrganizationVerificationStatus;
}

export interface IOrganizationMembershipSeedData {
  user_email: string;
  organization_registration_number: string;
  role: OrganizationMembershipRole;
}

export const DEMO_HOSPITAL_REGISTRATION_NUMBER = 'RC-SEED-HOSPITAL-001';
export const DEMO_LABORATORY_REGISTRATION_NUMBER = 'RC-SEED-LAB-001';

export const SEED_ORGANIZATIONS: IOrganizationSeedData[] = [
  {
    organization_type: OrganizationType.HOSPITAL,
    name: 'Healthbridge General Hospital',
    registration_number: DEMO_HOSPITAL_REGISTRATION_NUMBER,
    location: '14 Marina Road, Lagos Island, Lagos',
    contact_email: 'contact@hospital.healthbridge.test',
    contact_phone: '+2348000000001',
    verification_status: OrganizationVerificationStatus.APPROVED,
  },
  {
    organization_type: OrganizationType.LABORATORY,
    name: 'Healthbridge Diagnostics Laboratory',
    registration_number: DEMO_LABORATORY_REGISTRATION_NUMBER,
    location: '8 Awolowo Way, Ikeja, Lagos',
    contact_email: 'contact@lab.healthbridge.test',
    contact_phone: '+2348000000002',
    verification_status: OrganizationVerificationStatus.APPROVED,
  },
];

// The hospital owner administers an organization without holding any healthcare
// persona — organization role and persona are independent dimensions.
export const SEED_ORGANIZATION_USERS: IUserSeedData[] = [
  {
    email: 'org.owner.hospital@healthbridge.test',
    first_name: 'Ifeoma',
    last_name: 'Nwachukwu',
    personas: [],
    role: [UserRole.HOSPITAL_ADMIN],
  },
  {
    email: 'org.admin.hospital@healthbridge.test',
    first_name: 'Samuel',
    last_name: 'Adeleke',
    personas: [],
    role: [UserRole.HOSPITAL_ADMIN],
  },
  {
    email: 'org.owner.lab@healthbridge.test',
    first_name: 'Grace',
    last_name: 'Adekunle',
    personas: [],
    role: [UserRole.LAB_ADMIN],
  },
  // Dual persona, two organizations, two different membership roles.
  {
    email: 'multi.persona@healthbridge.test',
    first_name: 'Chidera',
    last_name: 'Umeh',
    personas: [
      UserPersonaType.PATIENT,
      UserPersonaType.HEALTHCARE_PROFESSIONAL,
    ],
    role: [UserRole.DOCTOR],
  },
];

export const SEED_ORGANIZATION_MEMBERSHIPS: IOrganizationMembershipSeedData[] =
  [
    {
      user_email: 'org.owner.hospital@healthbridge.test',
      organization_registration_number: DEMO_HOSPITAL_REGISTRATION_NUMBER,
      role: OrganizationMembershipRole.OWNER,
    },
    {
      user_email: 'org.admin.hospital@healthbridge.test',
      organization_registration_number: DEMO_HOSPITAL_REGISTRATION_NUMBER,
      role: OrganizationMembershipRole.ADMIN,
    },
    {
      user_email: 'org.owner.lab@healthbridge.test',
      organization_registration_number: DEMO_LABORATORY_REGISTRATION_NUMBER,
      role: OrganizationMembershipRole.OWNER,
    },
    {
      user_email: 'multi.persona@healthbridge.test',
      organization_registration_number: DEMO_HOSPITAL_REGISTRATION_NUMBER,
      role: OrganizationMembershipRole.MEMBER,
    },
    {
      user_email: 'multi.persona@healthbridge.test',
      organization_registration_number: DEMO_LABORATORY_REGISTRATION_NUMBER,
      role: OrganizationMembershipRole.ADMIN,
    },
  ];
