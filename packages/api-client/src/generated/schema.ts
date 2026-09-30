/**
 * Generated from contracts/openapi.json. Do not edit manually.
 * Regenerate with: npm run api-client:generate
 */

export interface paths {
  readonly '/api/auth/2fa/enable': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Enable two-factor authentication for the current user */
    readonly post: operations['TwoFactorAuthController_enable2fa'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/auth/change-password': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Change password for the authenticated user (revokes active sessions) */
    readonly post: operations['AuthController_changePassword'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/auth/forgot-password': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Request a password reset code */
    readonly post: operations['AuthController_forgotPassword'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/auth/google-login': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Login with Google */
    readonly post: operations['AuthController_googleLogin'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/auth/login': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Login with email and password */
    readonly post: operations['AuthController_login'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/auth/logout': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Logout user and revoke session */
    readonly post: operations['AuthController_logout'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/auth/me': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** Fetches authenticated user profile */
    readonly get: operations['AuthController_getProfile'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    /** Update authenticated user profile */
    readonly patch: operations['AuthController_updateProfile'];
    readonly trace?: never;
  };
  readonly '/api/auth/refresh': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Refresh access token using refresh token */
    readonly post: operations['AuthController_refreshToken'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/auth/reset-password': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Reset a password with a valid reset code */
    readonly post: operations['AuthController_resetPassword'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/auth/signup': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Register a new user */
    readonly post: operations['AuthController_signup'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/auth/users/{user_id}/activate': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    /** activate account */
    readonly patch: operations['AuthController_activateAccount'];
    readonly trace?: never;
  };
  readonly '/api/auth/verify': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Verify a newly registered email address */
    readonly post: operations['AuthController_verifySignup'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/auth/verify/resend': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Send a new email verification code */
    readonly post: operations['AuthController_resendVerification'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/bookings': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** Get all bookings for current user */
    readonly get: operations['BookingController_findAll'];
    readonly put?: never;
    /** Create a new booking */
    readonly post: operations['BookingController_create'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/bookings/{id}': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** Get booking by ID */
    readonly get: operations['BookingController_findOne'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/bookings/{id}/cancel': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    /** Cancel a booking */
    readonly patch: operations['BookingController_cancel'];
    readonly trace?: never;
  };
  readonly '/api/chat/history': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** Get chat history for the logged-in user */
    readonly get: operations['ChatController_getHistory'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/chat/send': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Send a message to the AI */
    readonly post: operations['ChatController_sendMessage'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/laboratories/{laboratoryId}/verification-documents': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** List verification documents for a laboratory */
    readonly get: operations['LaboratoryVerificationDocumentsController_listLaboratoryDocuments'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/laboratories/{laboratoryId}/verification-documents/{documentType}/download': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** Create a signed download URL for a laboratory document */
    readonly get: operations['LaboratoryVerificationDocumentsController_downloadLaboratoryDocument'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/laboratories/{laboratoryId}/verification-status': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** Get laboratory verification status */
    readonly get: operations['LaboratoryVerificationStatusController_getLaboratoryStatus'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/laboratories/{laboratoryId}/verification-status/approve': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Approve laboratory verification */
    readonly post: operations['LaboratoryVerificationStatusController_approve'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/laboratories/{laboratoryId}/verification-status/history': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** List laboratory verification status history */
    readonly get: operations['LaboratoryVerificationStatusController_listHistory'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/laboratories/{laboratoryId}/verification-status/reject': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Reject laboratory verification */
    readonly post: operations['LaboratoryVerificationStatusController_reject'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/laboratories/{laboratoryId}/verification-status/under-review': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Move laboratory verification to under review */
    readonly post: operations['LaboratoryVerificationStatusController_markUnderReview'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/laboratories/auth/admin-setup': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Create a laboratory and its primary administrator account (platform admin only) */
    readonly post: operations['LaboratoryAuthController_setupAdministrator'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/laboratories/me/verification-documents': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** List verification documents for current lab */
    readonly get: operations['LaboratoryVerificationDocumentsController_listMyDocuments'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/laboratories/me/verification-documents/{documentType}': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Upload or replace a verification document for current lab */
    readonly post: operations['LaboratoryVerificationDocumentsController_uploadMyDocument'];
    /** Delete a verification document for current lab */
    readonly delete: operations['LaboratoryVerificationDocumentsController_deleteMyDocument'];
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/laboratories/me/verification-documents/{documentType}/download': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** Create a signed download URL for current lab document */
    readonly get: operations['LaboratoryVerificationDocumentsController_downloadMyDocument'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/laboratories/me/verification-status': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** Get verification status for current laboratory */
    readonly get: operations['LaboratoryVerificationStatusController_getMyStatus'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/laboratories/me/verification-status/submit': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Submit current laboratory for verification */
    readonly post: operations['LaboratoryVerificationStatusController_submitMyVerification'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/laboratories/setup/operating-hours': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** Get laboratory operating hours */
    readonly get: operations['LaboratoryPostApprovalController_listOperatingHours'];
    /** Set laboratory operating hours by day */
    readonly put: operations['LaboratoryPostApprovalController_setOperatingHours'];
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/laboratories/setup/staff': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** List laboratory staff and invitations */
    readonly get: operations['LaboratoryPostApprovalController_listStaff'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/laboratories/setup/staff/invitations': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Invite a laboratory staff member */
    readonly post: operations['LaboratoryPostApprovalController_inviteStaff'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/laboratories/setup/staff/invitations/accept': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Accept a laboratory staff invitation */
    readonly post: operations['LaboratoryPostApprovalController_acceptStaffInvitation'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/laboratories/setup/tests': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** List the laboratory test catalogue */
    readonly get: operations['LaboratoryPostApprovalController_listTests'];
    readonly put?: never;
    /** Add a test to the laboratory catalogue */
    readonly post: operations['LaboratoryPostApprovalController_createTest'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/laboratories/setup/tests/{testId}': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    /** Update a laboratory catalogue test */
    readonly patch: operations['LaboratoryPostApprovalController_updateTest'];
    readonly trace?: never;
  };
  readonly '/api/organizations/onboarding/{organizationId}/documents': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** List uploaded and missing onboarding documents */
    readonly get: operations['OrganizationController_listForReview'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/organizations/onboarding/{organizationId}/documents/{documentType}/download': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** Create a private document download URL */
    readonly get: operations['OrganizationController_downloadForReview'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/organizations/onboarding/{organizationId}/status': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** Get organization verification status */
    readonly get: operations['OrganizationController_getStatus'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/organizations/onboarding/{organizationId}/status/approve': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Approve organization */
    readonly post: operations['OrganizationController_approve'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/organizations/onboarding/{organizationId}/status/history': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** List auditable organization status changes */
    readonly get: operations['OrganizationController_listHistory'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/organizations/onboarding/{organizationId}/status/reject': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Reject organization */
    readonly post: operations['OrganizationController_reject'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/organizations/onboarding/{organizationId}/status/under-review': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Mark organization under review */
    readonly post: operations['OrganizationController_markUnderReview'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/organizations/onboarding/admin-setup': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Create an organization and its primary administrator */
    readonly post: operations['OrganizationController_setup'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/organizations/onboarding/me/documents': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** List uploaded and missing onboarding documents */
    readonly get: operations['OrganizationController_listMine'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/organizations/onboarding/me/documents/{documentType}': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Upload or replace an onboarding document */
    readonly post: operations['OrganizationController_uploadMine'];
    /** Delete an onboarding document before review */
    readonly delete: operations['OrganizationController_deleteMine'];
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/organizations/onboarding/me/documents/{documentType}/download': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** Create a private document download URL */
    readonly get: operations['OrganizationController_downloadMine'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/organizations/onboarding/me/status': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** Get organization verification status */
    readonly get: operations['OrganizationController_getMyStatus'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/organizations/onboarding/me/submit': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Submit complete organization onboarding */
    readonly post: operations['OrganizationController_submitMine'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/organizations/onboarding/review/applications': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** List organization review applications */
    readonly get: operations['OrganizationController_listApplications'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/pharmacies/register': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Register a pharmacy for onboarding review */
    readonly post: operations['PharmacyController_register'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/professionals': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** Get professionals by speciality */
    readonly get: operations['ProfessionalController_findBySpeciality'];
    readonly put?: never;
    /** Create a professional profile (admin only) */
    readonly post: operations['ProfessionalController_createProfessional'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/professionals/{id}': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** Get professional details with grouped availability */
    readonly get: operations['ProfessionalController_findOne'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    /** Update a professional profile (admin only) */
    readonly patch: operations['ProfessionalController_updateProfessional'];
    readonly trace?: never;
  };
  readonly '/api/professionals/{id}/availabilities': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Add availability slots for a professional (admin only) */
    readonly post: operations['ProfessionalController_createAvailabilities'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/professionals/{id}/reviews': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** Get all reviews for a professional */
    readonly get: operations['ProfessionalController_getReviews'];
    readonly put?: never;
    /** Submit a review for a professional */
    readonly post: operations['ProfessionalController_createReview'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/professionals/{professionalId}/reject': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Reject a professional’s credentials (admin only) */
    readonly post: operations['ProfessionalVerificationStatusController_reject'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/professionals/{professionalId}/verification-documents': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** List a professional’s verification documents (admin only) */
    readonly get: operations['ProfessionalVerificationDocumentsController_listProfessionalDocuments'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/professionals/{professionalId}/verification-documents/{documentType}/download': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** Get a signed download URL for a document (admin only) */
    readonly get: operations['ProfessionalVerificationDocumentsController_downloadProfessionalDocument'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/professionals/{professionalId}/verification-status/history': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** List verification status history (admin only) */
    readonly get: operations['ProfessionalVerificationStatusController_listHistory'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/professionals/{professionalId}/verify': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Approve a professional’s credentials (admin only) */
    readonly post: operations['ProfessionalVerificationStatusController_verify'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/professionals/me': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** Get current professional onboarding profile */
    readonly get: operations['ProfessionalController_findMe'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/professionals/me/availabilities': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Add availability slots for current professional */
    readonly post: operations['ProfessionalController_createMyAvailabilities'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/professionals/me/bookings/{bookingId}/accept': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    /** Accept an appointment request */
    readonly patch: operations['ProfessionalController_acceptMyBooking'];
    readonly trace?: never;
  };
  readonly '/api/professionals/me/bookings/{bookingId}/reject': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    /** Reject an appointment request */
    readonly patch: operations['ProfessionalController_rejectMyBooking'];
    readonly trace?: never;
  };
  readonly '/api/professionals/me/dashboard': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** Get current professional dashboard data */
    readonly get: operations['ProfessionalController_getMyDashboard'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/professionals/me/patients': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** Search and list current professional patients */
    readonly get: operations['ProfessionalController_getMyPatients'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/professionals/me/patients/{patientId}': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** Get one patient profile with consultation history */
    readonly get: operations['ProfessionalController_getMyPatientProfile'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/professionals/me/patients/{patientId}/consultations': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** List one patient consultation history */
    readonly get: operations['ProfessionalController_getMyPatientConsultations'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/professionals/me/patients/{patientId}/notes': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** List notes for one patient */
    readonly get: operations['ProfessionalController_getMyPatientNotes'];
    readonly put?: never;
    /** Create a note for one patient */
    readonly post: operations['ProfessionalController_createMyPatientNote'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/professionals/me/patients/{patientId}/notes/{noteId}': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    /** Update one patient note */
    readonly patch: operations['ProfessionalController_updateMyPatientNote'];
    readonly trace?: never;
  };
  readonly '/api/professionals/me/profile': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    /** Create or update current professional practice profile */
    readonly put: operations['ProfessionalController_upsertMeProfile'];
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/professionals/me/verification-documents': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** List the current professional’s verification documents */
    readonly get: operations['ProfessionalVerificationDocumentsController_listMyDocuments'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/professionals/me/verification-documents/{documentType}': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly get?: never;
    readonly put?: never;
    /** Upload a professional verification document */
    readonly post: operations['ProfessionalVerificationDocumentsController_uploadMyDocument'];
    /** Delete an uploaded verification document */
    readonly delete: operations['ProfessionalVerificationDocumentsController_deleteMyDocument'];
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/professionals/me/verification-documents/{documentType}/download': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** Get a signed download URL for a document */
    readonly get: operations['ProfessionalVerificationDocumentsController_downloadMyDocument'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/professionals/me/verification-status': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** Get the current professional’s verification status */
    readonly get: operations['ProfessionalVerificationStatusController_getMyStatus'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/specialities': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** Get all active specialities */
    readonly get: operations['SpecialityController_findAll'];
    readonly put?: never;
    /** Create a new speciality (admin only) */
    readonly post: operations['SpecialityController_create'];
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    readonly patch?: never;
    readonly trace?: never;
  };
  readonly '/api/specialities/{id}': {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    /** Get a speciality by ID */
    readonly get: operations['SpecialityController_findOne'];
    readonly put?: never;
    readonly post?: never;
    readonly delete?: never;
    readonly options?: never;
    readonly head?: never;
    /** Update a speciality (admin only) */
    readonly patch: operations['SpecialityController_update'];
    readonly trace?: never;
  };
}
export type webhooks = Record<string, never>;
export interface components {
  schemas: {
    readonly AcceptLaboratoryStaffInvitationDto: {
      /** @example SecurePassword123 */
      readonly password: string;
      /** @example +2348012345678 */
      readonly phone?: string;
      /** @description Invitation token from the email link */
      readonly token: string;
    };
    readonly AcceptLaboratoryStaffInvitationResponseDto: {
      /** @example laboratory staff invitation accepted successfully */
      readonly message: string;
      readonly staff: components['schemas']['LaboratoryStaffResponseDto'];
    };
    readonly AcceptLaboratoryStaffInvitationResponseDtoData: {
      readonly staff: components['schemas']['LaboratoryStaffResponseDto'];
    };
    readonly ActivateAccountResponseDto: {
      /** @example User account activated successfully */
      readonly message: string;
      /** @example 200 */
      readonly status: number;
    };
    readonly ActivateAccountResponseDtoData: {
      /** @example 200 */
      readonly status: number;
    };
    readonly ApiErrorResponseDto: {
      /** @example null */
      readonly data: Record<string, never> | null;
      /** @example Bad Request */
      readonly error: string | null;
      readonly message: string | readonly string[];
      /** @example POST */
      readonly method: string;
      /** @example /api/auth/login */
      readonly path: string;
      /** @description Development environments only */
      readonly stack?: string;
      /** @example 400 */
      readonly status_code: number;
      /**
       * Format: date-time
       * @example 2026-01-15T10:30:00.000Z
       */
      readonly timestamp: string;
    };
    readonly ApiMessageResponseDto: {
      /** @example Operation completed successfully */
      readonly message: string;
    };
    readonly ApiSuccessResponseDto: {
      readonly data: unknown;
      /** @example null */
      readonly message: string | null;
      readonly meta?: Record<string, never>;
      /** @example 200 */
      readonly status_code: number;
    };
    readonly AuthDto: {
      /**
       * @description Date of birth in YYYY-MM-DD format
       * @example 2000-01-15
       */
      readonly dob?: string;
      /**
       * @description User email address
       * @example john.doe@example.com
       */
      readonly email: string;
      /**
       * @description User first name
       * @example John
       */
      readonly first_name: string;
      /**
       * @description User gender
       * @example Male
       * @enum {string}
       */
      readonly gender?: AuthDtoGender;
      /**
       * @description Account active status
       * @default true
       * @example true
       */
      readonly is_active: boolean;
      /**
       * @description User last name
       * @example Doe
       */
      readonly last_name: string;
      /**
       * @description User middle name
       * @example Michael
       */
      readonly middle_name?: string;
      /**
       * @description User password (minimum 8 characters)
       * @example SecurePassword123!
       */
      readonly password: string;
      /**
       * @description User phone number
       * @example +1234567890
       */
      readonly phone?: string;
      /**
       * @description Single self-service account role selected during signup
       * @example [
       *       "PATIENT"
       *     ]
       */
      readonly role: readonly AuthDtoRole[];
    };
    readonly AuthMeResponseDto: {
      /**
       * Format: date-time
       * @example 2024-01-15T10:30:00Z
       */
      readonly created_at: string;
      /** @example 2000-01-15 */
      readonly dob: string;
      /** @example john.doe@example.com */
      readonly email: string;
      /** @example John */
      readonly first_name: string;
      /** @example Male */
      readonly gender: string;
      /** @example 550e8400-e29b-41d4-a716-446655440000 */
      readonly id: string;
      /** @example https://res.cloudinary.com/ohealth/image/upload/v123/avatar.png */
      readonly image?: string | null;
      /** @example true */
      readonly is_active: boolean;
      /** @example Doe */
      readonly last_name: string;
      /** @example Michael */
      readonly middle_name: string;
      /** @example +1234567890 */
      readonly phone: string;
      /**
       * @example [
       *       "PATIENT"
       *     ]
       */
      readonly role: readonly string[];
      /**
       * Format: date-time
       * @example 2024-01-15T10:30:00Z
       */
      readonly updated_at: string;
    };
    readonly AvailabilitySlotDto: {
      /** @example 2026-07-15 */
      readonly date: string;
      /** @example 09:30 */
      readonly end_time: string;
      /** @example 09:00 */
      readonly start_time: string;
    };
    readonly AvailabilitySlotResponseDto: {
      readonly end_time: string;
      readonly id: string;
      readonly is_available: boolean;
      readonly start_time: string;
    };
    readonly BookingResponseDto: {
      readonly amount: number;
      readonly booking_date: string;
      readonly booking_time: string;
      readonly consultation_type: string;
      /** Format: date-time */
      readonly created_at: string;
      readonly id: string;
      readonly is_paid: boolean;
      readonly notes?: string;
      readonly patient_id: string;
      /** @enum {string} */
      readonly payment_status: BookingResponseDtoPayment_status;
      readonly professional_id: string;
      readonly professional_image?: string;
      readonly professional_name: string;
      readonly speciality_id: string;
      readonly speciality_name: string;
      readonly status: string;
    };
    readonly BulkCreateAvailabilityDto: {
      readonly slots: readonly components['schemas']['AvailabilitySlotDto'][];
    };
    readonly ChangePasswordDto: {
      /**
       * @description Current password
       * @example OldPassword123!
       */
      readonly currentPassword: string;
      /**
       * @description New password
       * @example NewPassword123!
       */
      readonly newPassword: string;
    };
    readonly ChatHistoryResponseDto: {
      readonly chats: readonly components['schemas']['ChatSessionResponseDto'][];
      readonly messages: readonly components['schemas']['ChatMessageResponseDto'][];
    };
    readonly ChatMessageResponseDto: {
      /** @example 550e8400-e29b-41d4-a716-446655440000 */
      readonly chat_id: string;
      /** @example What are common flu symptoms? */
      readonly content: string;
      /**
       * Format: date-time
       * @example 2026-01-15T10:30:00.000Z
       */
      readonly created_at: string;
      /** @example 550e8400-e29b-41d4-a716-446655440001 */
      readonly id: string;
      /**
       * @example user
       * @enum {string}
       */
      readonly sender: ChatMessageResponseDtoSender;
      /**
       * Format: date-time
       * @example 2026-01-15T10:30:00.000Z
       */
      readonly updated_at: string;
    };
    readonly ChatSessionResponseDto: {
      /**
       * Format: date-time
       * @example 2026-01-15T10:30:00.000Z
       */
      readonly created_at: string;
      /** @example 550e8400-e29b-41d4-a716-446655440000 */
      readonly id: string;
      /**
       * Format: date-time
       * @example 2026-01-15T10:31:00.000Z
       */
      readonly updated_at: string;
    };
    readonly CreateBookingDto: {
      /** @example 2024-02-10 */
      readonly booking_date: string;
      /** @example 10:00 */
      readonly booking_time: string;
      /**
       * @example video
       * @enum {string}
       */
      readonly consultation_type: CreateBookingDtoConsultation_type;
      readonly notes?: string;
      /** @example 123e4567-e89b-12d3-a456-426614174000 */
      readonly professional_id: string;
    };
    readonly CreateLaboratoryTestDto: {
      /** @example Full Blood Count */
      readonly name: string;
      /** @example 15000 */
      readonly price: number;
      /**
       * @description Expected turnaround time in minutes
       * @example 1440
       */
      readonly turnaround_time_minutes: number;
    };
    readonly CreatePharmacyDto: {
      /** @example 12 Admiralty Way, Lekki Phase 1, Lagos */
      readonly business_address: string;
      /** @example contact@healthplus.example */
      readonly contact_email: string;
      /** @example +2348012345678 */
      readonly contact_phone: string;
      /** @example LIC-789012 */
      readonly license_number: string;
      /** @example HealthPlus Pharmacy */
      readonly name: string;
      /** @example Lagos */
      readonly region: string;
      /** @example PCN-123456 */
      readonly registration_number: string;
    };
    readonly CreateProfessionalDto: {
      /** @example Experienced general practitioner. */
      readonly about?: string;
      /** @example 5000 */
      readonly consultation_fee: number;
      /**
       * @default both
       * @enum {string}
       */
      readonly consultation_type: CreateProfessionalDtoConsultation_type;
      readonly image?: string;
      /** @example MDCN-123456 */
      readonly license_number?: string;
      /** @example 123e4567-e89b-12d3-a456-426614174001 */
      readonly speciality_id: string;
      /** @example 123e4567-e89b-12d3-a456-426614174000 */
      readonly user_id: string;
      /**
       * @default pending
       * @enum {string}
       */
      readonly verification_status: CreateProfessionalDtoVerification_status;
      /** @example 8 */
      readonly years_of_experience?: number;
    };
    readonly CreateProfessionalPatientNoteDto: {
      /** @example Patient reports recurring headaches in the evenings. Advised hydration and reduced screen time. */
      readonly content: string;
    };
    readonly CreateReviewDto: {
      /**
       * @description Booking ID this review is tied to. Prevents duplicate reviews.
       * @example 123e4567-e89b-12d3-a456-426614174000
       */
      readonly booking_id?: string;
      /** @example Very helpful and professional. */
      readonly comment?: string;
      /** @example 5 */
      readonly rating: number;
    };
    readonly CreateSpecialityDto: {
      /** @example General medical consultations */
      readonly description?: string;
      /** @example stethoscope.png */
      readonly icon?: string;
      /** @example General Doctor */
      readonly name: string;
    };
    readonly EnableTwoFactorAuthDataDto: {
      /**
       * @example [
       *       "A1B2C3D4",
       *       "E5F6G7H8"
       *     ]
       */
      readonly backupCodes: readonly string[];
      /** @example data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA... */
      readonly qrCodeUrl: string;
      /** @example JBSWY3DPEHPK3PXP */
      readonly secret: string;
    };
    readonly ForgotPasswordDto: {
      /**
       * @description User email address
       * @example user@example.com
       */
      readonly email: string;
    };
    readonly GoogleLoginDto: {
      /**
       * @description Google ID Token
       * @example eyJhbGciOiJSUzI1NiIsImtpZCI6IjFj... (Google ID Token)
       */
      readonly token: string;
    };
    readonly GroupedAvailabilityDto: {
      readonly date: string;
      readonly slots: readonly components['schemas']['AvailabilitySlotResponseDto'][];
    };
    readonly InviteLaboratoryStaffDto: {
      /** @example amara@laboratory.example */
      readonly email: string;
      /** @example Amara Okafor */
      readonly full_name: string;
      /**
       * @example scientist
       * @enum {string}
       */
      readonly role: InviteLaboratoryStaffDtoRole;
    };
    readonly InviteLaboratoryStaffResponseDto: {
      /** @example laboratory staff invitation sent successfully */
      readonly message: string;
      readonly staff: components['schemas']['LaboratoryStaffResponseDto'];
    };
    readonly InviteLaboratoryStaffResponseDtoData: {
      readonly staff: components['schemas']['LaboratoryStaffResponseDto'];
    };
    readonly LaboratoryAdministratorSetupDto: {
      /** @example tunde@medcheck.example */
      readonly email: string;
      /** @example Tunde Adebayo */
      readonly full_name: string;
      /** @example SecurePassword123 */
      readonly password: string;
      /** @example +2348098765432 */
      readonly phone: string;
    };
    readonly LaboratoryAdministratorSetupResponseDto: {
      /** @example tunde@medcheck.example */
      readonly email: string;
      /** @example Tunde Adebayo */
      readonly full_name: string;
      /** @example 550e8400-e29b-41d4-a716-446655440001 */
      readonly id: string;
      /** @example true */
      readonly is_primary: boolean;
      /** @example +2348098765432 */
      readonly phone: string;
      /**
       * @example [
       *       "LAB_ADMIN"
       *     ]
       */
      readonly role: readonly LaboratoryAdministratorSetupResponseDtoRole[];
      /** @example 550e8400-e29b-41d4-a716-446655440002 */
      readonly user_id: string;
    };
    readonly LaboratoryAdminSetupDto: {
      readonly administrator: components['schemas']['LaboratoryAdministratorSetupDto'];
      readonly laboratory: components['schemas']['LaboratorySetupDto'];
    };
    readonly LaboratoryAdminSetupResponseDto: {
      /** @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... */
      readonly access_token: string;
      readonly administrator: components['schemas']['LaboratoryAdministratorSetupResponseDto'];
      readonly laboratory: components['schemas']['LaboratorySetupResponseDto'];
      /** @example laboratory administrator setup completed successfully */
      readonly message: string;
      /** @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... */
      readonly refresh_token: string;
      /**
       * Format: date-time
       * @example 2026-07-18T10:30:00.000Z
       */
      readonly session_expires_at: string;
      /** @example 550e8400-e29b-41d4-a716-446655440003 */
      readonly session_id: string;
    };
    readonly LaboratoryAdminSetupResponseDtoData: {
      /** @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... */
      readonly access_token: string;
      readonly administrator: components['schemas']['LaboratoryAdministratorSetupResponseDto'];
      readonly laboratory: components['schemas']['LaboratorySetupResponseDto'];
      /** @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... */
      readonly refresh_token: string;
      /**
       * Format: date-time
       * @example 2026-07-18T10:30:00.000Z
       */
      readonly session_expires_at: string;
      /** @example 550e8400-e29b-41d4-a716-446655440003 */
      readonly session_id: string;
    };
    readonly LaboratoryOperatingHourResponseDto: {
      /** @example 18:00 */
      readonly closes_at: string | null;
      /** @enum {string} */
      readonly day_of_week: LaboratoryOperatingHourResponseDtoDay_of_week;
      readonly id: string;
      readonly is_closed: boolean;
      /** @example 08:00 */
      readonly opens_at: string | null;
      /** Format: date-time */
      readonly updated_at: string;
    };
    readonly LaboratorySetupDto: {
      /** @example 12 Admiralty Way, Lekki, Lagos */
      readonly address: string;
      /** @example hello@medcheck.example */
      readonly contact_email: string;
      /** @example +2348012345678 */
      readonly contact_phone: string;
      /** @example LAB-987654 */
      readonly license_number: string;
      /** @example MedCheck Diagnostics */
      readonly name: string;
      /** @example Lagos */
      readonly region: string;
      /** @example RC-123456 */
      readonly registration_number: string;
    };
    readonly LaboratorySetupResponseDto: {
      /** @example 12 Admiralty Way, Lekki, Lagos */
      readonly address: string;
      /** @example hello@medcheck.example */
      readonly contact_email: string;
      /** @example +2348012345678 */
      readonly contact_phone: string;
      /**
       * Format: date-time
       * @example 2026-07-11T10:30:00.000Z
       */
      readonly created_at: string;
      /** @example 550e8400-e29b-41d4-a716-446655440000 */
      readonly id: string;
      /** @example true */
      readonly is_active: boolean;
      /** @example LAB-987654 */
      readonly license_number: string;
      /** @example MedCheck Diagnostics */
      readonly name: string;
      /**
       * @example admin_setup_completed
       * @enum {string}
       */
      readonly onboarding_status: LaboratorySetupResponseDtoOnboarding_status;
      /** @example Lagos */
      readonly region: string;
      /** @example RC-123456 */
      readonly registration_number: string;
      /** @example null */
      readonly verification_rejection_reason: string | null;
      /**
       * @example pending
       * @enum {string}
       */
      readonly verification_status: PathsApiOrganizationsOnboardingReviewApplicationsGetParametersQueryVerification_status;
    };
    readonly LaboratoryStaffResponseDto: {
      /** Format: date-time */
      readonly accepted_at: string | null;
      /** Format: date-time */
      readonly created_at: string;
      readonly email: string;
      readonly full_name: string;
      readonly id: string;
      /** Format: date-time */
      readonly invitation_expires_at: string | null;
      /** @enum {string} */
      readonly role: InviteLaboratoryStaffDtoRole;
      /** @enum {string} */
      readonly status: LaboratoryStaffResponseDtoStatus;
      /** Format: date-time */
      readonly updated_at: string;
      readonly user_id: string | null;
    };
    readonly LaboratoryTestResponseDto: {
      /** Format: date-time */
      readonly created_at: string;
      readonly id: string;
      readonly is_active: boolean;
      readonly name: string;
      readonly price: number;
      readonly turnaround_time_minutes: number;
      /** Format: date-time */
      readonly updated_at: string;
    };
    readonly LaboratoryVerificationDocumentDownloadDto: {
      /** @example 300 */
      readonly expires_in_seconds: number;
      /** @example https://signed-url.example.com/document */
      readonly url: string;
    };
    readonly LaboratoryVerificationDocumentResponseDto: {
      /**
       * Format: date-time
       * @example 2026-07-15T10:30:00.000Z
       */
      readonly created_at: string;
      /**
       * @example laboratory_license
       * @enum {string}
       */
      readonly document_type: PathsApiLaboratoriesLaboratoryIdVerificationDocumentsDocumentTypeDownloadGetParametersPathDocumentType;
      /** @example 1048576 */
      readonly file_size: number;
      /** @example 550e8400-e29b-41d4-a716-446655440000 */
      readonly id: string;
      /** @example application/pdf */
      readonly mime_type: string;
      /** @example license.pdf */
      readonly original_filename: string;
      /**
       * Format: date-time
       * @example 2026-07-15T10:30:00.000Z
       */
      readonly updated_at: string;
    };
    readonly LaboratoryVerificationDocumentsStatusDto: {
      readonly documents: readonly components['schemas']['LaboratoryVerificationDocumentResponseDto'][];
      /** @example false */
      readonly is_complete: boolean;
      /**
       * @example [
       *       "cac_registration"
       *     ]
       */
      readonly missing_document_types: readonly PathsApiLaboratoriesLaboratoryIdVerificationDocumentsDocumentTypeDownloadGetParametersPathDocumentType[];
    };
    readonly LaboratoryVerificationStatusHistoryResponseDto: {
      /** @example ad09bc1e-3644-4ca9-82f2-2e597db2d6ac */
      readonly changed_by_user_id: string;
      /**
       * Format: date-time
       * @example 2026-07-17T10:30:00.000Z
       */
      readonly created_at: string;
      /** @example e2db2a75-f98d-4c1e-a4c0-0f2fb9c96f83 */
      readonly id: string;
      /** @example 9e0f3a29-2b1c-4d83-9e29-3f2d6a9a21bd */
      readonly laboratory_id: string;
      /**
       * @example under_review
       * @enum {string}
       */
      readonly new_status: PathsApiOrganizationsOnboardingReviewApplicationsGetParametersQueryVerification_status;
      /**
       * @example submitted
       * @enum {string|null}
       */
      readonly previous_status?: PathsApiOrganizationsOnboardingReviewApplicationsGetParametersQueryVerification_status;
      /** @example The submitted license is expired. */
      readonly reason?: string | null;
    };
    readonly LaboratoryVerificationStatusResponseDto: {
      /** @example 9e0f3a29-2b1c-4d83-9e29-3f2d6a9a21bd */
      readonly laboratory_id: string;
      /**
       * @example verification_submitted
       * @enum {string}
       */
      readonly onboarding_status: LaboratorySetupResponseDtoOnboarding_status;
      /**
       * Format: date-time
       * @example 2026-07-17T10:30:00.000Z
       */
      readonly updated_at: string;
      /** @example The submitted license is expired. */
      readonly verification_rejection_reason?: string | null;
      /**
       * @example submitted
       * @enum {string}
       */
      readonly verification_status: PathsApiOrganizationsOnboardingReviewApplicationsGetParametersQueryVerification_status;
    };
    readonly LoginDto: {
      /**
       * @description User email address
       * @example john.doe@example.com
       */
      readonly email: string;
      /**
       * @description User password
       * @example SecurePassword123!
       */
      readonly password: string;
    };
    readonly LoginResponseDto: {
      /**
       * @example full
       * @enum {string}
       */
      readonly access_level: LoginResponseDtoAccess_level;
      /**
       * @description JWT access token with 15 minutes expiration
       * @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
       */
      readonly access_token: string;
      /** @example Login success */
      readonly message: string | null;
      /**
       * @description JWT refresh token with 7 days expiration
       * @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
       */
      readonly refresh_token: string;
      /**
       * @example patient_home
       * @enum {string}
       */
      readonly routing_target: LoginResponseDtoRouting_target;
      /**
       * Format: date-time
       * @example 2024-01-15T10:30:00Z
       */
      readonly session_expires_at: string | null;
      /** @example 550e8400-e29b-41d4-a716-446655440000 */
      readonly session_id: string | null;
      /** @example 200 */
      readonly status_code: number | null;
      readonly user: components['schemas']['UserDto'];
      /**
       * @description Current provider verification status, when applicable
       * @example null
       */
      readonly verification_status: string | null;
    };
    readonly LoginResponseDtoData: {
      /**
       * @example full
       * @enum {string}
       */
      readonly access_level: LoginResponseDtoAccess_level;
      /**
       * @description JWT access token with 15 minutes expiration
       * @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
       */
      readonly access_token: string;
      /**
       * @description JWT refresh token with 7 days expiration
       * @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
       */
      readonly refresh_token: string;
      /**
       * @example patient_home
       * @enum {string}
       */
      readonly routing_target: LoginResponseDtoRouting_target;
      /**
       * Format: date-time
       * @example 2024-01-15T10:30:00Z
       */
      readonly session_expires_at: string | null;
      /** @example 550e8400-e29b-41d4-a716-446655440000 */
      readonly session_id: string | null;
      readonly user: components['schemas']['UserDto'];
      /**
       * @description Current provider verification status, when applicable
       * @example null
       */
      readonly verification_status: string | null;
    };
    readonly LogoutDto: {
      /**
       * @description session id
       * @example session-id-123
       */
      readonly session_id: string;
    };
    readonly LogoutResponseDto: {
      /** @example logout success */
      readonly message: string | null;
      /** @example 200 */
      readonly status_code: number | null;
    };
    readonly OrganizationAdministratorDto: {
      /** @example tunde@organization.example */
      readonly email: string;
      /** @example Tunde Adebayo */
      readonly full_name: string;
      /** @example SecurePassword123 */
      readonly password: string;
      /** @example +2348098765432 */
      readonly phone: string;
    };
    readonly OrganizationAdministratorResponseDto: {
      readonly email: string;
      readonly full_name: string;
      readonly id: string;
      readonly phone: string;
      readonly roles: readonly LaboratoryAdministratorSetupResponseDtoRole[];
      readonly user_id: string;
    };
    readonly OrganizationDetailsDto: {
      /** @example contact@organization.example */
      readonly contact_email: string;
      /** @example +2348012345678 */
      readonly contact_phone?: string;
      /** @example 12 Admiralty Way, Lekki, Lagos */
      readonly location: string;
      /** @example MedCheck Diagnostics */
      readonly name: string;
      /** @enum {string} */
      readonly organization_type: PathsApiOrganizationsOnboardingReviewApplicationsGetParametersQueryOrganization_type;
      /** @example RC-123456 */
      readonly registration_number: string;
    };
    readonly OrganizationDocumentChecklistDto: {
      readonly documents: readonly components['schemas']['OrganizationDocumentResponseDto'][];
      readonly is_complete: boolean;
      readonly missing_document_types: readonly OrganizationDocumentChecklistDtoMissing_document_types[];
    };
    readonly OrganizationDocumentDownloadDto: {
      readonly expires_in_seconds: number;
      readonly url: string;
    };
    readonly OrganizationDocumentResponseDto: {
      /** Format: date-time */
      readonly created_at: string;
      /** @enum {string} */
      readonly document_type: OrganizationDocumentChecklistDtoMissing_document_types;
      readonly file_size: number;
      readonly id: string;
      readonly mime_type: string;
      readonly original_filename: string;
      /** Format: date-time */
      readonly updated_at: string;
    };
    readonly OrganizationResponseDto: {
      readonly contact_email: string;
      readonly contact_phone: string | null;
      /** Format: date-time */
      readonly created_at: string;
      readonly id: string;
      readonly is_active: boolean;
      readonly location: string;
      readonly name: string;
      /** @enum {string} */
      readonly organization_type: PathsApiOrganizationsOnboardingReviewApplicationsGetParametersQueryOrganization_type;
      readonly registration_number: string;
      readonly rejection_reason: string | null;
      /** @enum {string} */
      readonly verification_status: PathsApiOrganizationsOnboardingReviewApplicationsGetParametersQueryVerification_status;
    };
    readonly OrganizationReviewListResponseDto: {
      readonly applications: readonly components['schemas']['OrganizationResponseDto'][];
      readonly limit: number;
      readonly page: number;
      readonly total: number;
    };
    readonly OrganizationStatusHistoryResponseDto: {
      readonly changed_by_user_id: string;
      /** Format: date-time */
      readonly created_at: string;
      readonly id: string;
      /** @enum {string} */
      readonly new_status: PathsApiOrganizationsOnboardingReviewApplicationsGetParametersQueryVerification_status;
      readonly organization_id: string;
      /** @enum {string|null} */
      readonly previous_status: PathsApiOrganizationsOnboardingReviewApplicationsGetParametersQueryVerification_status;
      readonly reason: string | null;
    };
    readonly OrganizationStatusResponseDto: {
      readonly organization_id: string;
      readonly rejection_reason: string | null;
      /** Format: date-time */
      readonly updated_at: string;
      /** @enum {string} */
      readonly verification_status: PathsApiOrganizationsOnboardingReviewApplicationsGetParametersQueryVerification_status;
    };
    readonly PharmacyResponseDto: {
      readonly business_address: string;
      readonly contact_email: string;
      readonly contact_phone: string;
      /** Format: date-time */
      readonly created_at: string;
      readonly id: string;
      readonly is_active: boolean;
      readonly license_number: string;
      readonly name: string;
      readonly region: string;
      readonly registration_number: string;
      /** Format: date-time */
      readonly updated_at: string;
      /** @enum {string} */
      readonly verification_status: PharmacyResponseDtoVerification_status;
    };
    readonly ProfessionalActivityResponseDto: {
      readonly message: string;
      /** Format: date-time */
      readonly occurred_at: string;
      readonly title: string;
    };
    readonly ProfessionalAppointmentResponseDto: {
      readonly amount: number;
      readonly booking_date: string;
      readonly booking_time: string;
      readonly consultation_type: string;
      /** Format: date-time */
      readonly created_at: string;
      readonly id: string;
      readonly is_paid: boolean;
      readonly notes?: string;
      readonly patient_id: string;
      readonly patient_name: string;
      readonly professional_id: string;
      /** @enum {string} */
      readonly status: ProfessionalAppointmentResponseDtoStatus;
    };
    readonly ProfessionalAvailabilityResponseDto: {
      /**
       * Format: date-time
       * @example 2026-01-15T10:30:00.000Z
       */
      readonly created_at: string;
      /**
       * Format: date
       * @example 2026-07-15
       */
      readonly date: string;
      /** @example 09:30 */
      readonly end_time: string;
      /** @example 550e8400-e29b-41d4-a716-446655440000 */
      readonly id: string;
      /** @example true */
      readonly is_available: boolean;
      /** @example 550e8400-e29b-41d4-a716-446655440001 */
      readonly professional_id: string;
      /** @example 09:00 */
      readonly start_time: string;
      /**
       * Format: date-time
       * @example 2026-01-15T10:30:00.000Z
       */
      readonly updated_at: string;
    };
    readonly ProfessionalDashboardResponseDto: {
      readonly activities: readonly components['schemas']['ProfessionalActivityResponseDto'][];
      readonly appointment_requests: readonly components['schemas']['ProfessionalAppointmentResponseDto'][];
      readonly date: string;
      readonly next_appointment?:
        | components['schemas']['ProfessionalAppointmentResponseDto']
        | null;
      readonly profile: components['schemas']['ProfessionalMeProfileDto'];
      readonly setup: Record<string, never>;
      readonly stats: components['schemas']['ProfessionalDashboardStatsDto'];
      readonly todays_appointments: readonly components['schemas']['ProfessionalAppointmentResponseDto'][];
    };
    readonly ProfessionalDashboardStatsDto: {
      readonly completed_todays_appointments: number;
      readonly patient_growth_percent: number;
      readonly patients: number;
      readonly pending_appointments: number;
      readonly pending_appointments_tomorrow: number;
      readonly remaining_todays_appointments: number;
      readonly todays_appointments: number;
    };
    readonly ProfessionalDetailResponseDto: {
      readonly about?: string;
      readonly availabilities: readonly components['schemas']['GroupedAvailabilityDto'][];
      readonly consultation_fee: number;
      readonly consultation_type: string;
      readonly id: string;
      readonly image?: string;
      readonly is_available: boolean;
      readonly name: string;
      readonly rating: number;
      readonly speciality: string;
      readonly speciality_id: string;
      readonly total_reviews: number;
      readonly years_of_experience: number;
    };
    readonly ProfessionalMeProfileDto: {
      readonly about?: string;
      readonly consultation_fee: number;
      /** @enum {string} */
      readonly consultation_type: CreateProfessionalDtoConsultation_type;
      /** Format: date-time */
      readonly created_at: string;
      readonly id: string;
      readonly image?: string;
      readonly is_available: boolean;
      readonly license_number?: string;
      readonly profile_setup_completed: boolean;
      readonly speciality: string;
      readonly speciality_id: string;
      /** Format: date-time */
      readonly updated_at: string;
      readonly user_id: string;
      /** @enum {string} */
      readonly verification_status: CreateProfessionalDtoVerification_status;
      readonly years_of_experience: number;
    };
    readonly ProfessionalMeResponseDto: {
      readonly profile?:
        | components['schemas']['ProfessionalMeProfileDto']
        | null;
      readonly setup: components['schemas']['ProfessionalSetupStatusDto'];
      readonly user: components['schemas']['ProfessionalMeUserDto'];
    };
    readonly ProfessionalMeUserDto: {
      readonly email: string;
      readonly first_name: string;
      readonly id: string;
      readonly is_verified: boolean;
      readonly last_name: string;
      readonly phone?: string;
      readonly roles: readonly string[];
    };
    readonly ProfessionalPatientConsultationHistoryItemDto: {
      readonly amount: number;
      readonly booking_date: string;
      readonly booking_time: string;
      readonly consultation_label: string;
      readonly consultation_type: string;
      /** Format: date-time */
      readonly created_at: string;
      readonly date_day: string;
      readonly date_month_year: string;
      readonly description?: string | null;
      readonly id: string;
      readonly is_paid: boolean;
      readonly notes?: string;
      readonly patient_id: string;
      readonly patient_name: string;
      readonly professional_id: string;
      readonly schedule_label: string;
      /** @enum {string} */
      readonly status: ProfessionalAppointmentResponseDtoStatus;
      readonly time_label: string;
    };
    readonly ProfessionalPatientConsultationsResponseDto: {
      readonly meta: components['schemas']['ProfessionalPatientsPaginationMetaDto'];
      readonly profile: components['schemas']['ProfessionalPatientProfileDto'];
      readonly records: readonly components['schemas']['ProfessionalPatientConsultationHistoryItemDto'][];
      readonly summary: components['schemas']['ProfessionalPatientSummaryDto'];
    };
    readonly ProfessionalPatientDetailResponseDto: {
      readonly consultation_history: readonly components['schemas']['ProfessionalPatientConsultationHistoryItemDto'][];
      readonly lab_results: readonly components['schemas']['ProfessionalPatientLabResultDto'][];
      readonly medical_information: components['schemas']['ProfessionalPatientMedicalInformationDto'];
      readonly notes: readonly components['schemas']['ProfessionalPatientNoteResponseDto'][];
      readonly personal_information: components['schemas']['ProfessionalPatientPersonalInformationDto'];
      readonly profile: components['schemas']['ProfessionalPatientProfileDto'];
      readonly summary: components['schemas']['ProfessionalPatientSummaryDto'];
    };
    readonly ProfessionalPatientLabResultDto: {
      readonly id: string;
      readonly lab_name: string;
      readonly source: string;
      readonly status: string;
      readonly test_date: string;
      readonly test_type: string;
    };
    readonly ProfessionalPatientListItemDto: {
      readonly age?: number | null;
      readonly allergies: readonly string[];
      readonly blood_group?: string | null;
      readonly condition: string;
      readonly dob?: string | null;
      readonly email: string;
      readonly emergency_contact_name?: string | null;
      readonly emergency_contact_phone?: string | null;
      readonly first_name: string;
      readonly full_name: string;
      readonly gender?: string | null;
      readonly genotype?: string | null;
      readonly height_cm?: number | null;
      readonly id: string;
      readonly image?: string | null;
      readonly last_booking_id?: string | null;
      /** @enum {string|null} */
      readonly last_booking_status?: ProfessionalAppointmentResponseDtoStatus;
      readonly last_name: string;
      readonly last_visit_date?: string | null;
      readonly medical_conditions: readonly string[];
      readonly patient_reference: string;
      readonly phone?: string | null;
      /** Format: date-time */
      readonly registered_at?: string | null;
      readonly total_consultations: number;
      readonly weight_kg?: number | null;
    };
    readonly ProfessionalPatientMedicalInformationDto: {
      readonly allergies: readonly string[];
      readonly blood_group?: string | null;
      readonly genotype?: string | null;
      readonly height_cm?: number | null;
      readonly medical_conditions: readonly string[];
      readonly primary_allergy?: string | null;
      readonly primary_condition?: string | null;
      readonly weight_kg?: number | null;
    };
    readonly ProfessionalPatientNoteResponseDto: {
      readonly content: string;
      /** Format: date-time */
      readonly created_at: string;
      readonly date_label: string;
      readonly id: string;
      readonly patient_id: string;
      readonly professional_id: string;
      /** Format: date-time */
      readonly updated_at: string;
    };
    readonly ProfessionalPatientNotesResponseDto: {
      readonly meta: components['schemas']['ProfessionalPatientsPaginationMetaDto'];
      readonly profile: components['schemas']['ProfessionalPatientProfileDto'];
      readonly records: readonly components['schemas']['ProfessionalPatientNoteResponseDto'][];
      readonly summary: components['schemas']['ProfessionalPatientSummaryDto'];
    };
    readonly ProfessionalPatientPersonalInformationDto: {
      readonly dob?: string | null;
      readonly email: string;
      readonly full_name: string;
      readonly gender?: string | null;
      readonly patient_reference: string;
      /** Format: date-time */
      readonly registered_at?: string | null;
    };
    readonly ProfessionalPatientProfileDto: {
      readonly age?: number | null;
      readonly allergies: readonly string[];
      readonly blood_group?: string | null;
      readonly dob?: string | null;
      readonly email: string;
      readonly emergency_contact_name?: string | null;
      readonly emergency_contact_phone?: string | null;
      readonly first_name: string;
      readonly full_name: string;
      readonly gender?: string | null;
      readonly genotype?: string | null;
      readonly height_cm?: number | null;
      readonly id: string;
      readonly image?: string | null;
      readonly last_name: string;
      readonly medical_conditions: readonly string[];
      readonly patient_reference: string;
      readonly phone?: string | null;
      /** Format: date-time */
      readonly registered_at?: string | null;
      readonly weight_kg?: number | null;
    };
    readonly ProfessionalPatientRecordsResponseDto: {
      readonly meta: components['schemas']['ProfessionalPatientsPaginationMetaDto'];
      readonly records: readonly components['schemas']['ProfessionalPatientListItemDto'][];
    };
    readonly ProfessionalPatientsPaginationMetaDto: {
      readonly has_next: boolean;
      readonly has_previous: boolean;
      readonly limit: number;
      readonly page: number;
      readonly showing: number;
      readonly total: number;
      readonly total_pages: number;
    };
    readonly ProfessionalPatientSummaryDto: {
      readonly completed_consultations: number;
      readonly last_visit_date?: string | null;
      readonly total_consultations: number;
      readonly total_notes: number;
      readonly upcoming_appointments: number;
    };
    readonly ProfessionalResponseDto: {
      readonly about?: string;
      readonly consultation_fee: number;
      readonly consultation_type: string;
      readonly id: string;
      readonly image?: string;
      readonly is_available: boolean;
      readonly name: string;
      readonly rating: number;
      readonly speciality: string;
      readonly speciality_id: string;
      readonly total_reviews: number;
      readonly years_of_experience: number;
    };
    readonly ProfessionalSetupStatusDto: {
      readonly add_description: boolean;
      readonly add_profile_photo: boolean;
      readonly completed: boolean;
      readonly set_availability: boolean;
      readonly verified: boolean;
    };
    readonly ProfessionalVerificationDocumentDownloadDto: {
      /** @example 300 */
      readonly expires_in_seconds: number;
      /** @example https://signed-url.example.com/document */
      readonly url: string;
    };
    readonly ProfessionalVerificationDocumentResponseDto: {
      /**
       * Format: date-time
       * @example 2026-07-15T10:30:00.000Z
       */
      readonly created_at: string;
      /**
       * @example professional_license
       * @enum {string}
       */
      readonly document_type: PathsApiProfessionalsProfessionalIdVerificationDocumentsDocumentTypeDownloadGetParametersPathDocumentType;
      /** @example 1048576 */
      readonly file_size: number;
      /** @example 550e8400-e29b-41d4-a716-446655440000 */
      readonly id: string;
      /** @example application/pdf */
      readonly mime_type: string;
      /** @example license.pdf */
      readonly original_filename: string;
      /**
       * Format: date-time
       * @example 2026-07-15T10:30:00.000Z
       */
      readonly updated_at: string;
    };
    readonly ProfessionalVerificationDocumentsStatusDto: {
      readonly documents: readonly components['schemas']['ProfessionalVerificationDocumentResponseDto'][];
      /** @example false */
      readonly is_complete: boolean;
      /**
       * @example [
       *       "government_id"
       *     ]
       */
      readonly missing_document_types: readonly PathsApiProfessionalsProfessionalIdVerificationDocumentsDocumentTypeDownloadGetParametersPathDocumentType[];
    };
    readonly ProfessionalVerificationStatusHistoryResponseDto: {
      /** @example 550e8400-e29b-41d4-a716-446655440000 */
      readonly changed_by_user_id: string;
      /**
       * Format: date-time
       * @example 2026-07-15T10:30:00.000Z
       */
      readonly created_at: string;
      /** @example 550e8400-e29b-41d4-a716-446655440000 */
      readonly id: string;
      /**
       * @example verified
       * @enum {string}
       */
      readonly new_status: CreateProfessionalDtoVerification_status;
      /**
       * @example pending
       * @enum {string|null}
       */
      readonly previous_status: CreateProfessionalDtoVerification_status;
      /** @example null */
      readonly reason: string | null;
    };
    readonly ProfessionalVerificationStatusResponseDto: {
      /** @example true */
      readonly documents_complete: boolean;
      /** @example 550e8400-e29b-41d4-a716-446655440000 */
      readonly professional_id: string;
      /**
       * @example pending
       * @enum {string}
       */
      readonly verification_status: CreateProfessionalDtoVerification_status;
    };
    readonly RefreshTokenDto: {
      /**
       * @description JWT refresh token with 7 days expiration
       * @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
       */
      readonly refresh_token: string;
    };
    readonly RefreshTokenResponseDto: {
      /**
       * @example full
       * @enum {string}
       */
      readonly access_level: LoginResponseDtoAccess_level;
      /**
       * @description JWT access token with 15 minutes expiration
       * @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
       */
      readonly access_token: string;
      /** @example Token refresh successful */
      readonly message: string | null;
      /**
       * @description JWT refresh token with 7 days expiration
       * @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
       */
      readonly refresh_token: string;
      /**
       * @example patient_home
       * @enum {string}
       */
      readonly routing_target: LoginResponseDtoRouting_target;
      /**
       * Format: date-time
       * @example 2024-01-15T10:30:00Z
       */
      readonly session_expires_at: string;
      /** @example 550e8400-e29b-41d4-a716-446655440000 */
      readonly session_id: string;
      /** @example 200 */
      readonly status_code: number | null;
      readonly user: components['schemas']['UserDto'];
      /**
       * @description Current provider verification status, when applicable
       * @example null
       */
      readonly verification_status: string | null;
    };
    readonly RefreshTokenResponseDtoData: {
      /**
       * @example full
       * @enum {string}
       */
      readonly access_level: LoginResponseDtoAccess_level;
      /**
       * @description JWT access token with 15 minutes expiration
       * @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
       */
      readonly access_token: string;
      /**
       * @description JWT refresh token with 7 days expiration
       * @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
       */
      readonly refresh_token: string;
      /**
       * @example patient_home
       * @enum {string}
       */
      readonly routing_target: LoginResponseDtoRouting_target;
      /**
       * Format: date-time
       * @example 2024-01-15T10:30:00Z
       */
      readonly session_expires_at: string;
      /** @example 550e8400-e29b-41d4-a716-446655440000 */
      readonly session_id: string;
      readonly user: components['schemas']['UserDto'];
      /**
       * @description Current provider verification status, when applicable
       * @example null
       */
      readonly verification_status: string | null;
    };
    readonly RejectLaboratoryVerificationDto: {
      /** @example The accreditation certificate is not readable. */
      readonly reason: string;
    };
    readonly RejectOrganizationDto: {
      readonly reason: string;
    };
    readonly RejectProfessionalVerificationDto: {
      /** @example The submitted license number could not be verified. */
      readonly reason: string;
    };
    readonly ResendVerificationDto: {
      /**
       * @description User email address
       * @example user@example.com
       */
      readonly email: string;
    };
    readonly ResetPasswordDto: {
      /**
       * @description New password
       * @example NewPassword123!
       */
      readonly newPassword: string;
      /**
       * @description Password reset token
       * @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
       */
      readonly token: string;
    };
    readonly ReviewResponseDto: {
      readonly booking_id?: string;
      readonly comment?: string;
      /** Format: date-time */
      readonly created_at: string;
      readonly id: string;
      readonly professional_id: string;
      readonly rating: number;
      readonly reviewer_id: string;
    };
    readonly SendChatMessageResponseDto: {
      /** @example Common flu symptoms include fever, cough, body aches, and fatigue. */
      readonly ai: string;
      /** @example 550e8400-e29b-41d4-a716-446655440000 */
      readonly chatId: string;
    };
    readonly SendMessageDto: {
      /**
       * @description Existing chat session ID. Omit this to start a new chat.
       * @example 7f0c53b4-57c4-4e53-8c3f-d3e9cf6fe5de
       */
      readonly chatId?: string;
      /**
       * @description Message content
       * @example Hello, AI!
       */
      readonly content: string;
    };
    readonly SetLaboratoryOperatingHourDto: {
      /**
       * @description Required in HH:mm format when the laboratory is open
       * @example 18:00
       */
      readonly closes_at?: string | null;
      /**
       * @example monday
       * @enum {string}
       */
      readonly day_of_week: LaboratoryOperatingHourResponseDtoDay_of_week;
      /** @example false */
      readonly is_closed: boolean;
      /**
       * @description Required in HH:mm format when the laboratory is open
       * @example 08:00
       */
      readonly opens_at?: string | null;
    };
    readonly SetLaboratoryOperatingHoursDto: {
      readonly hours: readonly components['schemas']['SetLaboratoryOperatingHourDto'][];
    };
    readonly SetupOrganizationDto: {
      readonly administrator: components['schemas']['OrganizationAdministratorDto'];
      readonly organization: components['schemas']['OrganizationDetailsDto'];
    };
    readonly SetupOrganizationResponseDto: {
      readonly administrator: components['schemas']['OrganizationAdministratorResponseDto'];
      readonly message: string;
      readonly organization: components['schemas']['OrganizationResponseDto'];
    };
    readonly SetupOrganizationResponseDtoData: {
      readonly administrator: components['schemas']['OrganizationAdministratorResponseDto'];
      readonly organization: components['schemas']['OrganizationResponseDto'];
    };
    readonly SignupResponseDto: {
      /**
       * @example limited
       * @enum {string}
       */
      readonly access_level: LoginResponseDtoAccess_level;
      /**
       * @description JWT access token with 15 minutes expiration
       * @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
       */
      readonly access_token: string;
      /** @example account created */
      readonly message: string | null;
      /**
       * @description JWT refresh token with 7 days expiration
       * @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
       */
      readonly refresh_token: string;
      /**
       * @example email_verification
       * @enum {string}
       */
      readonly routing_target: LoginResponseDtoRouting_target;
      /**
       * Format: date-time
       * @example 2024-01-15T10:30:00Z
       */
      readonly session_expires_at: string | null;
      /** @example 550e8400-e29b-41d4-a716-446655440000 */
      readonly session_id: string | null;
      /** @example 201 */
      readonly status_code: number | null;
      readonly user: components['schemas']['UserDto'];
      /**
       * @description Current provider verification status, when applicable
       * @example null
       */
      readonly verification_status: string | null;
    };
    readonly SignupResponseDtoData: {
      /**
       * @example limited
       * @enum {string}
       */
      readonly access_level: LoginResponseDtoAccess_level;
      /**
       * @description JWT access token with 15 minutes expiration
       * @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
       */
      readonly access_token: string;
      /**
       * @description JWT refresh token with 7 days expiration
       * @example eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
       */
      readonly refresh_token: string;
      /**
       * @example email_verification
       * @enum {string}
       */
      readonly routing_target: LoginResponseDtoRouting_target;
      /**
       * Format: date-time
       * @example 2024-01-15T10:30:00Z
       */
      readonly session_expires_at: string | null;
      /** @example 550e8400-e29b-41d4-a716-446655440000 */
      readonly session_id: string | null;
      readonly user: components['schemas']['UserDto'];
      /**
       * @description Current provider verification status, when applicable
       * @example null
       */
      readonly verification_status: string | null;
    };
    readonly SpecialityResponseDto: {
      /** Format: date-time */
      readonly created_at: string;
      readonly description?: string;
      readonly icon?: string;
      readonly id: string;
      readonly is_active: boolean;
      readonly name: string;
      /** Format: date-time */
      readonly updated_at: string;
    };
    readonly UpdateLaboratoryTestDto: {
      /** @example true */
      readonly is_active?: boolean;
      /** @example Full Blood Count */
      readonly name?: string;
      /** @example 15000 */
      readonly price?: number;
      /**
       * @description Expected turnaround time in minutes
       * @example 1440
       */
      readonly turnaround_time_minutes?: number;
    };
    readonly UpdateProfessionalDto: {
      /** @example Experienced general practitioner. */
      readonly about?: string;
      /** @example 5000 */
      readonly consultation_fee?: number;
      /**
       * @default both
       * @enum {string}
       */
      readonly consultation_type: CreateProfessionalDtoConsultation_type;
      readonly image?: string;
      readonly is_active?: boolean;
      readonly is_available?: boolean;
      /** @example MDCN-123456 */
      readonly license_number?: string;
      /**
       * @default pending
       * @enum {string}
       */
      readonly verification_status: CreateProfessionalDtoVerification_status;
      /** @example 8 */
      readonly years_of_experience?: number;
    };
    readonly UpdateProfessionalPatientNoteDto: {
      /** @example Patient reports recurring headaches in the evenings. Advised hydration and reduced screen time. */
      readonly content?: string;
    };
    readonly UpdateProfileDto: {
      /**
       * @description User country of residence
       * @example Nigeria
       */
      readonly country?: string | null;
      /**
       * @description Date of birth in YYYY-MM-DD format
       * @example 2000-01-15
       */
      readonly dob?: string | null;
      /**
       * @description User first name
       * @example John
       */
      readonly first_name?: string;
      /**
       * @description User gender
       * @example Male
       * @enum {string|null}
       */
      readonly gender?: AuthDtoGender;
      /**
       * @description User avatar image URL
       * @example https://res.cloudinary.com/ohealth/image/upload/v123/avatar.png
       */
      readonly image?: string | null;
      /**
       * @description User last name
       * @example Doe
       */
      readonly last_name?: string;
      /**
       * @description User middle name
       * @example Michael
       */
      readonly middle_name?: string | null;
      /**
       * @description User phone number
       * @example +1234567890
       */
      readonly phone?: string | null;
    };
    readonly UpdateSpecialityDto: {
      /** @example General medical consultations */
      readonly description?: string;
      /** @example stethoscope.png */
      readonly icon?: string;
      readonly is_active?: boolean;
      /** @example General Doctor */
      readonly name?: string;
    };
    readonly UpsertProfessionalProfileDto: {
      /** @example Experienced general practitioner focused on family medicine and preventive care. */
      readonly about?: string;
      /** @example 5000 */
      readonly consultation_fee?: number;
      /**
       * @example video
       * @enum {string}
       */
      readonly consultation_type: CreateProfessionalDtoConsultation_type;
      /** @example https://cdn.example.com/me.jpg */
      readonly image?: string;
      /** @example MDCN-123456 */
      readonly license_number: string;
      /** @example 123e4567-e89b-12d3-a456-426614174001 */
      readonly speciality_id: string;
      /** @example 8 */
      readonly years_of_experience: number;
    };
    readonly UserDto: {
      /** @example john.doe@example.com */
      readonly email: string;
      /** @example John */
      readonly first_name: string;
      /** @example 550e8400-e29b-41d4-a716-446655440000 */
      readonly id: string;
      /** @example Doe */
      readonly last_name: string;
      /**
       * @example [
       *       "PATIENT"
       *     ]
       */
      readonly role: readonly string[];
    };
    readonly VerifySignupDto: {
      /**
       * @description 6-digit verification code
       * @example 123456
       */
      readonly code: string;
      /**
       * @description User email address
       * @example user@example.com
       */
      readonly email: string;
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
  readonly TwoFactorAuthController_enable2fa: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      /** @description Returns secret, QR code, and backup codes */
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['EnableTwoFactorAuthDataDto'];
          };
        };
      };
      /** @description A valid access token is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly AuthController_changePassword: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['ChangePasswordDto'];
      };
    };
    readonly responses: {
      /** @description password changed */
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            /** @example null */
            readonly data: unknown;
          };
        };
      };
      /** @description Request validation failed */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description unauthorized */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly AuthController_forgotPassword: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['ForgotPasswordDto'];
      };
    };
    readonly responses: {
      readonly 201: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            /** @example null */
            readonly data: unknown;
          };
        };
      };
      /** @description Email validation failed */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly AuthController_googleLogin: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['GoogleLoginDto'];
      };
    };
    readonly responses: {
      /** @description login success */
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['LoginResponseDtoData'];
          };
        };
      };
      /** @description validation error */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description invalid credentials */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly AuthController_login: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['LoginDto'];
      };
    };
    readonly responses: {
      /** @description login success */
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['LoginResponseDtoData'];
          };
        };
      };
      /** @description validation error */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description invalid credentials */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly AuthController_logout: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['LogoutDto'];
      };
    };
    readonly responses: {
      /** @description logout success */
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            /** @example null */
            readonly data: unknown;
          };
        };
      };
      /** @description Request validation failed */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description token invalid */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly AuthController_getProfile: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      /** @description profile retrieved */
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['AuthMeResponseDto'];
          };
        };
      };
      /** @description unauthorized */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly AuthController_updateProfile: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['UpdateProfileDto'];
      };
    };
    readonly responses: {
      /** @description profile updated */
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['AuthMeResponseDto'];
          };
        };
      };
      /** @description Request validation failed */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description unauthorized */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly AuthController_refreshToken: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['RefreshTokenDto'];
      };
    };
    readonly responses: {
      /** @description token refresh successful */
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['RefreshTokenResponseDtoData'];
          };
        };
      };
      /** @description validation error */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description token invalid */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly AuthController_resetPassword: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['ResetPasswordDto'];
      };
    };
    readonly responses: {
      readonly 201: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            /** @example null */
            readonly data: unknown;
          };
        };
      };
      /** @description Reset code is invalid or expired */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly AuthController_signup: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['AuthDto'];
      };
    };
    readonly responses: {
      /** @description account created */
      readonly 201: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['SignupResponseDtoData'];
          };
        };
      };
      /** @description validation error */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description account already exists */
      readonly 409: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly AuthController_activateAccount: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        readonly user_id: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      /** @description user account activated */
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['ActivateAccountResponseDtoData'];
          };
        };
      };
      /** @description token invalid */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description permission denied */
      readonly 403: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description user not found */
      readonly 404: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly AuthController_verifySignup: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['VerifySignupDto'];
      };
    };
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            /** @example null */
            readonly data: unknown;
          };
        };
      };
      /** @description Verification code is invalid or expired */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description User account not found */
      readonly 404: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly AuthController_resendVerification: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['ResendVerificationDto'];
      };
    };
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            /** @example null */
            readonly data: unknown;
          };
        };
      };
      /** @description Account is already verified */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly BookingController_findAll: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      /** @description List of bookings */
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: readonly components['schemas']['BookingResponseDto'][];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly BookingController_create: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['CreateBookingDto'];
      };
    };
    readonly responses: {
      /** @description Booking created successfully */
      readonly 201: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['BookingResponseDto'];
          };
        };
      };
      /** @description Request validation failed */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly BookingController_findOne: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        /** @description Booking ID */
        readonly id: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      /** @description Booking details */
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['BookingResponseDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly BookingController_cancel: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        /** @description Booking ID */
        readonly id: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      /** @description Booking cancelled successfully */
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['BookingResponseDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ChatController_getHistory: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      /** @description Chat history returned. */
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['ChatHistoryResponseDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ChatController_sendMessage: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['SendMessageDto'];
      };
    };
    readonly responses: {
      /** @description AI response returned. */
      readonly 201: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['SendChatMessageResponseDto'];
          };
        };
      };
      /** @description Request validation failed */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description AI provider request failed */
      readonly 502: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly LaboratoryVerificationDocumentsController_listLaboratoryDocuments: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        /** @description Laboratory UUID */
        readonly laboratoryId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      /** @description Returns uploaded documents plus required document types still missing. */
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['LaboratoryVerificationDocumentsStatusDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly LaboratoryVerificationDocumentsController_downloadLaboratoryDocument: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        readonly documentType: PathsApiLaboratoriesLaboratoryIdVerificationDocumentsDocumentTypeDownloadGetParametersPathDocumentType;
        /** @description Laboratory UUID */
        readonly laboratoryId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      /** @description Signed download URL created */
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['LaboratoryVerificationDocumentDownloadDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Document not found */
      readonly 404: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly LaboratoryVerificationStatusController_getLaboratoryStatus: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        readonly laboratoryId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['LaboratoryVerificationStatusResponseDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Laboratory not found */
      readonly 404: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly LaboratoryVerificationStatusController_approve: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        readonly laboratoryId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['LaboratoryVerificationStatusResponseDto'];
          };
        };
      };
      /** @description Invalid status transition */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Admin access required */
      readonly 403: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Laboratory not found */
      readonly 404: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly LaboratoryVerificationStatusController_listHistory: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        readonly laboratoryId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: readonly components['schemas']['LaboratoryVerificationStatusHistoryResponseDto'][];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Laboratory not found */
      readonly 404: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly LaboratoryVerificationStatusController_reject: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        readonly laboratoryId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['RejectLaboratoryVerificationDto'];
      };
    };
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['LaboratoryVerificationStatusResponseDto'];
          };
        };
      };
      /** @description Invalid status transition or missing rejection reason */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Admin access required */
      readonly 403: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Laboratory not found */
      readonly 404: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly LaboratoryVerificationStatusController_markUnderReview: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        readonly laboratoryId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['LaboratoryVerificationStatusResponseDto'];
          };
        };
      };
      /** @description Invalid status transition */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Admin access required */
      readonly 403: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Laboratory not found */
      readonly 404: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly LaboratoryAuthController_setupAdministrator: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['LaboratoryAdminSetupDto'];
      };
    };
    readonly responses: {
      /** @description laboratory administrator setup completed successfully */
      readonly 201: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['LaboratoryAdminSetupResponseDtoData'];
          };
        };
      };
      /** @description validation error */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description unauthorized */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description permission denied */
      readonly 403: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Laboratory registration/license number already exists, or administrator email belongs to another account */
      readonly 409: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly LaboratoryVerificationDocumentsController_listMyDocuments: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      /** @description Returns uploaded documents plus required document types still missing. */
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['LaboratoryVerificationDocumentsStatusDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly LaboratoryVerificationDocumentsController_uploadMyDocument: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        readonly documentType: PathsApiLaboratoriesLaboratoryIdVerificationDocumentsDocumentTypeDownloadGetParametersPathDocumentType;
      };
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'multipart/form-data': {
          /**
           * Format: binary
           * @description Maximum size: 10485760 bytes. Accepted MIME types: application/pdf, image/jpeg, image/png, image/webp, image/jpg.
           */
          readonly file: string;
        };
      };
    };
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['LaboratoryVerificationDocumentResponseDto'];
          };
        };
      };
      /** @description Invalid document type or file */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Document changes are not allowed after the application enters review */
      readonly 403: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description File exceeds size limit */
      readonly 413: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly LaboratoryVerificationDocumentsController_deleteMyDocument: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        readonly documentType: PathsApiLaboratoriesLaboratoryIdVerificationDocumentsDocumentTypeDownloadGetParametersPathDocumentType;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      /** @description Document deleted */
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            /** @example null */
            readonly data: unknown;
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Document changes are not allowed after the application enters review */
      readonly 403: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly LaboratoryVerificationDocumentsController_downloadMyDocument: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        readonly documentType: PathsApiLaboratoriesLaboratoryIdVerificationDocumentsDocumentTypeDownloadGetParametersPathDocumentType;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      /** @description Signed download URL created */
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['LaboratoryVerificationDocumentDownloadDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Document not found */
      readonly 404: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly LaboratoryVerificationStatusController_getMyStatus: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['LaboratoryVerificationStatusResponseDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Laboratory administrator not found */
      readonly 404: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly LaboratoryVerificationStatusController_submitMyVerification: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['LaboratoryVerificationStatusResponseDto'];
          };
        };
      };
      /** @description Missing required documents or invalid status transition */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Laboratory administrator not found */
      readonly 404: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly LaboratoryPostApprovalController_listOperatingHours: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: readonly components['schemas']['LaboratoryOperatingHourResponseDto'][];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description An active, approved laboratory administrator account is required */
      readonly 403: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly LaboratoryPostApprovalController_setOperatingHours: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['SetLaboratoryOperatingHoursDto'];
      };
    };
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: readonly components['schemas']['LaboratoryOperatingHourResponseDto'][];
          };
        };
      };
      /** @description Invalid or duplicate operating-hour entries */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description An active, approved laboratory administrator account is required */
      readonly 403: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly LaboratoryPostApprovalController_listStaff: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: readonly components['schemas']['LaboratoryStaffResponseDto'][];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description An active, approved laboratory administrator account is required */
      readonly 403: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly LaboratoryPostApprovalController_inviteStaff: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['InviteLaboratoryStaffDto'];
      };
    };
    readonly responses: {
      readonly 201: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['InviteLaboratoryStaffResponseDtoData'];
          };
        };
      };
      /** @description Request validation failed */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description An active, approved laboratory administrator account is required */
      readonly 403: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description The email already belongs to a user or active invitation */
      readonly 409: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly LaboratoryPostApprovalController_acceptStaffInvitation: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['AcceptLaboratoryStaffInvitationDto'];
      };
    };
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['AcceptLaboratoryStaffInvitationResponseDtoData'];
          };
        };
      };
      /** @description Invitation is invalid, expired, or no longer usable */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description An account already exists for the invited email */
      readonly 409: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly LaboratoryPostApprovalController_listTests: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: readonly components['schemas']['LaboratoryTestResponseDto'][];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description An active, approved laboratory administrator account is required */
      readonly 403: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly LaboratoryPostApprovalController_createTest: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['CreateLaboratoryTestDto'];
      };
    };
    readonly responses: {
      readonly 201: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['LaboratoryTestResponseDto'];
          };
        };
      };
      /** @description Request validation failed */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description An active, approved laboratory administrator account is required */
      readonly 403: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description A test with this name already exists for the laboratory */
      readonly 409: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly LaboratoryPostApprovalController_updateTest: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        readonly testId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['UpdateLaboratoryTestDto'];
      };
    };
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['LaboratoryTestResponseDto'];
          };
        };
      };
      /** @description Request validation failed */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description An active, approved laboratory administrator account is required */
      readonly 403: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Laboratory test not found */
      readonly 404: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description A test with this name already exists for the laboratory */
      readonly 409: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly OrganizationController_listForReview: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        readonly organizationId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['OrganizationDocumentChecklistDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Organization not found */
      readonly 404: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly OrganizationController_downloadForReview: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        readonly documentType: string;
        readonly organizationId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['OrganizationDocumentDownloadDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Organization document not found */
      readonly 404: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly OrganizationController_getStatus: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        readonly organizationId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['OrganizationStatusResponseDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly OrganizationController_approve: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        readonly organizationId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['OrganizationStatusResponseDto'];
          };
        };
      };
      /** @description Invalid status transition */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly OrganizationController_listHistory: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        readonly organizationId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: readonly components['schemas']['OrganizationStatusHistoryResponseDto'][];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly OrganizationController_reject: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        readonly organizationId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['RejectOrganizationDto'];
      };
    };
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['OrganizationStatusResponseDto'];
          };
        };
      };
      /** @description Invalid status transition */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly OrganizationController_markUnderReview: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        readonly organizationId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['OrganizationStatusResponseDto'];
          };
        };
      };
      /** @description Invalid status transition */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly OrganizationController_setup: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['SetupOrganizationDto'];
      };
    };
    readonly responses: {
      readonly 201: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['SetupOrganizationResponseDtoData'];
          };
        };
      };
      /** @description Invalid organization setup data */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Registration number or administrator email already exists */
      readonly 409: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly OrganizationController_listMine: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['OrganizationDocumentChecklistDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Organization not found */
      readonly 404: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly OrganizationController_uploadMine: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        readonly documentType: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'multipart/form-data': {
          /**
           * Format: binary
           * @description Maximum size: 10485760 bytes. Accepted MIME types: application/pdf, image/jpeg, image/png, image/webp, image/jpg.
           */
          readonly file: string;
        };
      };
    };
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['OrganizationDocumentResponseDto'];
          };
        };
      };
      /** @description Invalid document, file, or onboarding state */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Organization administrator role required */
      readonly 403: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly OrganizationController_deleteMine: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        readonly documentType: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      /** @description Organization document deleted */
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            /** @example null */
            readonly data: unknown;
          };
        };
      };
      /** @description Documents are locked after review starts */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly OrganizationController_downloadMine: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        readonly documentType: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['OrganizationDocumentDownloadDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Organization document not found */
      readonly 404: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly OrganizationController_getMyStatus: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['OrganizationStatusResponseDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly OrganizationController_submitMine: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['OrganizationStatusResponseDto'];
          };
        };
      };
      /** @description Required documents are missing or transition is invalid */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly OrganizationController_listApplications: {
    readonly parameters: {
      readonly query?: {
        readonly limit?: number;
        readonly organization_type?: PathsApiOrganizationsOnboardingReviewApplicationsGetParametersQueryOrganization_type;
        readonly page?: number;
        readonly verification_status?: PathsApiOrganizationsOnboardingReviewApplicationsGetParametersQueryVerification_status;
      };
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['OrganizationReviewListResponseDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly PharmacyController_register: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['CreatePharmacyDto'];
      };
    };
    readonly responses: {
      readonly 201: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['PharmacyResponseDto'];
          };
        };
      };
      /** @description Request validation failed */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Pharmacy registration number or license number already exists */
      readonly 409: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalController_findBySpeciality: {
    readonly parameters: {
      readonly query: {
        /** @description Speciality UUID */
        readonly speciality_id: string;
      };
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: readonly components['schemas']['ProfessionalResponseDto'][];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalController_createProfessional: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['CreateProfessionalDto'];
      };
    };
    readonly responses: {
      readonly 201: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['ProfessionalResponseDto'];
          };
        };
      };
      /** @description User does not have a valid professional role */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description User or speciality not found */
      readonly 404: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Professional profile already exists for user */
      readonly 409: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalController_findOne: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        /** @description Professional UUID */
        readonly id: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['ProfessionalDetailResponseDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Professional not found */
      readonly 404: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalController_updateProfessional: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        /** @description Professional UUID */
        readonly id: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['UpdateProfessionalDto'];
      };
    };
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['ProfessionalResponseDto'];
          };
        };
      };
      /** @description Request validation failed */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Professional not found */
      readonly 404: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalController_createAvailabilities: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        /** @description Professional UUID */
        readonly id: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['BulkCreateAvailabilityDto'];
      };
    };
    readonly responses: {
      /** @description Slots created. */
      readonly 201: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: readonly components['schemas']['ProfessionalAvailabilityResponseDto'][];
          };
        };
      };
      /** @description Request validation failed */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Professional not found */
      readonly 404: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description One or more slots already exist */
      readonly 409: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalController_getReviews: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        /** @description Professional UUID */
        readonly id: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: readonly components['schemas']['ReviewResponseDto'][];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalController_createReview: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        /** @description Professional UUID */
        readonly id: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['CreateReviewDto'];
      };
    };
    readonly responses: {
      readonly 201: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['ReviewResponseDto'];
          };
        };
      };
      /** @description Request validation failed */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Professional not found */
      readonly 404: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Review already submitted for this booking */
      readonly 409: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalVerificationStatusController_reject: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        /** @description Professional UUID */
        readonly professionalId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['RejectProfessionalVerificationDto'];
      };
    };
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['ProfessionalVerificationStatusResponseDto'];
          };
        };
      };
      /** @description Request validation failed */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalVerificationDocumentsController_listProfessionalDocuments: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        /** @description Professional UUID */
        readonly professionalId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['ProfessionalVerificationDocumentsStatusDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalVerificationDocumentsController_downloadProfessionalDocument: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        readonly documentType: PathsApiProfessionalsProfessionalIdVerificationDocumentsDocumentTypeDownloadGetParametersPathDocumentType;
        /** @description Professional UUID */
        readonly professionalId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['ProfessionalVerificationDocumentDownloadDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalVerificationStatusController_listHistory: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        /** @description Professional UUID */
        readonly professionalId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: readonly components['schemas']['ProfessionalVerificationStatusHistoryResponseDto'][];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalVerificationStatusController_verify: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        /** @description Professional UUID */
        readonly professionalId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['ProfessionalVerificationStatusResponseDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalController_findMe: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['ProfessionalMeResponseDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalController_createMyAvailabilities: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['BulkCreateAvailabilityDto'];
      };
    };
    readonly responses: {
      /** @description Slots created. */
      readonly 201: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: readonly components['schemas']['ProfessionalAvailabilityResponseDto'][];
          };
        };
      };
      /** @description Request validation failed */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalController_acceptMyBooking: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        /** @description Booking UUID */
        readonly bookingId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['ProfessionalAppointmentResponseDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalController_rejectMyBooking: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        /** @description Booking UUID */
        readonly bookingId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['ProfessionalAppointmentResponseDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalController_getMyDashboard: {
    readonly parameters: {
      readonly query?: {
        /** @description Dashboard date in YYYY-MM-DD format. Defaults to today. */
        readonly date?: string;
      };
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['ProfessionalDashboardResponseDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalController_getMyPatients: {
    readonly parameters: {
      readonly query?: {
        /** @description Filter patients by condition text. */
        readonly condition?: string;
        /** @description Records per page. Defaults to 9 to match the dashboard table. */
        readonly limit?: string;
        /** @description Page number. Defaults to 1. */
        readonly page?: string;
        /** @description Search by patient name, ID, email, phone, or condition. */
        readonly search?: string;
        /** @description Sort patients by a table column. */
        readonly sort_by?: PathsApiProfessionalsMePatientsGetParametersQuerySort_by;
        /** @description Sort direction. */
        readonly sort_order?: PathsApiProfessionalsMePatientsGetParametersQuerySort_order;
      };
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['ProfessionalPatientRecordsResponseDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalController_getMyPatientProfile: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        /** @description Patient user UUID */
        readonly patientId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['ProfessionalPatientDetailResponseDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Patient not found for this professional */
      readonly 404: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalController_getMyPatientConsultations: {
    readonly parameters: {
      readonly query?: {
        /** @description Records per page. Defaults to 100 for the full history view. */
        readonly limit?: string;
        /** @description Page number. Defaults to 1. */
        readonly page?: string;
      };
      readonly header?: never;
      readonly path: {
        /** @description Patient user UUID */
        readonly patientId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['ProfessionalPatientConsultationsResponseDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalController_getMyPatientNotes: {
    readonly parameters: {
      readonly query?: {
        /** @description Records per page. Defaults to 20 for the full notes view. */
        readonly limit?: string;
        /** @description Page number. Defaults to 1. */
        readonly page?: string;
      };
      readonly header?: never;
      readonly path: {
        /** @description Patient user UUID */
        readonly patientId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['ProfessionalPatientNotesResponseDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalController_createMyPatientNote: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        /** @description Patient user UUID */
        readonly patientId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['CreateProfessionalPatientNoteDto'];
      };
    };
    readonly responses: {
      readonly 201: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['ProfessionalPatientNoteResponseDto'];
          };
        };
      };
      /** @description Request validation failed */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalController_updateMyPatientNote: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        /** @description Patient note UUID */
        readonly noteId: string;
        /** @description Patient user UUID */
        readonly patientId: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['UpdateProfessionalPatientNoteDto'];
      };
    };
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['ProfessionalPatientNoteResponseDto'];
          };
        };
      };
      /** @description Request validation failed */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalController_upsertMeProfile: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['UpsertProfessionalProfileDto'];
      };
    };
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['ProfessionalMeResponseDto'];
          };
        };
      };
      /** @description Request validation failed */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalVerificationDocumentsController_listMyDocuments: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['ProfessionalVerificationDocumentsStatusDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalVerificationDocumentsController_uploadMyDocument: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        readonly documentType: PathsApiProfessionalsProfessionalIdVerificationDocumentsDocumentTypeDownloadGetParametersPathDocumentType;
      };
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'multipart/form-data': {
          /**
           * Format: binary
           * @description Maximum size: 10485760 bytes. Accepted MIME types: application/pdf, image/jpeg, image/png, image/webp, image/jpg.
           */
          readonly file: string;
        };
      };
    };
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['ProfessionalVerificationDocumentResponseDto'];
          };
        };
      };
      /** @description Invalid document type or file */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description File exceeds size limit */
      readonly 413: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalVerificationDocumentsController_deleteMyDocument: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        readonly documentType: PathsApiProfessionalsProfessionalIdVerificationDocumentsDocumentTypeDownloadGetParametersPathDocumentType;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            /** @example null */
            readonly data: unknown;
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalVerificationDocumentsController_downloadMyDocument: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        readonly documentType: PathsApiProfessionalsProfessionalIdVerificationDocumentsDocumentTypeDownloadGetParametersPathDocumentType;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['ProfessionalVerificationDocumentDownloadDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly ProfessionalVerificationStatusController_getMyStatus: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['ProfessionalVerificationStatusResponseDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly SpecialityController_findAll: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: readonly components['schemas']['SpecialityResponseDto'][];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly SpecialityController_create: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path?: never;
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['CreateSpecialityDto'];
      };
    };
    readonly responses: {
      readonly 201: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['SpecialityResponseDto'];
          };
        };
      };
      /** @description Request validation failed */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Speciality name already exists */
      readonly 409: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly SpecialityController_findOne: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        /** @description Speciality UUID */
        readonly id: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody?: never;
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['SpecialityResponseDto'];
          };
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Speciality not found */
      readonly 404: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
  readonly SpecialityController_update: {
    readonly parameters: {
      readonly query?: never;
      readonly header?: never;
      readonly path: {
        /** @description Speciality UUID */
        readonly id: string;
      };
      readonly cookie?: never;
    };
    readonly requestBody: {
      readonly content: {
        readonly 'application/json': components['schemas']['UpdateSpecialityDto'];
      };
    };
    readonly responses: {
      readonly 200: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiSuccessResponseDto'] & {
            readonly data: components['schemas']['SpecialityResponseDto'];
          };
        };
      };
      /** @description Request validation failed */
      readonly 400: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Authentication is required */
      readonly 401: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Speciality not found */
      readonly 404: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
      /** @description Internal server error */
      readonly 500: {
        headers: {
          readonly [name: string]: unknown;
        };
        content: {
          readonly 'application/json': components['schemas']['ApiErrorResponseDto'];
        };
      };
    };
  };
}
export enum PathsApiLaboratoriesLaboratoryIdVerificationDocumentsDocumentTypeDownloadGetParametersPathDocumentType {
  laboratory_license = 'laboratory_license',
  accreditation_certificate = 'accreditation_certificate',
  cac_registration = 'cac_registration',
  identity_verification = 'identity_verification',
}
export enum PathsApiOrganizationsOnboardingReviewApplicationsGetParametersQueryOrganization_type {
  hospital = 'hospital',
  laboratory = 'laboratory',
  pharmacy = 'pharmacy',
}
export enum PathsApiOrganizationsOnboardingReviewApplicationsGetParametersQueryVerification_status {
  pending = 'pending',
  submitted = 'submitted',
  under_review = 'under_review',
  approved = 'approved',
  rejected = 'rejected',
}
export enum PathsApiProfessionalsProfessionalIdVerificationDocumentsDocumentTypeDownloadGetParametersPathDocumentType {
  professional_license = 'professional_license',
  government_id = 'government_id',
}
export enum PathsApiProfessionalsMePatientsGetParametersQuerySort_by {
  patient = 'patient',
  id = 'id',
  condition = 'condition',
  last_visit = 'last_visit',
}
export enum PathsApiProfessionalsMePatientsGetParametersQuerySort_order {
  asc = 'asc',
  desc = 'desc',
}
export enum AuthDtoGender {
  Male = 'Male',
  Female = 'Female',
  Other = 'Other',
}
export enum AuthDtoRole {
  PATIENT = 'PATIENT',
  DOCTOR = 'DOCTOR',
  THERAPIST = 'THERAPIST',
  COUNSELLOR = 'COUNSELLOR',
  LAB_PROFESSIONAL = 'LAB_PROFESSIONAL',
}
export enum BookingResponseDtoPayment_status {
  paid = 'paid',
  unpaid = 'unpaid',
}
export enum ChatMessageResponseDtoSender {
  user = 'user',
  ai = 'ai',
}
export enum CreateBookingDtoConsultation_type {
  chat = 'chat',
  video = 'video',
}
export enum CreateProfessionalDtoConsultation_type {
  chat = 'chat',
  video = 'video',
  both = 'both',
}
export enum CreateProfessionalDtoVerification_status {
  pending = 'pending',
  verified = 'verified',
  rejected = 'rejected',
}
export enum InviteLaboratoryStaffDtoRole {
  manager = 'manager',
  scientist = 'scientist',
  technician = 'technician',
  phlebotomist = 'phlebotomist',
  receptionist = 'receptionist',
}
export enum LaboratoryAdministratorSetupResponseDtoRole {
  ADMIN = 'ADMIN',
  PATIENT = 'PATIENT',
  DOCTOR = 'DOCTOR',
  THERAPIST = 'THERAPIST',
  COUNSELLOR = 'COUNSELLOR',
  LAB_PROFESSIONAL = 'LAB_PROFESSIONAL',
  LAB_STAFF = 'LAB_STAFF',
  LAB_ADMIN = 'LAB_ADMIN',
  HOSPITAL_ADMIN = 'HOSPITAL_ADMIN',
  PHARMACY_ADMIN = 'PHARMACY_ADMIN',
}
export enum LaboratoryOperatingHourResponseDtoDay_of_week {
  monday = 'monday',
  tuesday = 'tuesday',
  wednesday = 'wednesday',
  thursday = 'thursday',
  friday = 'friday',
  saturday = 'saturday',
  sunday = 'sunday',
}
export enum LaboratorySetupResponseDtoOnboarding_status {
  laboratory_created = 'laboratory_created',
  admin_setup_completed = 'admin_setup_completed',
  profile_completed = 'profile_completed',
  verification_submitted = 'verification_submitted',
  verified = 'verified',
}
export enum LaboratoryStaffResponseDtoStatus {
  invited = 'invited',
  active = 'active',
}
export enum LoginResponseDtoAccess_level {
  full = 'full',
  limited = 'limited',
}
export enum LoginResponseDtoRouting_target {
  email_verification = 'email_verification',
  admin_dashboard = 'admin_dashboard',
  patient_home = 'patient_home',
  professional_verification = 'professional_verification',
  professional_dashboard = 'professional_dashboard',
  hospital_verification = 'hospital_verification',
  hospital_dashboard = 'hospital_dashboard',
  laboratory_verification = 'laboratory_verification',
  laboratory_dashboard = 'laboratory_dashboard',
  pharmacy_verification = 'pharmacy_verification',
  pharmacy_dashboard = 'pharmacy_dashboard',
  account_setup = 'account_setup',
  account_restricted = 'account_restricted',
}
export enum OrganizationDocumentChecklistDtoMissing_document_types {
  operating_license = 'operating_license',
  business_registration = 'business_registration',
  accreditation_certificate = 'accreditation_certificate',
  admin_identity = 'admin_identity',
}
export enum PharmacyResponseDtoVerification_status {
  submitted = 'submitted',
  under_review = 'under_review',
  approved = 'approved',
  rejected = 'rejected',
}
export enum ProfessionalAppointmentResponseDtoStatus {
  pending = 'pending',
  confirmed = 'confirmed',
  completed = 'completed',
  cancelled = 'cancelled',
}
