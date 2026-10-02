/**
 * Generated from contracts/openapi.json. Do not edit manually.
 * Regenerate with: npm run api-client:generate
 */

import { createCoreClient } from '../core/client.js';
import type { ApiClientConfig, ApiHeaders } from '../core/types.js';
import type { operations } from './schema.js';

export type AuthController_activateAccountRequest = Readonly<{
  readonly path: NonNullable<
    operations['AuthController_activateAccount']['parameters']['path']
  >;
  readonly headers?: ApiHeaders;
}>;
export type AuthController_activateAccountResponse =
  operations['AuthController_activateAccount']['responses'][200]['content']['application/json'];
export type AuthController_activateAccountError =
  | operations['AuthController_activateAccount']['responses'][401]['content']['application/json']
  | operations['AuthController_activateAccount']['responses'][403]['content']['application/json']
  | operations['AuthController_activateAccount']['responses'][404]['content']['application/json']
  | operations['AuthController_activateAccount']['responses'][500]['content']['application/json'];

export type AuthController_changePasswordRequest = Readonly<{
  readonly body: NonNullable<
    operations['AuthController_changePassword']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type AuthController_changePasswordResponse =
  operations['AuthController_changePassword']['responses'][200]['content']['application/json'];
export type AuthController_changePasswordError =
  | operations['AuthController_changePassword']['responses'][400]['content']['application/json']
  | operations['AuthController_changePassword']['responses'][401]['content']['application/json']
  | operations['AuthController_changePassword']['responses'][500]['content']['application/json'];

export type AuthController_forgotPasswordRequest = Readonly<{
  readonly body: NonNullable<
    operations['AuthController_forgotPassword']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type AuthController_forgotPasswordResponse =
  operations['AuthController_forgotPassword']['responses'][201]['content']['application/json'];
export type AuthController_forgotPasswordError =
  | operations['AuthController_forgotPassword']['responses'][400]['content']['application/json']
  | operations['AuthController_forgotPassword']['responses'][500]['content']['application/json'];

export type AuthController_getProfileRequest = Readonly<{
  readonly headers?: ApiHeaders;
}>;
export type AuthController_getProfileResponse =
  operations['AuthController_getProfile']['responses'][200]['content']['application/json'];
export type AuthController_getProfileError =
  | operations['AuthController_getProfile']['responses'][401]['content']['application/json']
  | operations['AuthController_getProfile']['responses'][500]['content']['application/json'];

export type AuthController_googleLoginRequest = Readonly<{
  readonly body: NonNullable<
    operations['AuthController_googleLogin']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type AuthController_googleLoginResponse =
  operations['AuthController_googleLogin']['responses'][200]['content']['application/json'];
export type AuthController_googleLoginError =
  | operations['AuthController_googleLogin']['responses'][400]['content']['application/json']
  | operations['AuthController_googleLogin']['responses'][401]['content']['application/json']
  | operations['AuthController_googleLogin']['responses'][500]['content']['application/json'];

export type AuthController_loginRequest = Readonly<{
  readonly body: NonNullable<
    operations['AuthController_login']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type AuthController_loginResponse =
  operations['AuthController_login']['responses'][200]['content']['application/json'];
export type AuthController_loginError =
  | operations['AuthController_login']['responses'][400]['content']['application/json']
  | operations['AuthController_login']['responses'][401]['content']['application/json']
  | operations['AuthController_login']['responses'][500]['content']['application/json'];

export type AuthController_logoutRequest = Readonly<{
  readonly body: NonNullable<
    operations['AuthController_logout']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type AuthController_logoutResponse =
  operations['AuthController_logout']['responses'][200]['content']['application/json'];
export type AuthController_logoutError =
  | operations['AuthController_logout']['responses'][400]['content']['application/json']
  | operations['AuthController_logout']['responses'][401]['content']['application/json']
  | operations['AuthController_logout']['responses'][500]['content']['application/json'];

export type AuthController_refreshTokenRequest = Readonly<{
  readonly body: NonNullable<
    operations['AuthController_refreshToken']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type AuthController_refreshTokenResponse =
  operations['AuthController_refreshToken']['responses'][200]['content']['application/json'];
export type AuthController_refreshTokenError =
  | operations['AuthController_refreshToken']['responses'][400]['content']['application/json']
  | operations['AuthController_refreshToken']['responses'][401]['content']['application/json']
  | operations['AuthController_refreshToken']['responses'][500]['content']['application/json'];

export type AuthController_resendVerificationRequest = Readonly<{
  readonly body: NonNullable<
    operations['AuthController_resendVerification']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type AuthController_resendVerificationResponse =
  operations['AuthController_resendVerification']['responses'][200]['content']['application/json'];
export type AuthController_resendVerificationError =
  | operations['AuthController_resendVerification']['responses'][400]['content']['application/json']
  | operations['AuthController_resendVerification']['responses'][500]['content']['application/json'];

export type AuthController_resetPasswordRequest = Readonly<{
  readonly body: NonNullable<
    operations['AuthController_resetPassword']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type AuthController_resetPasswordResponse =
  operations['AuthController_resetPassword']['responses'][201]['content']['application/json'];
export type AuthController_resetPasswordError =
  | operations['AuthController_resetPassword']['responses'][400]['content']['application/json']
  | operations['AuthController_resetPassword']['responses'][500]['content']['application/json'];

export type AuthController_signupRequest = Readonly<{
  readonly body: NonNullable<
    operations['AuthController_signup']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type AuthController_signupResponse =
  operations['AuthController_signup']['responses'][201]['content']['application/json'];
export type AuthController_signupError =
  | operations['AuthController_signup']['responses'][400]['content']['application/json']
  | operations['AuthController_signup']['responses'][409]['content']['application/json']
  | operations['AuthController_signup']['responses'][500]['content']['application/json'];

export type AuthController_updateProfileRequest = Readonly<{
  readonly body: NonNullable<
    operations['AuthController_updateProfile']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type AuthController_updateProfileResponse =
  operations['AuthController_updateProfile']['responses'][200]['content']['application/json'];
export type AuthController_updateProfileError =
  | operations['AuthController_updateProfile']['responses'][400]['content']['application/json']
  | operations['AuthController_updateProfile']['responses'][401]['content']['application/json']
  | operations['AuthController_updateProfile']['responses'][500]['content']['application/json'];

export type AuthController_verifySignupRequest = Readonly<{
  readonly body: NonNullable<
    operations['AuthController_verifySignup']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type AuthController_verifySignupResponse =
  operations['AuthController_verifySignup']['responses'][200]['content']['application/json'];
export type AuthController_verifySignupError =
  | operations['AuthController_verifySignup']['responses'][400]['content']['application/json']
  | operations['AuthController_verifySignup']['responses'][404]['content']['application/json']
  | operations['AuthController_verifySignup']['responses'][500]['content']['application/json'];

export type BookingController_cancelRequest = Readonly<{
  readonly path: NonNullable<
    operations['BookingController_cancel']['parameters']['path']
  >;
  readonly headers?: ApiHeaders;
}>;
export type BookingController_cancelResponse =
  operations['BookingController_cancel']['responses'][200]['content']['application/json'];
export type BookingController_cancelError =
  | operations['BookingController_cancel']['responses'][401]['content']['application/json']
  | operations['BookingController_cancel']['responses'][500]['content']['application/json'];

export type BookingController_createRequest = Readonly<{
  readonly body: NonNullable<
    operations['BookingController_create']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type BookingController_createResponse =
  operations['BookingController_create']['responses'][201]['content']['application/json'];
export type BookingController_createError =
  | operations['BookingController_create']['responses'][400]['content']['application/json']
  | operations['BookingController_create']['responses'][401]['content']['application/json']
  | operations['BookingController_create']['responses'][500]['content']['application/json'];

export type BookingController_findAllRequest = Readonly<{
  readonly headers?: ApiHeaders;
}>;
export type BookingController_findAllResponse =
  operations['BookingController_findAll']['responses'][200]['content']['application/json'];
export type BookingController_findAllError =
  | operations['BookingController_findAll']['responses'][401]['content']['application/json']
  | operations['BookingController_findAll']['responses'][500]['content']['application/json'];

export type BookingController_findOneRequest = Readonly<{
  readonly path: NonNullable<
    operations['BookingController_findOne']['parameters']['path']
  >;
  readonly headers?: ApiHeaders;
}>;
export type BookingController_findOneResponse =
  operations['BookingController_findOne']['responses'][200]['content']['application/json'];
export type BookingController_findOneError =
  | operations['BookingController_findOne']['responses'][401]['content']['application/json']
  | operations['BookingController_findOne']['responses'][500]['content']['application/json'];

export type ChatController_getHistoryRequest = Readonly<{
  readonly headers?: ApiHeaders;
}>;
export type ChatController_getHistoryResponse =
  operations['ChatController_getHistory']['responses'][200]['content']['application/json'];
export type ChatController_getHistoryError =
  | operations['ChatController_getHistory']['responses'][401]['content']['application/json']
  | operations['ChatController_getHistory']['responses'][500]['content']['application/json'];

export type ChatController_sendMessageRequest = Readonly<{
  readonly body: NonNullable<
    operations['ChatController_sendMessage']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type ChatController_sendMessageResponse =
  operations['ChatController_sendMessage']['responses'][201]['content']['application/json'];
export type ChatController_sendMessageError =
  | operations['ChatController_sendMessage']['responses'][400]['content']['application/json']
  | operations['ChatController_sendMessage']['responses'][401]['content']['application/json']
  | operations['ChatController_sendMessage']['responses'][500]['content']['application/json']
  | operations['ChatController_sendMessage']['responses'][502]['content']['application/json'];

export type LaboratoryAuthController_setupAdministratorRequest = Readonly<{
  readonly body: NonNullable<
    operations['LaboratoryAuthController_setupAdministrator']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type LaboratoryAuthController_setupAdministratorResponse =
  operations['LaboratoryAuthController_setupAdministrator']['responses'][201]['content']['application/json'];
export type LaboratoryAuthController_setupAdministratorError =
  | operations['LaboratoryAuthController_setupAdministrator']['responses'][400]['content']['application/json']
  | operations['LaboratoryAuthController_setupAdministrator']['responses'][401]['content']['application/json']
  | operations['LaboratoryAuthController_setupAdministrator']['responses'][403]['content']['application/json']
  | operations['LaboratoryAuthController_setupAdministrator']['responses'][409]['content']['application/json']
  | operations['LaboratoryAuthController_setupAdministrator']['responses'][500]['content']['application/json'];

export type LaboratoryPostApprovalController_acceptStaffInvitationRequest =
  Readonly<{
    readonly body: NonNullable<
      operations['LaboratoryPostApprovalController_acceptStaffInvitation']['requestBody']
    >['content']['application/json'];
    readonly headers?: ApiHeaders;
  }>;
export type LaboratoryPostApprovalController_acceptStaffInvitationResponse =
  operations['LaboratoryPostApprovalController_acceptStaffInvitation']['responses'][200]['content']['application/json'];
export type LaboratoryPostApprovalController_acceptStaffInvitationError =
  | operations['LaboratoryPostApprovalController_acceptStaffInvitation']['responses'][400]['content']['application/json']
  | operations['LaboratoryPostApprovalController_acceptStaffInvitation']['responses'][409]['content']['application/json']
  | operations['LaboratoryPostApprovalController_acceptStaffInvitation']['responses'][500]['content']['application/json'];

export type LaboratoryPostApprovalController_createTestRequest = Readonly<{
  readonly body: NonNullable<
    operations['LaboratoryPostApprovalController_createTest']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type LaboratoryPostApprovalController_createTestResponse =
  operations['LaboratoryPostApprovalController_createTest']['responses'][201]['content']['application/json'];
export type LaboratoryPostApprovalController_createTestError =
  | operations['LaboratoryPostApprovalController_createTest']['responses'][400]['content']['application/json']
  | operations['LaboratoryPostApprovalController_createTest']['responses'][401]['content']['application/json']
  | operations['LaboratoryPostApprovalController_createTest']['responses'][403]['content']['application/json']
  | operations['LaboratoryPostApprovalController_createTest']['responses'][409]['content']['application/json']
  | operations['LaboratoryPostApprovalController_createTest']['responses'][500]['content']['application/json'];

export type LaboratoryPostApprovalController_inviteStaffRequest = Readonly<{
  readonly body: NonNullable<
    operations['LaboratoryPostApprovalController_inviteStaff']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type LaboratoryPostApprovalController_inviteStaffResponse =
  operations['LaboratoryPostApprovalController_inviteStaff']['responses'][201]['content']['application/json'];
export type LaboratoryPostApprovalController_inviteStaffError =
  | operations['LaboratoryPostApprovalController_inviteStaff']['responses'][400]['content']['application/json']
  | operations['LaboratoryPostApprovalController_inviteStaff']['responses'][401]['content']['application/json']
  | operations['LaboratoryPostApprovalController_inviteStaff']['responses'][403]['content']['application/json']
  | operations['LaboratoryPostApprovalController_inviteStaff']['responses'][409]['content']['application/json']
  | operations['LaboratoryPostApprovalController_inviteStaff']['responses'][500]['content']['application/json'];

export type LaboratoryPostApprovalController_listOperatingHoursRequest =
  Readonly<{
    readonly headers?: ApiHeaders;
  }>;
export type LaboratoryPostApprovalController_listOperatingHoursResponse =
  operations['LaboratoryPostApprovalController_listOperatingHours']['responses'][200]['content']['application/json'];
export type LaboratoryPostApprovalController_listOperatingHoursError =
  | operations['LaboratoryPostApprovalController_listOperatingHours']['responses'][401]['content']['application/json']
  | operations['LaboratoryPostApprovalController_listOperatingHours']['responses'][403]['content']['application/json']
  | operations['LaboratoryPostApprovalController_listOperatingHours']['responses'][500]['content']['application/json'];

export type LaboratoryPostApprovalController_listStaffRequest = Readonly<{
  readonly headers?: ApiHeaders;
}>;
export type LaboratoryPostApprovalController_listStaffResponse =
  operations['LaboratoryPostApprovalController_listStaff']['responses'][200]['content']['application/json'];
export type LaboratoryPostApprovalController_listStaffError =
  | operations['LaboratoryPostApprovalController_listStaff']['responses'][401]['content']['application/json']
  | operations['LaboratoryPostApprovalController_listStaff']['responses'][403]['content']['application/json']
  | operations['LaboratoryPostApprovalController_listStaff']['responses'][500]['content']['application/json'];

export type LaboratoryPostApprovalController_listTestsRequest = Readonly<{
  readonly headers?: ApiHeaders;
}>;
export type LaboratoryPostApprovalController_listTestsResponse =
  operations['LaboratoryPostApprovalController_listTests']['responses'][200]['content']['application/json'];
export type LaboratoryPostApprovalController_listTestsError =
  | operations['LaboratoryPostApprovalController_listTests']['responses'][401]['content']['application/json']
  | operations['LaboratoryPostApprovalController_listTests']['responses'][403]['content']['application/json']
  | operations['LaboratoryPostApprovalController_listTests']['responses'][500]['content']['application/json'];

export type LaboratoryPostApprovalController_setOperatingHoursRequest =
  Readonly<{
    readonly body: NonNullable<
      operations['LaboratoryPostApprovalController_setOperatingHours']['requestBody']
    >['content']['application/json'];
    readonly headers?: ApiHeaders;
  }>;
export type LaboratoryPostApprovalController_setOperatingHoursResponse =
  operations['LaboratoryPostApprovalController_setOperatingHours']['responses'][200]['content']['application/json'];
export type LaboratoryPostApprovalController_setOperatingHoursError =
  | operations['LaboratoryPostApprovalController_setOperatingHours']['responses'][400]['content']['application/json']
  | operations['LaboratoryPostApprovalController_setOperatingHours']['responses'][401]['content']['application/json']
  | operations['LaboratoryPostApprovalController_setOperatingHours']['responses'][403]['content']['application/json']
  | operations['LaboratoryPostApprovalController_setOperatingHours']['responses'][500]['content']['application/json'];

export type LaboratoryPostApprovalController_updateTestRequest = Readonly<{
  readonly path: NonNullable<
    operations['LaboratoryPostApprovalController_updateTest']['parameters']['path']
  >;
  readonly body: NonNullable<
    operations['LaboratoryPostApprovalController_updateTest']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type LaboratoryPostApprovalController_updateTestResponse =
  operations['LaboratoryPostApprovalController_updateTest']['responses'][200]['content']['application/json'];
export type LaboratoryPostApprovalController_updateTestError =
  | operations['LaboratoryPostApprovalController_updateTest']['responses'][400]['content']['application/json']
  | operations['LaboratoryPostApprovalController_updateTest']['responses'][401]['content']['application/json']
  | operations['LaboratoryPostApprovalController_updateTest']['responses'][403]['content']['application/json']
  | operations['LaboratoryPostApprovalController_updateTest']['responses'][404]['content']['application/json']
  | operations['LaboratoryPostApprovalController_updateTest']['responses'][409]['content']['application/json']
  | operations['LaboratoryPostApprovalController_updateTest']['responses'][500]['content']['application/json'];

export type LaboratoryVerificationDocumentsController_deleteMyDocumentRequest =
  Readonly<{
    readonly path: NonNullable<
      operations['LaboratoryVerificationDocumentsController_deleteMyDocument']['parameters']['path']
    >;
    readonly headers?: ApiHeaders;
  }>;
export type LaboratoryVerificationDocumentsController_deleteMyDocumentResponse =
  operations['LaboratoryVerificationDocumentsController_deleteMyDocument']['responses'][200]['content']['application/json'];
export type LaboratoryVerificationDocumentsController_deleteMyDocumentError =
  | operations['LaboratoryVerificationDocumentsController_deleteMyDocument']['responses'][401]['content']['application/json']
  | operations['LaboratoryVerificationDocumentsController_deleteMyDocument']['responses'][403]['content']['application/json']
  | operations['LaboratoryVerificationDocumentsController_deleteMyDocument']['responses'][500]['content']['application/json'];

export type LaboratoryVerificationDocumentsController_downloadLaboratoryDocumentRequest =
  Readonly<{
    readonly path: NonNullable<
      operations['LaboratoryVerificationDocumentsController_downloadLaboratoryDocument']['parameters']['path']
    >;
    readonly headers?: ApiHeaders;
  }>;
export type LaboratoryVerificationDocumentsController_downloadLaboratoryDocumentResponse =
  operations['LaboratoryVerificationDocumentsController_downloadLaboratoryDocument']['responses'][200]['content']['application/json'];
export type LaboratoryVerificationDocumentsController_downloadLaboratoryDocumentError =

    | operations['LaboratoryVerificationDocumentsController_downloadLaboratoryDocument']['responses'][401]['content']['application/json']
    | operations['LaboratoryVerificationDocumentsController_downloadLaboratoryDocument']['responses'][404]['content']['application/json']
    | operations['LaboratoryVerificationDocumentsController_downloadLaboratoryDocument']['responses'][500]['content']['application/json'];

export type LaboratoryVerificationDocumentsController_downloadMyDocumentRequest =
  Readonly<{
    readonly path: NonNullable<
      operations['LaboratoryVerificationDocumentsController_downloadMyDocument']['parameters']['path']
    >;
    readonly headers?: ApiHeaders;
  }>;
export type LaboratoryVerificationDocumentsController_downloadMyDocumentResponse =
  operations['LaboratoryVerificationDocumentsController_downloadMyDocument']['responses'][200]['content']['application/json'];
export type LaboratoryVerificationDocumentsController_downloadMyDocumentError =
  | operations['LaboratoryVerificationDocumentsController_downloadMyDocument']['responses'][401]['content']['application/json']
  | operations['LaboratoryVerificationDocumentsController_downloadMyDocument']['responses'][404]['content']['application/json']
  | operations['LaboratoryVerificationDocumentsController_downloadMyDocument']['responses'][500]['content']['application/json'];

export type LaboratoryVerificationDocumentsController_listLaboratoryDocumentsRequest =
  Readonly<{
    readonly path: NonNullable<
      operations['LaboratoryVerificationDocumentsController_listLaboratoryDocuments']['parameters']['path']
    >;
    readonly headers?: ApiHeaders;
  }>;
export type LaboratoryVerificationDocumentsController_listLaboratoryDocumentsResponse =
  operations['LaboratoryVerificationDocumentsController_listLaboratoryDocuments']['responses'][200]['content']['application/json'];
export type LaboratoryVerificationDocumentsController_listLaboratoryDocumentsError =

    | operations['LaboratoryVerificationDocumentsController_listLaboratoryDocuments']['responses'][401]['content']['application/json']
    | operations['LaboratoryVerificationDocumentsController_listLaboratoryDocuments']['responses'][500]['content']['application/json'];

export type LaboratoryVerificationDocumentsController_listMyDocumentsRequest =
  Readonly<{
    readonly headers?: ApiHeaders;
  }>;
export type LaboratoryVerificationDocumentsController_listMyDocumentsResponse =
  operations['LaboratoryVerificationDocumentsController_listMyDocuments']['responses'][200]['content']['application/json'];
export type LaboratoryVerificationDocumentsController_listMyDocumentsError =
  | operations['LaboratoryVerificationDocumentsController_listMyDocuments']['responses'][401]['content']['application/json']
  | operations['LaboratoryVerificationDocumentsController_listMyDocuments']['responses'][500]['content']['application/json'];

export type LaboratoryVerificationDocumentsController_uploadMyDocumentRequest =
  Readonly<{
    readonly path: NonNullable<
      operations['LaboratoryVerificationDocumentsController_uploadMyDocument']['parameters']['path']
    >;
    readonly body: NonNullable<
      operations['LaboratoryVerificationDocumentsController_uploadMyDocument']['requestBody']
    >['content']['multipart/form-data'];
    readonly headers?: ApiHeaders;
  }>;
export type LaboratoryVerificationDocumentsController_uploadMyDocumentResponse =
  operations['LaboratoryVerificationDocumentsController_uploadMyDocument']['responses'][200]['content']['application/json'];
export type LaboratoryVerificationDocumentsController_uploadMyDocumentError =
  | operations['LaboratoryVerificationDocumentsController_uploadMyDocument']['responses'][400]['content']['application/json']
  | operations['LaboratoryVerificationDocumentsController_uploadMyDocument']['responses'][401]['content']['application/json']
  | operations['LaboratoryVerificationDocumentsController_uploadMyDocument']['responses'][403]['content']['application/json']
  | operations['LaboratoryVerificationDocumentsController_uploadMyDocument']['responses'][413]['content']['application/json']
  | operations['LaboratoryVerificationDocumentsController_uploadMyDocument']['responses'][500]['content']['application/json'];

export type LaboratoryVerificationStatusController_approveRequest = Readonly<{
  readonly path: NonNullable<
    operations['LaboratoryVerificationStatusController_approve']['parameters']['path']
  >;
  readonly headers?: ApiHeaders;
}>;
export type LaboratoryVerificationStatusController_approveResponse =
  operations['LaboratoryVerificationStatusController_approve']['responses'][200]['content']['application/json'];
export type LaboratoryVerificationStatusController_approveError =
  | operations['LaboratoryVerificationStatusController_approve']['responses'][400]['content']['application/json']
  | operations['LaboratoryVerificationStatusController_approve']['responses'][401]['content']['application/json']
  | operations['LaboratoryVerificationStatusController_approve']['responses'][403]['content']['application/json']
  | operations['LaboratoryVerificationStatusController_approve']['responses'][404]['content']['application/json']
  | operations['LaboratoryVerificationStatusController_approve']['responses'][500]['content']['application/json'];

export type LaboratoryVerificationStatusController_getLaboratoryStatusRequest =
  Readonly<{
    readonly path: NonNullable<
      operations['LaboratoryVerificationStatusController_getLaboratoryStatus']['parameters']['path']
    >;
    readonly headers?: ApiHeaders;
  }>;
export type LaboratoryVerificationStatusController_getLaboratoryStatusResponse =
  operations['LaboratoryVerificationStatusController_getLaboratoryStatus']['responses'][200]['content']['application/json'];
export type LaboratoryVerificationStatusController_getLaboratoryStatusError =
  | operations['LaboratoryVerificationStatusController_getLaboratoryStatus']['responses'][401]['content']['application/json']
  | operations['LaboratoryVerificationStatusController_getLaboratoryStatus']['responses'][404]['content']['application/json']
  | operations['LaboratoryVerificationStatusController_getLaboratoryStatus']['responses'][500]['content']['application/json'];

export type LaboratoryVerificationStatusController_getMyStatusRequest =
  Readonly<{
    readonly headers?: ApiHeaders;
  }>;
export type LaboratoryVerificationStatusController_getMyStatusResponse =
  operations['LaboratoryVerificationStatusController_getMyStatus']['responses'][200]['content']['application/json'];
export type LaboratoryVerificationStatusController_getMyStatusError =
  | operations['LaboratoryVerificationStatusController_getMyStatus']['responses'][401]['content']['application/json']
  | operations['LaboratoryVerificationStatusController_getMyStatus']['responses'][404]['content']['application/json']
  | operations['LaboratoryVerificationStatusController_getMyStatus']['responses'][500]['content']['application/json'];

export type LaboratoryVerificationStatusController_listHistoryRequest =
  Readonly<{
    readonly path: NonNullable<
      operations['LaboratoryVerificationStatusController_listHistory']['parameters']['path']
    >;
    readonly headers?: ApiHeaders;
  }>;
export type LaboratoryVerificationStatusController_listHistoryResponse =
  operations['LaboratoryVerificationStatusController_listHistory']['responses'][200]['content']['application/json'];
export type LaboratoryVerificationStatusController_listHistoryError =
  | operations['LaboratoryVerificationStatusController_listHistory']['responses'][401]['content']['application/json']
  | operations['LaboratoryVerificationStatusController_listHistory']['responses'][404]['content']['application/json']
  | operations['LaboratoryVerificationStatusController_listHistory']['responses'][500]['content']['application/json'];

export type LaboratoryVerificationStatusController_markUnderReviewRequest =
  Readonly<{
    readonly path: NonNullable<
      operations['LaboratoryVerificationStatusController_markUnderReview']['parameters']['path']
    >;
    readonly headers?: ApiHeaders;
  }>;
export type LaboratoryVerificationStatusController_markUnderReviewResponse =
  operations['LaboratoryVerificationStatusController_markUnderReview']['responses'][200]['content']['application/json'];
export type LaboratoryVerificationStatusController_markUnderReviewError =
  | operations['LaboratoryVerificationStatusController_markUnderReview']['responses'][400]['content']['application/json']
  | operations['LaboratoryVerificationStatusController_markUnderReview']['responses'][401]['content']['application/json']
  | operations['LaboratoryVerificationStatusController_markUnderReview']['responses'][403]['content']['application/json']
  | operations['LaboratoryVerificationStatusController_markUnderReview']['responses'][404]['content']['application/json']
  | operations['LaboratoryVerificationStatusController_markUnderReview']['responses'][500]['content']['application/json'];

export type LaboratoryVerificationStatusController_rejectRequest = Readonly<{
  readonly path: NonNullable<
    operations['LaboratoryVerificationStatusController_reject']['parameters']['path']
  >;
  readonly body: NonNullable<
    operations['LaboratoryVerificationStatusController_reject']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type LaboratoryVerificationStatusController_rejectResponse =
  operations['LaboratoryVerificationStatusController_reject']['responses'][200]['content']['application/json'];
export type LaboratoryVerificationStatusController_rejectError =
  | operations['LaboratoryVerificationStatusController_reject']['responses'][400]['content']['application/json']
  | operations['LaboratoryVerificationStatusController_reject']['responses'][401]['content']['application/json']
  | operations['LaboratoryVerificationStatusController_reject']['responses'][403]['content']['application/json']
  | operations['LaboratoryVerificationStatusController_reject']['responses'][404]['content']['application/json']
  | operations['LaboratoryVerificationStatusController_reject']['responses'][500]['content']['application/json'];

export type LaboratoryVerificationStatusController_submitMyVerificationRequest =
  Readonly<{
    readonly headers?: ApiHeaders;
  }>;
export type LaboratoryVerificationStatusController_submitMyVerificationResponse =
  operations['LaboratoryVerificationStatusController_submitMyVerification']['responses'][200]['content']['application/json'];
export type LaboratoryVerificationStatusController_submitMyVerificationError =
  | operations['LaboratoryVerificationStatusController_submitMyVerification']['responses'][400]['content']['application/json']
  | operations['LaboratoryVerificationStatusController_submitMyVerification']['responses'][401]['content']['application/json']
  | operations['LaboratoryVerificationStatusController_submitMyVerification']['responses'][404]['content']['application/json']
  | operations['LaboratoryVerificationStatusController_submitMyVerification']['responses'][500]['content']['application/json'];

export type OrganizationController_approveRequest = Readonly<{
  readonly path: NonNullable<
    operations['OrganizationController_approve']['parameters']['path']
  >;
  readonly headers?: ApiHeaders;
}>;
export type OrganizationController_approveResponse =
  operations['OrganizationController_approve']['responses'][200]['content']['application/json'];
export type OrganizationController_approveError =
  | operations['OrganizationController_approve']['responses'][400]['content']['application/json']
  | operations['OrganizationController_approve']['responses'][401]['content']['application/json']
  | operations['OrganizationController_approve']['responses'][500]['content']['application/json'];

export type OrganizationController_deleteMineRequest = Readonly<{
  readonly path: NonNullable<
    operations['OrganizationController_deleteMine']['parameters']['path']
  >;
  readonly headers?: ApiHeaders;
}>;
export type OrganizationController_deleteMineResponse =
  operations['OrganizationController_deleteMine']['responses'][200]['content']['application/json'];
export type OrganizationController_deleteMineError =
  | operations['OrganizationController_deleteMine']['responses'][400]['content']['application/json']
  | operations['OrganizationController_deleteMine']['responses'][401]['content']['application/json']
  | operations['OrganizationController_deleteMine']['responses'][500]['content']['application/json'];

export type OrganizationController_downloadForReviewRequest = Readonly<{
  readonly path: NonNullable<
    operations['OrganizationController_downloadForReview']['parameters']['path']
  >;
  readonly headers?: ApiHeaders;
}>;
export type OrganizationController_downloadForReviewResponse =
  operations['OrganizationController_downloadForReview']['responses'][200]['content']['application/json'];
export type OrganizationController_downloadForReviewError =
  | operations['OrganizationController_downloadForReview']['responses'][401]['content']['application/json']
  | operations['OrganizationController_downloadForReview']['responses'][404]['content']['application/json']
  | operations['OrganizationController_downloadForReview']['responses'][500]['content']['application/json'];

export type OrganizationController_downloadMineRequest = Readonly<{
  readonly path: NonNullable<
    operations['OrganizationController_downloadMine']['parameters']['path']
  >;
  readonly headers?: ApiHeaders;
}>;
export type OrganizationController_downloadMineResponse =
  operations['OrganizationController_downloadMine']['responses'][200]['content']['application/json'];
export type OrganizationController_downloadMineError =
  | operations['OrganizationController_downloadMine']['responses'][401]['content']['application/json']
  | operations['OrganizationController_downloadMine']['responses'][404]['content']['application/json']
  | operations['OrganizationController_downloadMine']['responses'][500]['content']['application/json'];

export type OrganizationController_getMyStatusRequest = Readonly<{
  readonly headers?: ApiHeaders;
}>;
export type OrganizationController_getMyStatusResponse =
  operations['OrganizationController_getMyStatus']['responses'][200]['content']['application/json'];
export type OrganizationController_getMyStatusError =
  | operations['OrganizationController_getMyStatus']['responses'][401]['content']['application/json']
  | operations['OrganizationController_getMyStatus']['responses'][500]['content']['application/json'];

export type OrganizationController_getStatusRequest = Readonly<{
  readonly path: NonNullable<
    operations['OrganizationController_getStatus']['parameters']['path']
  >;
  readonly headers?: ApiHeaders;
}>;
export type OrganizationController_getStatusResponse =
  operations['OrganizationController_getStatus']['responses'][200]['content']['application/json'];
export type OrganizationController_getStatusError =
  | operations['OrganizationController_getStatus']['responses'][401]['content']['application/json']
  | operations['OrganizationController_getStatus']['responses'][500]['content']['application/json'];

export type OrganizationController_listApplicationsRequest = Readonly<{
  readonly query?: NonNullable<
    operations['OrganizationController_listApplications']['parameters']['query']
  >;
  readonly headers?: ApiHeaders;
}>;
export type OrganizationController_listApplicationsResponse =
  operations['OrganizationController_listApplications']['responses'][200]['content']['application/json'];
export type OrganizationController_listApplicationsError =
  | operations['OrganizationController_listApplications']['responses'][401]['content']['application/json']
  | operations['OrganizationController_listApplications']['responses'][500]['content']['application/json'];

export type OrganizationController_listForReviewRequest = Readonly<{
  readonly path: NonNullable<
    operations['OrganizationController_listForReview']['parameters']['path']
  >;
  readonly headers?: ApiHeaders;
}>;
export type OrganizationController_listForReviewResponse =
  operations['OrganizationController_listForReview']['responses'][200]['content']['application/json'];
export type OrganizationController_listForReviewError =
  | operations['OrganizationController_listForReview']['responses'][401]['content']['application/json']
  | operations['OrganizationController_listForReview']['responses'][404]['content']['application/json']
  | operations['OrganizationController_listForReview']['responses'][500]['content']['application/json'];

export type OrganizationController_listHistoryRequest = Readonly<{
  readonly path: NonNullable<
    operations['OrganizationController_listHistory']['parameters']['path']
  >;
  readonly headers?: ApiHeaders;
}>;
export type OrganizationController_listHistoryResponse =
  operations['OrganizationController_listHistory']['responses'][200]['content']['application/json'];
export type OrganizationController_listHistoryError =
  | operations['OrganizationController_listHistory']['responses'][401]['content']['application/json']
  | operations['OrganizationController_listHistory']['responses'][500]['content']['application/json'];

export type OrganizationController_listMineRequest = Readonly<{
  readonly headers?: ApiHeaders;
}>;
export type OrganizationController_listMineResponse =
  operations['OrganizationController_listMine']['responses'][200]['content']['application/json'];
export type OrganizationController_listMineError =
  | operations['OrganizationController_listMine']['responses'][401]['content']['application/json']
  | operations['OrganizationController_listMine']['responses'][404]['content']['application/json']
  | operations['OrganizationController_listMine']['responses'][500]['content']['application/json'];

export type OrganizationController_markUnderReviewRequest = Readonly<{
  readonly path: NonNullable<
    operations['OrganizationController_markUnderReview']['parameters']['path']
  >;
  readonly headers?: ApiHeaders;
}>;
export type OrganizationController_markUnderReviewResponse =
  operations['OrganizationController_markUnderReview']['responses'][200]['content']['application/json'];
export type OrganizationController_markUnderReviewError =
  | operations['OrganizationController_markUnderReview']['responses'][400]['content']['application/json']
  | operations['OrganizationController_markUnderReview']['responses'][401]['content']['application/json']
  | operations['OrganizationController_markUnderReview']['responses'][500]['content']['application/json'];

export type OrganizationController_rejectRequest = Readonly<{
  readonly path: NonNullable<
    operations['OrganizationController_reject']['parameters']['path']
  >;
  readonly body: NonNullable<
    operations['OrganizationController_reject']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type OrganizationController_rejectResponse =
  operations['OrganizationController_reject']['responses'][200]['content']['application/json'];
export type OrganizationController_rejectError =
  | operations['OrganizationController_reject']['responses'][400]['content']['application/json']
  | operations['OrganizationController_reject']['responses'][401]['content']['application/json']
  | operations['OrganizationController_reject']['responses'][500]['content']['application/json'];

export type OrganizationController_setupRequest = Readonly<{
  readonly body: NonNullable<
    operations['OrganizationController_setup']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type OrganizationController_setupResponse =
  operations['OrganizationController_setup']['responses'][201]['content']['application/json'];
export type OrganizationController_setupError =
  | operations['OrganizationController_setup']['responses'][400]['content']['application/json']
  | operations['OrganizationController_setup']['responses'][401]['content']['application/json']
  | operations['OrganizationController_setup']['responses'][409]['content']['application/json']
  | operations['OrganizationController_setup']['responses'][500]['content']['application/json'];

export type OrganizationController_submitMineRequest = Readonly<{
  readonly headers?: ApiHeaders;
}>;
export type OrganizationController_submitMineResponse =
  operations['OrganizationController_submitMine']['responses'][200]['content']['application/json'];
export type OrganizationController_submitMineError =
  | operations['OrganizationController_submitMine']['responses'][400]['content']['application/json']
  | operations['OrganizationController_submitMine']['responses'][401]['content']['application/json']
  | operations['OrganizationController_submitMine']['responses'][500]['content']['application/json'];

export type OrganizationController_uploadMineRequest = Readonly<{
  readonly path: NonNullable<
    operations['OrganizationController_uploadMine']['parameters']['path']
  >;
  readonly body: NonNullable<
    operations['OrganizationController_uploadMine']['requestBody']
  >['content']['multipart/form-data'];
  readonly headers?: ApiHeaders;
}>;
export type OrganizationController_uploadMineResponse =
  operations['OrganizationController_uploadMine']['responses'][200]['content']['application/json'];
export type OrganizationController_uploadMineError =
  | operations['OrganizationController_uploadMine']['responses'][400]['content']['application/json']
  | operations['OrganizationController_uploadMine']['responses'][401]['content']['application/json']
  | operations['OrganizationController_uploadMine']['responses'][403]['content']['application/json']
  | operations['OrganizationController_uploadMine']['responses'][500]['content']['application/json'];

export type PharmacyController_registerRequest = Readonly<{
  readonly body: NonNullable<
    operations['PharmacyController_register']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type PharmacyController_registerResponse =
  operations['PharmacyController_register']['responses'][201]['content']['application/json'];
export type PharmacyController_registerError =
  | operations['PharmacyController_register']['responses'][400]['content']['application/json']
  | operations['PharmacyController_register']['responses'][409]['content']['application/json']
  | operations['PharmacyController_register']['responses'][500]['content']['application/json'];

export type ProfessionalController_acceptMyBookingRequest = Readonly<{
  readonly path: NonNullable<
    operations['ProfessionalController_acceptMyBooking']['parameters']['path']
  >;
  readonly headers?: ApiHeaders;
}>;
export type ProfessionalController_acceptMyBookingResponse =
  operations['ProfessionalController_acceptMyBooking']['responses'][200]['content']['application/json'];
export type ProfessionalController_acceptMyBookingError =
  | operations['ProfessionalController_acceptMyBooking']['responses'][401]['content']['application/json']
  | operations['ProfessionalController_acceptMyBooking']['responses'][500]['content']['application/json'];

export type ProfessionalController_createAvailabilitiesRequest = Readonly<{
  readonly path: NonNullable<
    operations['ProfessionalController_createAvailabilities']['parameters']['path']
  >;
  readonly body: NonNullable<
    operations['ProfessionalController_createAvailabilities']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type ProfessionalController_createAvailabilitiesResponse =
  operations['ProfessionalController_createAvailabilities']['responses'][201]['content']['application/json'];
export type ProfessionalController_createAvailabilitiesError =
  | operations['ProfessionalController_createAvailabilities']['responses'][400]['content']['application/json']
  | operations['ProfessionalController_createAvailabilities']['responses'][401]['content']['application/json']
  | operations['ProfessionalController_createAvailabilities']['responses'][404]['content']['application/json']
  | operations['ProfessionalController_createAvailabilities']['responses'][409]['content']['application/json']
  | operations['ProfessionalController_createAvailabilities']['responses'][500]['content']['application/json'];

export type ProfessionalController_createMyAvailabilitiesRequest = Readonly<{
  readonly body: NonNullable<
    operations['ProfessionalController_createMyAvailabilities']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type ProfessionalController_createMyAvailabilitiesResponse =
  operations['ProfessionalController_createMyAvailabilities']['responses'][201]['content']['application/json'];
export type ProfessionalController_createMyAvailabilitiesError =
  | operations['ProfessionalController_createMyAvailabilities']['responses'][400]['content']['application/json']
  | operations['ProfessionalController_createMyAvailabilities']['responses'][401]['content']['application/json']
  | operations['ProfessionalController_createMyAvailabilities']['responses'][500]['content']['application/json'];

export type ProfessionalController_createMyPatientNoteRequest = Readonly<{
  readonly path: NonNullable<
    operations['ProfessionalController_createMyPatientNote']['parameters']['path']
  >;
  readonly body: NonNullable<
    operations['ProfessionalController_createMyPatientNote']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type ProfessionalController_createMyPatientNoteResponse =
  operations['ProfessionalController_createMyPatientNote']['responses'][201]['content']['application/json'];
export type ProfessionalController_createMyPatientNoteError =
  | operations['ProfessionalController_createMyPatientNote']['responses'][400]['content']['application/json']
  | operations['ProfessionalController_createMyPatientNote']['responses'][401]['content']['application/json']
  | operations['ProfessionalController_createMyPatientNote']['responses'][500]['content']['application/json'];

export type ProfessionalController_createProfessionalRequest = Readonly<{
  readonly body: NonNullable<
    operations['ProfessionalController_createProfessional']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type ProfessionalController_createProfessionalResponse =
  operations['ProfessionalController_createProfessional']['responses'][201]['content']['application/json'];
export type ProfessionalController_createProfessionalError =
  | operations['ProfessionalController_createProfessional']['responses'][400]['content']['application/json']
  | operations['ProfessionalController_createProfessional']['responses'][401]['content']['application/json']
  | operations['ProfessionalController_createProfessional']['responses'][404]['content']['application/json']
  | operations['ProfessionalController_createProfessional']['responses'][409]['content']['application/json']
  | operations['ProfessionalController_createProfessional']['responses'][500]['content']['application/json'];

export type ProfessionalController_createReviewRequest = Readonly<{
  readonly path: NonNullable<
    operations['ProfessionalController_createReview']['parameters']['path']
  >;
  readonly body: NonNullable<
    operations['ProfessionalController_createReview']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type ProfessionalController_createReviewResponse =
  operations['ProfessionalController_createReview']['responses'][201]['content']['application/json'];
export type ProfessionalController_createReviewError =
  | operations['ProfessionalController_createReview']['responses'][400]['content']['application/json']
  | operations['ProfessionalController_createReview']['responses'][401]['content']['application/json']
  | operations['ProfessionalController_createReview']['responses'][404]['content']['application/json']
  | operations['ProfessionalController_createReview']['responses'][409]['content']['application/json']
  | operations['ProfessionalController_createReview']['responses'][500]['content']['application/json'];

export type ProfessionalController_findBySpecialityRequest = Readonly<{
  readonly query: NonNullable<
    operations['ProfessionalController_findBySpeciality']['parameters']['query']
  >;
  readonly headers?: ApiHeaders;
}>;
export type ProfessionalController_findBySpecialityResponse =
  operations['ProfessionalController_findBySpeciality']['responses'][200]['content']['application/json'];
export type ProfessionalController_findBySpecialityError =
  | operations['ProfessionalController_findBySpeciality']['responses'][401]['content']['application/json']
  | operations['ProfessionalController_findBySpeciality']['responses'][500]['content']['application/json'];

export type ProfessionalController_findMeRequest = Readonly<{
  readonly headers?: ApiHeaders;
}>;
export type ProfessionalController_findMeResponse =
  operations['ProfessionalController_findMe']['responses'][200]['content']['application/json'];
export type ProfessionalController_findMeError =
  | operations['ProfessionalController_findMe']['responses'][401]['content']['application/json']
  | operations['ProfessionalController_findMe']['responses'][500]['content']['application/json'];

export type ProfessionalController_findOneRequest = Readonly<{
  readonly path: NonNullable<
    operations['ProfessionalController_findOne']['parameters']['path']
  >;
  readonly headers?: ApiHeaders;
}>;
export type ProfessionalController_findOneResponse =
  operations['ProfessionalController_findOne']['responses'][200]['content']['application/json'];
export type ProfessionalController_findOneError =
  | operations['ProfessionalController_findOne']['responses'][401]['content']['application/json']
  | operations['ProfessionalController_findOne']['responses'][404]['content']['application/json']
  | operations['ProfessionalController_findOne']['responses'][500]['content']['application/json'];

export type ProfessionalController_getMyDashboardRequest = Readonly<{
  readonly query?: NonNullable<
    operations['ProfessionalController_getMyDashboard']['parameters']['query']
  >;
  readonly headers?: ApiHeaders;
}>;
export type ProfessionalController_getMyDashboardResponse =
  operations['ProfessionalController_getMyDashboard']['responses'][200]['content']['application/json'];
export type ProfessionalController_getMyDashboardError =
  | operations['ProfessionalController_getMyDashboard']['responses'][401]['content']['application/json']
  | operations['ProfessionalController_getMyDashboard']['responses'][500]['content']['application/json'];

export type ProfessionalController_getMyPatientConsultationsRequest = Readonly<{
  readonly path: NonNullable<
    operations['ProfessionalController_getMyPatientConsultations']['parameters']['path']
  >;
  readonly query?: NonNullable<
    operations['ProfessionalController_getMyPatientConsultations']['parameters']['query']
  >;
  readonly headers?: ApiHeaders;
}>;
export type ProfessionalController_getMyPatientConsultationsResponse =
  operations['ProfessionalController_getMyPatientConsultations']['responses'][200]['content']['application/json'];
export type ProfessionalController_getMyPatientConsultationsError =
  | operations['ProfessionalController_getMyPatientConsultations']['responses'][401]['content']['application/json']
  | operations['ProfessionalController_getMyPatientConsultations']['responses'][500]['content']['application/json'];

export type ProfessionalController_getMyPatientNotesRequest = Readonly<{
  readonly path: NonNullable<
    operations['ProfessionalController_getMyPatientNotes']['parameters']['path']
  >;
  readonly query?: NonNullable<
    operations['ProfessionalController_getMyPatientNotes']['parameters']['query']
  >;
  readonly headers?: ApiHeaders;
}>;
export type ProfessionalController_getMyPatientNotesResponse =
  operations['ProfessionalController_getMyPatientNotes']['responses'][200]['content']['application/json'];
export type ProfessionalController_getMyPatientNotesError =
  | operations['ProfessionalController_getMyPatientNotes']['responses'][401]['content']['application/json']
  | operations['ProfessionalController_getMyPatientNotes']['responses'][500]['content']['application/json'];

export type ProfessionalController_getMyPatientProfileRequest = Readonly<{
  readonly path: NonNullable<
    operations['ProfessionalController_getMyPatientProfile']['parameters']['path']
  >;
  readonly headers?: ApiHeaders;
}>;
export type ProfessionalController_getMyPatientProfileResponse =
  operations['ProfessionalController_getMyPatientProfile']['responses'][200]['content']['application/json'];
export type ProfessionalController_getMyPatientProfileError =
  | operations['ProfessionalController_getMyPatientProfile']['responses'][401]['content']['application/json']
  | operations['ProfessionalController_getMyPatientProfile']['responses'][404]['content']['application/json']
  | operations['ProfessionalController_getMyPatientProfile']['responses'][500]['content']['application/json'];

export type ProfessionalController_getMyPatientsRequest = Readonly<{
  readonly query?: NonNullable<
    operations['ProfessionalController_getMyPatients']['parameters']['query']
  >;
  readonly headers?: ApiHeaders;
}>;
export type ProfessionalController_getMyPatientsResponse =
  operations['ProfessionalController_getMyPatients']['responses'][200]['content']['application/json'];
export type ProfessionalController_getMyPatientsError =
  | operations['ProfessionalController_getMyPatients']['responses'][401]['content']['application/json']
  | operations['ProfessionalController_getMyPatients']['responses'][500]['content']['application/json'];

export type ProfessionalController_getReviewsRequest = Readonly<{
  readonly path: NonNullable<
    operations['ProfessionalController_getReviews']['parameters']['path']
  >;
  readonly headers?: ApiHeaders;
}>;
export type ProfessionalController_getReviewsResponse =
  operations['ProfessionalController_getReviews']['responses'][200]['content']['application/json'];
export type ProfessionalController_getReviewsError =
  | operations['ProfessionalController_getReviews']['responses'][401]['content']['application/json']
  | operations['ProfessionalController_getReviews']['responses'][500]['content']['application/json'];

export type ProfessionalController_rejectMyBookingRequest = Readonly<{
  readonly path: NonNullable<
    operations['ProfessionalController_rejectMyBooking']['parameters']['path']
  >;
  readonly headers?: ApiHeaders;
}>;
export type ProfessionalController_rejectMyBookingResponse =
  operations['ProfessionalController_rejectMyBooking']['responses'][200]['content']['application/json'];
export type ProfessionalController_rejectMyBookingError =
  | operations['ProfessionalController_rejectMyBooking']['responses'][401]['content']['application/json']
  | operations['ProfessionalController_rejectMyBooking']['responses'][500]['content']['application/json'];

export type ProfessionalController_updateMyPatientNoteRequest = Readonly<{
  readonly path: NonNullable<
    operations['ProfessionalController_updateMyPatientNote']['parameters']['path']
  >;
  readonly body: NonNullable<
    operations['ProfessionalController_updateMyPatientNote']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type ProfessionalController_updateMyPatientNoteResponse =
  operations['ProfessionalController_updateMyPatientNote']['responses'][200]['content']['application/json'];
export type ProfessionalController_updateMyPatientNoteError =
  | operations['ProfessionalController_updateMyPatientNote']['responses'][400]['content']['application/json']
  | operations['ProfessionalController_updateMyPatientNote']['responses'][401]['content']['application/json']
  | operations['ProfessionalController_updateMyPatientNote']['responses'][500]['content']['application/json'];

export type ProfessionalController_updateProfessionalRequest = Readonly<{
  readonly path: NonNullable<
    operations['ProfessionalController_updateProfessional']['parameters']['path']
  >;
  readonly body: NonNullable<
    operations['ProfessionalController_updateProfessional']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type ProfessionalController_updateProfessionalResponse =
  operations['ProfessionalController_updateProfessional']['responses'][200]['content']['application/json'];
export type ProfessionalController_updateProfessionalError =
  | operations['ProfessionalController_updateProfessional']['responses'][400]['content']['application/json']
  | operations['ProfessionalController_updateProfessional']['responses'][401]['content']['application/json']
  | operations['ProfessionalController_updateProfessional']['responses'][404]['content']['application/json']
  | operations['ProfessionalController_updateProfessional']['responses'][500]['content']['application/json'];

export type ProfessionalController_upsertMeProfileRequest = Readonly<{
  readonly body: NonNullable<
    operations['ProfessionalController_upsertMeProfile']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type ProfessionalController_upsertMeProfileResponse =
  operations['ProfessionalController_upsertMeProfile']['responses'][200]['content']['application/json'];
export type ProfessionalController_upsertMeProfileError =
  | operations['ProfessionalController_upsertMeProfile']['responses'][400]['content']['application/json']
  | operations['ProfessionalController_upsertMeProfile']['responses'][401]['content']['application/json']
  | operations['ProfessionalController_upsertMeProfile']['responses'][500]['content']['application/json'];

export type ProfessionalVerificationDocumentsController_deleteMyDocumentRequest =
  Readonly<{
    readonly path: NonNullable<
      operations['ProfessionalVerificationDocumentsController_deleteMyDocument']['parameters']['path']
    >;
    readonly headers?: ApiHeaders;
  }>;
export type ProfessionalVerificationDocumentsController_deleteMyDocumentResponse =
  operations['ProfessionalVerificationDocumentsController_deleteMyDocument']['responses'][200]['content']['application/json'];
export type ProfessionalVerificationDocumentsController_deleteMyDocumentError =
  | operations['ProfessionalVerificationDocumentsController_deleteMyDocument']['responses'][401]['content']['application/json']
  | operations['ProfessionalVerificationDocumentsController_deleteMyDocument']['responses'][500]['content']['application/json'];

export type ProfessionalVerificationDocumentsController_downloadMyDocumentRequest =
  Readonly<{
    readonly path: NonNullable<
      operations['ProfessionalVerificationDocumentsController_downloadMyDocument']['parameters']['path']
    >;
    readonly headers?: ApiHeaders;
  }>;
export type ProfessionalVerificationDocumentsController_downloadMyDocumentResponse =
  operations['ProfessionalVerificationDocumentsController_downloadMyDocument']['responses'][200]['content']['application/json'];
export type ProfessionalVerificationDocumentsController_downloadMyDocumentError =

    | operations['ProfessionalVerificationDocumentsController_downloadMyDocument']['responses'][401]['content']['application/json']
    | operations['ProfessionalVerificationDocumentsController_downloadMyDocument']['responses'][500]['content']['application/json'];

export type ProfessionalVerificationDocumentsController_downloadProfessionalDocumentRequest =
  Readonly<{
    readonly path: NonNullable<
      operations['ProfessionalVerificationDocumentsController_downloadProfessionalDocument']['parameters']['path']
    >;
    readonly headers?: ApiHeaders;
  }>;
export type ProfessionalVerificationDocumentsController_downloadProfessionalDocumentResponse =
  operations['ProfessionalVerificationDocumentsController_downloadProfessionalDocument']['responses'][200]['content']['application/json'];
export type ProfessionalVerificationDocumentsController_downloadProfessionalDocumentError =

    | operations['ProfessionalVerificationDocumentsController_downloadProfessionalDocument']['responses'][401]['content']['application/json']
    | operations['ProfessionalVerificationDocumentsController_downloadProfessionalDocument']['responses'][500]['content']['application/json'];

export type ProfessionalVerificationDocumentsController_listMyDocumentsRequest =
  Readonly<{
    readonly headers?: ApiHeaders;
  }>;
export type ProfessionalVerificationDocumentsController_listMyDocumentsResponse =
  operations['ProfessionalVerificationDocumentsController_listMyDocuments']['responses'][200]['content']['application/json'];
export type ProfessionalVerificationDocumentsController_listMyDocumentsError =
  | operations['ProfessionalVerificationDocumentsController_listMyDocuments']['responses'][401]['content']['application/json']
  | operations['ProfessionalVerificationDocumentsController_listMyDocuments']['responses'][500]['content']['application/json'];

export type ProfessionalVerificationDocumentsController_listProfessionalDocumentsRequest =
  Readonly<{
    readonly path: NonNullable<
      operations['ProfessionalVerificationDocumentsController_listProfessionalDocuments']['parameters']['path']
    >;
    readonly headers?: ApiHeaders;
  }>;
export type ProfessionalVerificationDocumentsController_listProfessionalDocumentsResponse =
  operations['ProfessionalVerificationDocumentsController_listProfessionalDocuments']['responses'][200]['content']['application/json'];
export type ProfessionalVerificationDocumentsController_listProfessionalDocumentsError =

    | operations['ProfessionalVerificationDocumentsController_listProfessionalDocuments']['responses'][401]['content']['application/json']
    | operations['ProfessionalVerificationDocumentsController_listProfessionalDocuments']['responses'][500]['content']['application/json'];

export type ProfessionalVerificationDocumentsController_uploadMyDocumentRequest =
  Readonly<{
    readonly path: NonNullable<
      operations['ProfessionalVerificationDocumentsController_uploadMyDocument']['parameters']['path']
    >;
    readonly body: NonNullable<
      operations['ProfessionalVerificationDocumentsController_uploadMyDocument']['requestBody']
    >['content']['multipart/form-data'];
    readonly headers?: ApiHeaders;
  }>;
export type ProfessionalVerificationDocumentsController_uploadMyDocumentResponse =
  operations['ProfessionalVerificationDocumentsController_uploadMyDocument']['responses'][200]['content']['application/json'];
export type ProfessionalVerificationDocumentsController_uploadMyDocumentError =
  | operations['ProfessionalVerificationDocumentsController_uploadMyDocument']['responses'][400]['content']['application/json']
  | operations['ProfessionalVerificationDocumentsController_uploadMyDocument']['responses'][401]['content']['application/json']
  | operations['ProfessionalVerificationDocumentsController_uploadMyDocument']['responses'][413]['content']['application/json']
  | operations['ProfessionalVerificationDocumentsController_uploadMyDocument']['responses'][500]['content']['application/json'];

export type ProfessionalVerificationStatusController_getMyStatusRequest =
  Readonly<{
    readonly headers?: ApiHeaders;
  }>;
export type ProfessionalVerificationStatusController_getMyStatusResponse =
  operations['ProfessionalVerificationStatusController_getMyStatus']['responses'][200]['content']['application/json'];
export type ProfessionalVerificationStatusController_getMyStatusError =
  | operations['ProfessionalVerificationStatusController_getMyStatus']['responses'][401]['content']['application/json']
  | operations['ProfessionalVerificationStatusController_getMyStatus']['responses'][500]['content']['application/json'];

export type ProfessionalVerificationStatusController_listHistoryRequest =
  Readonly<{
    readonly path: NonNullable<
      operations['ProfessionalVerificationStatusController_listHistory']['parameters']['path']
    >;
    readonly headers?: ApiHeaders;
  }>;
export type ProfessionalVerificationStatusController_listHistoryResponse =
  operations['ProfessionalVerificationStatusController_listHistory']['responses'][200]['content']['application/json'];
export type ProfessionalVerificationStatusController_listHistoryError =
  | operations['ProfessionalVerificationStatusController_listHistory']['responses'][401]['content']['application/json']
  | operations['ProfessionalVerificationStatusController_listHistory']['responses'][500]['content']['application/json'];

export type ProfessionalVerificationStatusController_rejectRequest = Readonly<{
  readonly path: NonNullable<
    operations['ProfessionalVerificationStatusController_reject']['parameters']['path']
  >;
  readonly body: NonNullable<
    operations['ProfessionalVerificationStatusController_reject']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type ProfessionalVerificationStatusController_rejectResponse =
  operations['ProfessionalVerificationStatusController_reject']['responses'][200]['content']['application/json'];
export type ProfessionalVerificationStatusController_rejectError =
  | operations['ProfessionalVerificationStatusController_reject']['responses'][400]['content']['application/json']
  | operations['ProfessionalVerificationStatusController_reject']['responses'][401]['content']['application/json']
  | operations['ProfessionalVerificationStatusController_reject']['responses'][500]['content']['application/json'];

export type ProfessionalVerificationStatusController_verifyRequest = Readonly<{
  readonly path: NonNullable<
    operations['ProfessionalVerificationStatusController_verify']['parameters']['path']
  >;
  readonly headers?: ApiHeaders;
}>;
export type ProfessionalVerificationStatusController_verifyResponse =
  operations['ProfessionalVerificationStatusController_verify']['responses'][200]['content']['application/json'];
export type ProfessionalVerificationStatusController_verifyError =
  | operations['ProfessionalVerificationStatusController_verify']['responses'][401]['content']['application/json']
  | operations['ProfessionalVerificationStatusController_verify']['responses'][500]['content']['application/json'];

export type SpecialityController_createRequest = Readonly<{
  readonly body: NonNullable<
    operations['SpecialityController_create']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type SpecialityController_createResponse =
  operations['SpecialityController_create']['responses'][201]['content']['application/json'];
export type SpecialityController_createError =
  | operations['SpecialityController_create']['responses'][400]['content']['application/json']
  | operations['SpecialityController_create']['responses'][401]['content']['application/json']
  | operations['SpecialityController_create']['responses'][409]['content']['application/json']
  | operations['SpecialityController_create']['responses'][500]['content']['application/json'];

export type SpecialityController_findAllRequest = Readonly<{
  readonly headers?: ApiHeaders;
}>;
export type SpecialityController_findAllResponse =
  operations['SpecialityController_findAll']['responses'][200]['content']['application/json'];
export type SpecialityController_findAllError =
  | operations['SpecialityController_findAll']['responses'][401]['content']['application/json']
  | operations['SpecialityController_findAll']['responses'][500]['content']['application/json'];

export type SpecialityController_findOneRequest = Readonly<{
  readonly path: NonNullable<
    operations['SpecialityController_findOne']['parameters']['path']
  >;
  readonly headers?: ApiHeaders;
}>;
export type SpecialityController_findOneResponse =
  operations['SpecialityController_findOne']['responses'][200]['content']['application/json'];
export type SpecialityController_findOneError =
  | operations['SpecialityController_findOne']['responses'][401]['content']['application/json']
  | operations['SpecialityController_findOne']['responses'][404]['content']['application/json']
  | operations['SpecialityController_findOne']['responses'][500]['content']['application/json'];

export type SpecialityController_updateRequest = Readonly<{
  readonly path: NonNullable<
    operations['SpecialityController_update']['parameters']['path']
  >;
  readonly body: NonNullable<
    operations['SpecialityController_update']['requestBody']
  >['content']['application/json'];
  readonly headers?: ApiHeaders;
}>;
export type SpecialityController_updateResponse =
  operations['SpecialityController_update']['responses'][200]['content']['application/json'];
export type SpecialityController_updateError =
  | operations['SpecialityController_update']['responses'][400]['content']['application/json']
  | operations['SpecialityController_update']['responses'][401]['content']['application/json']
  | operations['SpecialityController_update']['responses'][404]['content']['application/json']
  | operations['SpecialityController_update']['responses'][500]['content']['application/json'];

export type TwoFactorAuthController_enable2faRequest = Readonly<{
  readonly headers?: ApiHeaders;
}>;
export type TwoFactorAuthController_enable2faResponse =
  operations['TwoFactorAuthController_enable2fa']['responses'][200]['content']['application/json'];
export type TwoFactorAuthController_enable2faError =
  | operations['TwoFactorAuthController_enable2fa']['responses'][401]['content']['application/json']
  | operations['TwoFactorAuthController_enable2fa']['responses'][500]['content']['application/json'];

export interface ApiClient {
  readonly AuthController_activateAccount: (
    request: AuthController_activateAccountRequest,
  ) => Promise<AuthController_activateAccountResponse>;
  readonly AuthController_changePassword: (
    request: AuthController_changePasswordRequest,
  ) => Promise<AuthController_changePasswordResponse>;
  readonly AuthController_forgotPassword: (
    request: AuthController_forgotPasswordRequest,
  ) => Promise<AuthController_forgotPasswordResponse>;
  readonly AuthController_getProfile: (
    request?: AuthController_getProfileRequest,
  ) => Promise<AuthController_getProfileResponse>;
  readonly AuthController_googleLogin: (
    request: AuthController_googleLoginRequest,
  ) => Promise<AuthController_googleLoginResponse>;
  readonly AuthController_login: (
    request: AuthController_loginRequest,
  ) => Promise<AuthController_loginResponse>;
  readonly AuthController_logout: (
    request: AuthController_logoutRequest,
  ) => Promise<AuthController_logoutResponse>;
  readonly AuthController_refreshToken: (
    request: AuthController_refreshTokenRequest,
  ) => Promise<AuthController_refreshTokenResponse>;
  readonly AuthController_resendVerification: (
    request: AuthController_resendVerificationRequest,
  ) => Promise<AuthController_resendVerificationResponse>;
  readonly AuthController_resetPassword: (
    request: AuthController_resetPasswordRequest,
  ) => Promise<AuthController_resetPasswordResponse>;
  readonly AuthController_signup: (
    request: AuthController_signupRequest,
  ) => Promise<AuthController_signupResponse>;
  readonly AuthController_updateProfile: (
    request: AuthController_updateProfileRequest,
  ) => Promise<AuthController_updateProfileResponse>;
  readonly AuthController_verifySignup: (
    request: AuthController_verifySignupRequest,
  ) => Promise<AuthController_verifySignupResponse>;
  readonly BookingController_cancel: (
    request: BookingController_cancelRequest,
  ) => Promise<BookingController_cancelResponse>;
  readonly BookingController_create: (
    request: BookingController_createRequest,
  ) => Promise<BookingController_createResponse>;
  readonly BookingController_findAll: (
    request?: BookingController_findAllRequest,
  ) => Promise<BookingController_findAllResponse>;
  readonly BookingController_findOne: (
    request: BookingController_findOneRequest,
  ) => Promise<BookingController_findOneResponse>;
  readonly ChatController_getHistory: (
    request?: ChatController_getHistoryRequest,
  ) => Promise<ChatController_getHistoryResponse>;
  readonly ChatController_sendMessage: (
    request: ChatController_sendMessageRequest,
  ) => Promise<ChatController_sendMessageResponse>;
  readonly LaboratoryAuthController_setupAdministrator: (
    request: LaboratoryAuthController_setupAdministratorRequest,
  ) => Promise<LaboratoryAuthController_setupAdministratorResponse>;
  readonly LaboratoryPostApprovalController_acceptStaffInvitation: (
    request: LaboratoryPostApprovalController_acceptStaffInvitationRequest,
  ) => Promise<LaboratoryPostApprovalController_acceptStaffInvitationResponse>;
  readonly LaboratoryPostApprovalController_createTest: (
    request: LaboratoryPostApprovalController_createTestRequest,
  ) => Promise<LaboratoryPostApprovalController_createTestResponse>;
  readonly LaboratoryPostApprovalController_inviteStaff: (
    request: LaboratoryPostApprovalController_inviteStaffRequest,
  ) => Promise<LaboratoryPostApprovalController_inviteStaffResponse>;
  readonly LaboratoryPostApprovalController_listOperatingHours: (
    request?: LaboratoryPostApprovalController_listOperatingHoursRequest,
  ) => Promise<LaboratoryPostApprovalController_listOperatingHoursResponse>;
  readonly LaboratoryPostApprovalController_listStaff: (
    request?: LaboratoryPostApprovalController_listStaffRequest,
  ) => Promise<LaboratoryPostApprovalController_listStaffResponse>;
  readonly LaboratoryPostApprovalController_listTests: (
    request?: LaboratoryPostApprovalController_listTestsRequest,
  ) => Promise<LaboratoryPostApprovalController_listTestsResponse>;
  readonly LaboratoryPostApprovalController_setOperatingHours: (
    request: LaboratoryPostApprovalController_setOperatingHoursRequest,
  ) => Promise<LaboratoryPostApprovalController_setOperatingHoursResponse>;
  readonly LaboratoryPostApprovalController_updateTest: (
    request: LaboratoryPostApprovalController_updateTestRequest,
  ) => Promise<LaboratoryPostApprovalController_updateTestResponse>;
  readonly LaboratoryVerificationDocumentsController_deleteMyDocument: (
    request: LaboratoryVerificationDocumentsController_deleteMyDocumentRequest,
  ) => Promise<LaboratoryVerificationDocumentsController_deleteMyDocumentResponse>;
  readonly LaboratoryVerificationDocumentsController_downloadLaboratoryDocument: (
    request: LaboratoryVerificationDocumentsController_downloadLaboratoryDocumentRequest,
  ) => Promise<LaboratoryVerificationDocumentsController_downloadLaboratoryDocumentResponse>;
  readonly LaboratoryVerificationDocumentsController_downloadMyDocument: (
    request: LaboratoryVerificationDocumentsController_downloadMyDocumentRequest,
  ) => Promise<LaboratoryVerificationDocumentsController_downloadMyDocumentResponse>;
  readonly LaboratoryVerificationDocumentsController_listLaboratoryDocuments: (
    request: LaboratoryVerificationDocumentsController_listLaboratoryDocumentsRequest,
  ) => Promise<LaboratoryVerificationDocumentsController_listLaboratoryDocumentsResponse>;
  readonly LaboratoryVerificationDocumentsController_listMyDocuments: (
    request?: LaboratoryVerificationDocumentsController_listMyDocumentsRequest,
  ) => Promise<LaboratoryVerificationDocumentsController_listMyDocumentsResponse>;
  readonly LaboratoryVerificationDocumentsController_uploadMyDocument: (
    request: LaboratoryVerificationDocumentsController_uploadMyDocumentRequest,
  ) => Promise<LaboratoryVerificationDocumentsController_uploadMyDocumentResponse>;
  readonly LaboratoryVerificationStatusController_approve: (
    request: LaboratoryVerificationStatusController_approveRequest,
  ) => Promise<LaboratoryVerificationStatusController_approveResponse>;
  readonly LaboratoryVerificationStatusController_getLaboratoryStatus: (
    request: LaboratoryVerificationStatusController_getLaboratoryStatusRequest,
  ) => Promise<LaboratoryVerificationStatusController_getLaboratoryStatusResponse>;
  readonly LaboratoryVerificationStatusController_getMyStatus: (
    request?: LaboratoryVerificationStatusController_getMyStatusRequest,
  ) => Promise<LaboratoryVerificationStatusController_getMyStatusResponse>;
  readonly LaboratoryVerificationStatusController_listHistory: (
    request: LaboratoryVerificationStatusController_listHistoryRequest,
  ) => Promise<LaboratoryVerificationStatusController_listHistoryResponse>;
  readonly LaboratoryVerificationStatusController_markUnderReview: (
    request: LaboratoryVerificationStatusController_markUnderReviewRequest,
  ) => Promise<LaboratoryVerificationStatusController_markUnderReviewResponse>;
  readonly LaboratoryVerificationStatusController_reject: (
    request: LaboratoryVerificationStatusController_rejectRequest,
  ) => Promise<LaboratoryVerificationStatusController_rejectResponse>;
  readonly LaboratoryVerificationStatusController_submitMyVerification: (
    request?: LaboratoryVerificationStatusController_submitMyVerificationRequest,
  ) => Promise<LaboratoryVerificationStatusController_submitMyVerificationResponse>;
  readonly OrganizationController_approve: (
    request: OrganizationController_approveRequest,
  ) => Promise<OrganizationController_approveResponse>;
  readonly OrganizationController_deleteMine: (
    request: OrganizationController_deleteMineRequest,
  ) => Promise<OrganizationController_deleteMineResponse>;
  readonly OrganizationController_downloadForReview: (
    request: OrganizationController_downloadForReviewRequest,
  ) => Promise<OrganizationController_downloadForReviewResponse>;
  readonly OrganizationController_downloadMine: (
    request: OrganizationController_downloadMineRequest,
  ) => Promise<OrganizationController_downloadMineResponse>;
  readonly OrganizationController_getMyStatus: (
    request?: OrganizationController_getMyStatusRequest,
  ) => Promise<OrganizationController_getMyStatusResponse>;
  readonly OrganizationController_getStatus: (
    request: OrganizationController_getStatusRequest,
  ) => Promise<OrganizationController_getStatusResponse>;
  readonly OrganizationController_listApplications: (
    request?: OrganizationController_listApplicationsRequest,
  ) => Promise<OrganizationController_listApplicationsResponse>;
  readonly OrganizationController_listForReview: (
    request: OrganizationController_listForReviewRequest,
  ) => Promise<OrganizationController_listForReviewResponse>;
  readonly OrganizationController_listHistory: (
    request: OrganizationController_listHistoryRequest,
  ) => Promise<OrganizationController_listHistoryResponse>;
  readonly OrganizationController_listMine: (
    request?: OrganizationController_listMineRequest,
  ) => Promise<OrganizationController_listMineResponse>;
  readonly OrganizationController_markUnderReview: (
    request: OrganizationController_markUnderReviewRequest,
  ) => Promise<OrganizationController_markUnderReviewResponse>;
  readonly OrganizationController_reject: (
    request: OrganizationController_rejectRequest,
  ) => Promise<OrganizationController_rejectResponse>;
  readonly OrganizationController_setup: (
    request: OrganizationController_setupRequest,
  ) => Promise<OrganizationController_setupResponse>;
  readonly OrganizationController_submitMine: (
    request?: OrganizationController_submitMineRequest,
  ) => Promise<OrganizationController_submitMineResponse>;
  readonly OrganizationController_uploadMine: (
    request: OrganizationController_uploadMineRequest,
  ) => Promise<OrganizationController_uploadMineResponse>;
  readonly PharmacyController_register: (
    request: PharmacyController_registerRequest,
  ) => Promise<PharmacyController_registerResponse>;
  readonly ProfessionalController_acceptMyBooking: (
    request: ProfessionalController_acceptMyBookingRequest,
  ) => Promise<ProfessionalController_acceptMyBookingResponse>;
  readonly ProfessionalController_createAvailabilities: (
    request: ProfessionalController_createAvailabilitiesRequest,
  ) => Promise<ProfessionalController_createAvailabilitiesResponse>;
  readonly ProfessionalController_createMyAvailabilities: (
    request: ProfessionalController_createMyAvailabilitiesRequest,
  ) => Promise<ProfessionalController_createMyAvailabilitiesResponse>;
  readonly ProfessionalController_createMyPatientNote: (
    request: ProfessionalController_createMyPatientNoteRequest,
  ) => Promise<ProfessionalController_createMyPatientNoteResponse>;
  readonly ProfessionalController_createProfessional: (
    request: ProfessionalController_createProfessionalRequest,
  ) => Promise<ProfessionalController_createProfessionalResponse>;
  readonly ProfessionalController_createReview: (
    request: ProfessionalController_createReviewRequest,
  ) => Promise<ProfessionalController_createReviewResponse>;
  readonly ProfessionalController_findBySpeciality: (
    request: ProfessionalController_findBySpecialityRequest,
  ) => Promise<ProfessionalController_findBySpecialityResponse>;
  readonly ProfessionalController_findMe: (
    request?: ProfessionalController_findMeRequest,
  ) => Promise<ProfessionalController_findMeResponse>;
  readonly ProfessionalController_findOne: (
    request: ProfessionalController_findOneRequest,
  ) => Promise<ProfessionalController_findOneResponse>;
  readonly ProfessionalController_getMyDashboard: (
    request?: ProfessionalController_getMyDashboardRequest,
  ) => Promise<ProfessionalController_getMyDashboardResponse>;
  readonly ProfessionalController_getMyPatientConsultations: (
    request: ProfessionalController_getMyPatientConsultationsRequest,
  ) => Promise<ProfessionalController_getMyPatientConsultationsResponse>;
  readonly ProfessionalController_getMyPatientNotes: (
    request: ProfessionalController_getMyPatientNotesRequest,
  ) => Promise<ProfessionalController_getMyPatientNotesResponse>;
  readonly ProfessionalController_getMyPatientProfile: (
    request: ProfessionalController_getMyPatientProfileRequest,
  ) => Promise<ProfessionalController_getMyPatientProfileResponse>;
  readonly ProfessionalController_getMyPatients: (
    request?: ProfessionalController_getMyPatientsRequest,
  ) => Promise<ProfessionalController_getMyPatientsResponse>;
  readonly ProfessionalController_getReviews: (
    request: ProfessionalController_getReviewsRequest,
  ) => Promise<ProfessionalController_getReviewsResponse>;
  readonly ProfessionalController_rejectMyBooking: (
    request: ProfessionalController_rejectMyBookingRequest,
  ) => Promise<ProfessionalController_rejectMyBookingResponse>;
  readonly ProfessionalController_updateMyPatientNote: (
    request: ProfessionalController_updateMyPatientNoteRequest,
  ) => Promise<ProfessionalController_updateMyPatientNoteResponse>;
  readonly ProfessionalController_updateProfessional: (
    request: ProfessionalController_updateProfessionalRequest,
  ) => Promise<ProfessionalController_updateProfessionalResponse>;
  readonly ProfessionalController_upsertMeProfile: (
    request: ProfessionalController_upsertMeProfileRequest,
  ) => Promise<ProfessionalController_upsertMeProfileResponse>;
  readonly ProfessionalVerificationDocumentsController_deleteMyDocument: (
    request: ProfessionalVerificationDocumentsController_deleteMyDocumentRequest,
  ) => Promise<ProfessionalVerificationDocumentsController_deleteMyDocumentResponse>;
  readonly ProfessionalVerificationDocumentsController_downloadMyDocument: (
    request: ProfessionalVerificationDocumentsController_downloadMyDocumentRequest,
  ) => Promise<ProfessionalVerificationDocumentsController_downloadMyDocumentResponse>;
  readonly ProfessionalVerificationDocumentsController_downloadProfessionalDocument: (
    request: ProfessionalVerificationDocumentsController_downloadProfessionalDocumentRequest,
  ) => Promise<ProfessionalVerificationDocumentsController_downloadProfessionalDocumentResponse>;
  readonly ProfessionalVerificationDocumentsController_listMyDocuments: (
    request?: ProfessionalVerificationDocumentsController_listMyDocumentsRequest,
  ) => Promise<ProfessionalVerificationDocumentsController_listMyDocumentsResponse>;
  readonly ProfessionalVerificationDocumentsController_listProfessionalDocuments: (
    request: ProfessionalVerificationDocumentsController_listProfessionalDocumentsRequest,
  ) => Promise<ProfessionalVerificationDocumentsController_listProfessionalDocumentsResponse>;
  readonly ProfessionalVerificationDocumentsController_uploadMyDocument: (
    request: ProfessionalVerificationDocumentsController_uploadMyDocumentRequest,
  ) => Promise<ProfessionalVerificationDocumentsController_uploadMyDocumentResponse>;
  readonly ProfessionalVerificationStatusController_getMyStatus: (
    request?: ProfessionalVerificationStatusController_getMyStatusRequest,
  ) => Promise<ProfessionalVerificationStatusController_getMyStatusResponse>;
  readonly ProfessionalVerificationStatusController_listHistory: (
    request: ProfessionalVerificationStatusController_listHistoryRequest,
  ) => Promise<ProfessionalVerificationStatusController_listHistoryResponse>;
  readonly ProfessionalVerificationStatusController_reject: (
    request: ProfessionalVerificationStatusController_rejectRequest,
  ) => Promise<ProfessionalVerificationStatusController_rejectResponse>;
  readonly ProfessionalVerificationStatusController_verify: (
    request: ProfessionalVerificationStatusController_verifyRequest,
  ) => Promise<ProfessionalVerificationStatusController_verifyResponse>;
  readonly SpecialityController_create: (
    request: SpecialityController_createRequest,
  ) => Promise<SpecialityController_createResponse>;
  readonly SpecialityController_findAll: (
    request?: SpecialityController_findAllRequest,
  ) => Promise<SpecialityController_findAllResponse>;
  readonly SpecialityController_findOne: (
    request: SpecialityController_findOneRequest,
  ) => Promise<SpecialityController_findOneResponse>;
  readonly SpecialityController_update: (
    request: SpecialityController_updateRequest,
  ) => Promise<SpecialityController_updateResponse>;
  readonly TwoFactorAuthController_enable2fa: (
    request?: TwoFactorAuthController_enable2faRequest,
  ) => Promise<TwoFactorAuthController_enable2faResponse>;
}

export const createApiClient = (config: ApiClientConfig): ApiClient => {
  const core = createCoreClient(config);

  return {
    AuthController_activateAccount: (request) =>
      core.request<
        AuthController_activateAccountResponse,
        AuthController_activateAccountError
      >(
        {
          operationId: 'AuthController_activateAccount',
          method: 'PATCH',
          path: '/api/auth/users/{user_id}/activate',
        },
        request,
      ),
    AuthController_changePassword: (request) =>
      core.request<
        AuthController_changePasswordResponse,
        AuthController_changePasswordError
      >(
        {
          operationId: 'AuthController_changePassword',
          method: 'POST',
          path: '/api/auth/change-password',
          requestMediaType: 'application/json',
        },
        request,
      ),
    AuthController_forgotPassword: (request) =>
      core.request<
        AuthController_forgotPasswordResponse,
        AuthController_forgotPasswordError
      >(
        {
          operationId: 'AuthController_forgotPassword',
          method: 'POST',
          path: '/api/auth/forgot-password',
          requestMediaType: 'application/json',
        },
        request,
      ),
    AuthController_getProfile: (request = {}) =>
      core.request<
        AuthController_getProfileResponse,
        AuthController_getProfileError
      >(
        {
          operationId: 'AuthController_getProfile',
          method: 'GET',
          path: '/api/auth/me',
        },
        request,
      ),
    AuthController_googleLogin: (request) =>
      core.request<
        AuthController_googleLoginResponse,
        AuthController_googleLoginError
      >(
        {
          operationId: 'AuthController_googleLogin',
          method: 'POST',
          path: '/api/auth/google-login',
          requestMediaType: 'application/json',
        },
        request,
      ),
    AuthController_login: (request) =>
      core.request<AuthController_loginResponse, AuthController_loginError>(
        {
          operationId: 'AuthController_login',
          method: 'POST',
          path: '/api/auth/login',
          requestMediaType: 'application/json',
        },
        request,
      ),
    AuthController_logout: (request) =>
      core.request<AuthController_logoutResponse, AuthController_logoutError>(
        {
          operationId: 'AuthController_logout',
          method: 'POST',
          path: '/api/auth/logout',
          requestMediaType: 'application/json',
        },
        request,
      ),
    AuthController_refreshToken: (request) =>
      core.request<
        AuthController_refreshTokenResponse,
        AuthController_refreshTokenError
      >(
        {
          operationId: 'AuthController_refreshToken',
          method: 'POST',
          path: '/api/auth/refresh',
          requestMediaType: 'application/json',
        },
        request,
      ),
    AuthController_resendVerification: (request) =>
      core.request<
        AuthController_resendVerificationResponse,
        AuthController_resendVerificationError
      >(
        {
          operationId: 'AuthController_resendVerification',
          method: 'POST',
          path: '/api/auth/verify/resend',
          requestMediaType: 'application/json',
        },
        request,
      ),
    AuthController_resetPassword: (request) =>
      core.request<
        AuthController_resetPasswordResponse,
        AuthController_resetPasswordError
      >(
        {
          operationId: 'AuthController_resetPassword',
          method: 'POST',
          path: '/api/auth/reset-password',
          requestMediaType: 'application/json',
        },
        request,
      ),
    AuthController_signup: (request) =>
      core.request<AuthController_signupResponse, AuthController_signupError>(
        {
          operationId: 'AuthController_signup',
          method: 'POST',
          path: '/api/auth/signup',
          requestMediaType: 'application/json',
        },
        request,
      ),
    AuthController_updateProfile: (request) =>
      core.request<
        AuthController_updateProfileResponse,
        AuthController_updateProfileError
      >(
        {
          operationId: 'AuthController_updateProfile',
          method: 'PATCH',
          path: '/api/auth/me',
          requestMediaType: 'application/json',
        },
        request,
      ),
    AuthController_verifySignup: (request) =>
      core.request<
        AuthController_verifySignupResponse,
        AuthController_verifySignupError
      >(
        {
          operationId: 'AuthController_verifySignup',
          method: 'POST',
          path: '/api/auth/verify',
          requestMediaType: 'application/json',
        },
        request,
      ),
    BookingController_cancel: (request) =>
      core.request<
        BookingController_cancelResponse,
        BookingController_cancelError
      >(
        {
          operationId: 'BookingController_cancel',
          method: 'PATCH',
          path: '/api/bookings/{id}/cancel',
        },
        request,
      ),
    BookingController_create: (request) =>
      core.request<
        BookingController_createResponse,
        BookingController_createError
      >(
        {
          operationId: 'BookingController_create',
          method: 'POST',
          path: '/api/bookings',
          requestMediaType: 'application/json',
        },
        request,
      ),
    BookingController_findAll: (request = {}) =>
      core.request<
        BookingController_findAllResponse,
        BookingController_findAllError
      >(
        {
          operationId: 'BookingController_findAll',
          method: 'GET',
          path: '/api/bookings',
        },
        request,
      ),
    BookingController_findOne: (request) =>
      core.request<
        BookingController_findOneResponse,
        BookingController_findOneError
      >(
        {
          operationId: 'BookingController_findOne',
          method: 'GET',
          path: '/api/bookings/{id}',
        },
        request,
      ),
    ChatController_getHistory: (request = {}) =>
      core.request<
        ChatController_getHistoryResponse,
        ChatController_getHistoryError
      >(
        {
          operationId: 'ChatController_getHistory',
          method: 'GET',
          path: '/api/chat/history',
        },
        request,
      ),
    ChatController_sendMessage: (request) =>
      core.request<
        ChatController_sendMessageResponse,
        ChatController_sendMessageError
      >(
        {
          operationId: 'ChatController_sendMessage',
          method: 'POST',
          path: '/api/chat/send',
          requestMediaType: 'application/json',
        },
        request,
      ),
    LaboratoryAuthController_setupAdministrator: (request) =>
      core.request<
        LaboratoryAuthController_setupAdministratorResponse,
        LaboratoryAuthController_setupAdministratorError
      >(
        {
          operationId: 'LaboratoryAuthController_setupAdministrator',
          method: 'POST',
          path: '/api/laboratories/auth/admin-setup',
          requestMediaType: 'application/json',
        },
        request,
      ),
    LaboratoryPostApprovalController_acceptStaffInvitation: (request) =>
      core.request<
        LaboratoryPostApprovalController_acceptStaffInvitationResponse,
        LaboratoryPostApprovalController_acceptStaffInvitationError
      >(
        {
          operationId: 'LaboratoryPostApprovalController_acceptStaffInvitation',
          method: 'POST',
          path: '/api/laboratories/setup/staff/invitations/accept',
          requestMediaType: 'application/json',
        },
        request,
      ),
    LaboratoryPostApprovalController_createTest: (request) =>
      core.request<
        LaboratoryPostApprovalController_createTestResponse,
        LaboratoryPostApprovalController_createTestError
      >(
        {
          operationId: 'LaboratoryPostApprovalController_createTest',
          method: 'POST',
          path: '/api/laboratories/setup/tests',
          requestMediaType: 'application/json',
        },
        request,
      ),
    LaboratoryPostApprovalController_inviteStaff: (request) =>
      core.request<
        LaboratoryPostApprovalController_inviteStaffResponse,
        LaboratoryPostApprovalController_inviteStaffError
      >(
        {
          operationId: 'LaboratoryPostApprovalController_inviteStaff',
          method: 'POST',
          path: '/api/laboratories/setup/staff/invitations',
          requestMediaType: 'application/json',
        },
        request,
      ),
    LaboratoryPostApprovalController_listOperatingHours: (request = {}) =>
      core.request<
        LaboratoryPostApprovalController_listOperatingHoursResponse,
        LaboratoryPostApprovalController_listOperatingHoursError
      >(
        {
          operationId: 'LaboratoryPostApprovalController_listOperatingHours',
          method: 'GET',
          path: '/api/laboratories/setup/operating-hours',
        },
        request,
      ),
    LaboratoryPostApprovalController_listStaff: (request = {}) =>
      core.request<
        LaboratoryPostApprovalController_listStaffResponse,
        LaboratoryPostApprovalController_listStaffError
      >(
        {
          operationId: 'LaboratoryPostApprovalController_listStaff',
          method: 'GET',
          path: '/api/laboratories/setup/staff',
        },
        request,
      ),
    LaboratoryPostApprovalController_listTests: (request = {}) =>
      core.request<
        LaboratoryPostApprovalController_listTestsResponse,
        LaboratoryPostApprovalController_listTestsError
      >(
        {
          operationId: 'LaboratoryPostApprovalController_listTests',
          method: 'GET',
          path: '/api/laboratories/setup/tests',
        },
        request,
      ),
    LaboratoryPostApprovalController_setOperatingHours: (request) =>
      core.request<
        LaboratoryPostApprovalController_setOperatingHoursResponse,
        LaboratoryPostApprovalController_setOperatingHoursError
      >(
        {
          operationId: 'LaboratoryPostApprovalController_setOperatingHours',
          method: 'PUT',
          path: '/api/laboratories/setup/operating-hours',
          requestMediaType: 'application/json',
        },
        request,
      ),
    LaboratoryPostApprovalController_updateTest: (request) =>
      core.request<
        LaboratoryPostApprovalController_updateTestResponse,
        LaboratoryPostApprovalController_updateTestError
      >(
        {
          operationId: 'LaboratoryPostApprovalController_updateTest',
          method: 'PATCH',
          path: '/api/laboratories/setup/tests/{testId}',
          requestMediaType: 'application/json',
        },
        request,
      ),
    LaboratoryVerificationDocumentsController_deleteMyDocument: (request) =>
      core.request<
        LaboratoryVerificationDocumentsController_deleteMyDocumentResponse,
        LaboratoryVerificationDocumentsController_deleteMyDocumentError
      >(
        {
          operationId:
            'LaboratoryVerificationDocumentsController_deleteMyDocument',
          method: 'DELETE',
          path: '/api/laboratories/me/verification-documents/{documentType}',
        },
        request,
      ),
    LaboratoryVerificationDocumentsController_downloadLaboratoryDocument: (
      request,
    ) =>
      core.request<
        LaboratoryVerificationDocumentsController_downloadLaboratoryDocumentResponse,
        LaboratoryVerificationDocumentsController_downloadLaboratoryDocumentError
      >(
        {
          operationId:
            'LaboratoryVerificationDocumentsController_downloadLaboratoryDocument',
          method: 'GET',
          path: '/api/laboratories/{laboratoryId}/verification-documents/{documentType}/download',
        },
        request,
      ),
    LaboratoryVerificationDocumentsController_downloadMyDocument: (request) =>
      core.request<
        LaboratoryVerificationDocumentsController_downloadMyDocumentResponse,
        LaboratoryVerificationDocumentsController_downloadMyDocumentError
      >(
        {
          operationId:
            'LaboratoryVerificationDocumentsController_downloadMyDocument',
          method: 'GET',
          path: '/api/laboratories/me/verification-documents/{documentType}/download',
        },
        request,
      ),
    LaboratoryVerificationDocumentsController_listLaboratoryDocuments: (
      request,
    ) =>
      core.request<
        LaboratoryVerificationDocumentsController_listLaboratoryDocumentsResponse,
        LaboratoryVerificationDocumentsController_listLaboratoryDocumentsError
      >(
        {
          operationId:
            'LaboratoryVerificationDocumentsController_listLaboratoryDocuments',
          method: 'GET',
          path: '/api/laboratories/{laboratoryId}/verification-documents',
        },
        request,
      ),
    LaboratoryVerificationDocumentsController_listMyDocuments: (request = {}) =>
      core.request<
        LaboratoryVerificationDocumentsController_listMyDocumentsResponse,
        LaboratoryVerificationDocumentsController_listMyDocumentsError
      >(
        {
          operationId:
            'LaboratoryVerificationDocumentsController_listMyDocuments',
          method: 'GET',
          path: '/api/laboratories/me/verification-documents',
        },
        request,
      ),
    LaboratoryVerificationDocumentsController_uploadMyDocument: (request) =>
      core.request<
        LaboratoryVerificationDocumentsController_uploadMyDocumentResponse,
        LaboratoryVerificationDocumentsController_uploadMyDocumentError
      >(
        {
          operationId:
            'LaboratoryVerificationDocumentsController_uploadMyDocument',
          method: 'POST',
          path: '/api/laboratories/me/verification-documents/{documentType}',
          requestMediaType: 'multipart/form-data',
        },
        request,
      ),
    LaboratoryVerificationStatusController_approve: (request) =>
      core.request<
        LaboratoryVerificationStatusController_approveResponse,
        LaboratoryVerificationStatusController_approveError
      >(
        {
          operationId: 'LaboratoryVerificationStatusController_approve',
          method: 'POST',
          path: '/api/laboratories/{laboratoryId}/verification-status/approve',
        },
        request,
      ),
    LaboratoryVerificationStatusController_getLaboratoryStatus: (request) =>
      core.request<
        LaboratoryVerificationStatusController_getLaboratoryStatusResponse,
        LaboratoryVerificationStatusController_getLaboratoryStatusError
      >(
        {
          operationId:
            'LaboratoryVerificationStatusController_getLaboratoryStatus',
          method: 'GET',
          path: '/api/laboratories/{laboratoryId}/verification-status',
        },
        request,
      ),
    LaboratoryVerificationStatusController_getMyStatus: (request = {}) =>
      core.request<
        LaboratoryVerificationStatusController_getMyStatusResponse,
        LaboratoryVerificationStatusController_getMyStatusError
      >(
        {
          operationId: 'LaboratoryVerificationStatusController_getMyStatus',
          method: 'GET',
          path: '/api/laboratories/me/verification-status',
        },
        request,
      ),
    LaboratoryVerificationStatusController_listHistory: (request) =>
      core.request<
        LaboratoryVerificationStatusController_listHistoryResponse,
        LaboratoryVerificationStatusController_listHistoryError
      >(
        {
          operationId: 'LaboratoryVerificationStatusController_listHistory',
          method: 'GET',
          path: '/api/laboratories/{laboratoryId}/verification-status/history',
        },
        request,
      ),
    LaboratoryVerificationStatusController_markUnderReview: (request) =>
      core.request<
        LaboratoryVerificationStatusController_markUnderReviewResponse,
        LaboratoryVerificationStatusController_markUnderReviewError
      >(
        {
          operationId: 'LaboratoryVerificationStatusController_markUnderReview',
          method: 'POST',
          path: '/api/laboratories/{laboratoryId}/verification-status/under-review',
        },
        request,
      ),
    LaboratoryVerificationStatusController_reject: (request) =>
      core.request<
        LaboratoryVerificationStatusController_rejectResponse,
        LaboratoryVerificationStatusController_rejectError
      >(
        {
          operationId: 'LaboratoryVerificationStatusController_reject',
          method: 'POST',
          path: '/api/laboratories/{laboratoryId}/verification-status/reject',
          requestMediaType: 'application/json',
        },
        request,
      ),
    LaboratoryVerificationStatusController_submitMyVerification: (
      request = {},
    ) =>
      core.request<
        LaboratoryVerificationStatusController_submitMyVerificationResponse,
        LaboratoryVerificationStatusController_submitMyVerificationError
      >(
        {
          operationId:
            'LaboratoryVerificationStatusController_submitMyVerification',
          method: 'POST',
          path: '/api/laboratories/me/verification-status/submit',
        },
        request,
      ),
    OrganizationController_approve: (request) =>
      core.request<
        OrganizationController_approveResponse,
        OrganizationController_approveError
      >(
        {
          operationId: 'OrganizationController_approve',
          method: 'POST',
          path: '/api/organizations/onboarding/{organizationId}/status/approve',
        },
        request,
      ),
    OrganizationController_deleteMine: (request) =>
      core.request<
        OrganizationController_deleteMineResponse,
        OrganizationController_deleteMineError
      >(
        {
          operationId: 'OrganizationController_deleteMine',
          method: 'DELETE',
          path: '/api/organizations/onboarding/me/documents/{documentType}',
        },
        request,
      ),
    OrganizationController_downloadForReview: (request) =>
      core.request<
        OrganizationController_downloadForReviewResponse,
        OrganizationController_downloadForReviewError
      >(
        {
          operationId: 'OrganizationController_downloadForReview',
          method: 'GET',
          path: '/api/organizations/onboarding/{organizationId}/documents/{documentType}/download',
        },
        request,
      ),
    OrganizationController_downloadMine: (request) =>
      core.request<
        OrganizationController_downloadMineResponse,
        OrganizationController_downloadMineError
      >(
        {
          operationId: 'OrganizationController_downloadMine',
          method: 'GET',
          path: '/api/organizations/onboarding/me/documents/{documentType}/download',
        },
        request,
      ),
    OrganizationController_getMyStatus: (request = {}) =>
      core.request<
        OrganizationController_getMyStatusResponse,
        OrganizationController_getMyStatusError
      >(
        {
          operationId: 'OrganizationController_getMyStatus',
          method: 'GET',
          path: '/api/organizations/onboarding/me/status',
        },
        request,
      ),
    OrganizationController_getStatus: (request) =>
      core.request<
        OrganizationController_getStatusResponse,
        OrganizationController_getStatusError
      >(
        {
          operationId: 'OrganizationController_getStatus',
          method: 'GET',
          path: '/api/organizations/onboarding/{organizationId}/status',
        },
        request,
      ),
    OrganizationController_listApplications: (request = {}) =>
      core.request<
        OrganizationController_listApplicationsResponse,
        OrganizationController_listApplicationsError
      >(
        {
          operationId: 'OrganizationController_listApplications',
          method: 'GET',
          path: '/api/organizations/onboarding/review/applications',
        },
        request,
      ),
    OrganizationController_listForReview: (request) =>
      core.request<
        OrganizationController_listForReviewResponse,
        OrganizationController_listForReviewError
      >(
        {
          operationId: 'OrganizationController_listForReview',
          method: 'GET',
          path: '/api/organizations/onboarding/{organizationId}/documents',
        },
        request,
      ),
    OrganizationController_listHistory: (request) =>
      core.request<
        OrganizationController_listHistoryResponse,
        OrganizationController_listHistoryError
      >(
        {
          operationId: 'OrganizationController_listHistory',
          method: 'GET',
          path: '/api/organizations/onboarding/{organizationId}/status/history',
        },
        request,
      ),
    OrganizationController_listMine: (request = {}) =>
      core.request<
        OrganizationController_listMineResponse,
        OrganizationController_listMineError
      >(
        {
          operationId: 'OrganizationController_listMine',
          method: 'GET',
          path: '/api/organizations/onboarding/me/documents',
        },
        request,
      ),
    OrganizationController_markUnderReview: (request) =>
      core.request<
        OrganizationController_markUnderReviewResponse,
        OrganizationController_markUnderReviewError
      >(
        {
          operationId: 'OrganizationController_markUnderReview',
          method: 'POST',
          path: '/api/organizations/onboarding/{organizationId}/status/under-review',
        },
        request,
      ),
    OrganizationController_reject: (request) =>
      core.request<
        OrganizationController_rejectResponse,
        OrganizationController_rejectError
      >(
        {
          operationId: 'OrganizationController_reject',
          method: 'POST',
          path: '/api/organizations/onboarding/{organizationId}/status/reject',
          requestMediaType: 'application/json',
        },
        request,
      ),
    OrganizationController_setup: (request) =>
      core.request<
        OrganizationController_setupResponse,
        OrganizationController_setupError
      >(
        {
          operationId: 'OrganizationController_setup',
          method: 'POST',
          path: '/api/organizations/onboarding/admin-setup',
          requestMediaType: 'application/json',
        },
        request,
      ),
    OrganizationController_submitMine: (request = {}) =>
      core.request<
        OrganizationController_submitMineResponse,
        OrganizationController_submitMineError
      >(
        {
          operationId: 'OrganizationController_submitMine',
          method: 'POST',
          path: '/api/organizations/onboarding/me/submit',
        },
        request,
      ),
    OrganizationController_uploadMine: (request) =>
      core.request<
        OrganizationController_uploadMineResponse,
        OrganizationController_uploadMineError
      >(
        {
          operationId: 'OrganizationController_uploadMine',
          method: 'POST',
          path: '/api/organizations/onboarding/me/documents/{documentType}',
          requestMediaType: 'multipart/form-data',
        },
        request,
      ),
    PharmacyController_register: (request) =>
      core.request<
        PharmacyController_registerResponse,
        PharmacyController_registerError
      >(
        {
          operationId: 'PharmacyController_register',
          method: 'POST',
          path: '/api/pharmacies/register',
          requestMediaType: 'application/json',
        },
        request,
      ),
    ProfessionalController_acceptMyBooking: (request) =>
      core.request<
        ProfessionalController_acceptMyBookingResponse,
        ProfessionalController_acceptMyBookingError
      >(
        {
          operationId: 'ProfessionalController_acceptMyBooking',
          method: 'PATCH',
          path: '/api/professionals/me/bookings/{bookingId}/accept',
        },
        request,
      ),
    ProfessionalController_createAvailabilities: (request) =>
      core.request<
        ProfessionalController_createAvailabilitiesResponse,
        ProfessionalController_createAvailabilitiesError
      >(
        {
          operationId: 'ProfessionalController_createAvailabilities',
          method: 'POST',
          path: '/api/professionals/{id}/availabilities',
          requestMediaType: 'application/json',
        },
        request,
      ),
    ProfessionalController_createMyAvailabilities: (request) =>
      core.request<
        ProfessionalController_createMyAvailabilitiesResponse,
        ProfessionalController_createMyAvailabilitiesError
      >(
        {
          operationId: 'ProfessionalController_createMyAvailabilities',
          method: 'POST',
          path: '/api/professionals/me/availabilities',
          requestMediaType: 'application/json',
        },
        request,
      ),
    ProfessionalController_createMyPatientNote: (request) =>
      core.request<
        ProfessionalController_createMyPatientNoteResponse,
        ProfessionalController_createMyPatientNoteError
      >(
        {
          operationId: 'ProfessionalController_createMyPatientNote',
          method: 'POST',
          path: '/api/professionals/me/patients/{patientId}/notes',
          requestMediaType: 'application/json',
        },
        request,
      ),
    ProfessionalController_createProfessional: (request) =>
      core.request<
        ProfessionalController_createProfessionalResponse,
        ProfessionalController_createProfessionalError
      >(
        {
          operationId: 'ProfessionalController_createProfessional',
          method: 'POST',
          path: '/api/professionals',
          requestMediaType: 'application/json',
        },
        request,
      ),
    ProfessionalController_createReview: (request) =>
      core.request<
        ProfessionalController_createReviewResponse,
        ProfessionalController_createReviewError
      >(
        {
          operationId: 'ProfessionalController_createReview',
          method: 'POST',
          path: '/api/professionals/{id}/reviews',
          requestMediaType: 'application/json',
        },
        request,
      ),
    ProfessionalController_findBySpeciality: (request) =>
      core.request<
        ProfessionalController_findBySpecialityResponse,
        ProfessionalController_findBySpecialityError
      >(
        {
          operationId: 'ProfessionalController_findBySpeciality',
          method: 'GET',
          path: '/api/professionals',
        },
        request,
      ),
    ProfessionalController_findMe: (request = {}) =>
      core.request<
        ProfessionalController_findMeResponse,
        ProfessionalController_findMeError
      >(
        {
          operationId: 'ProfessionalController_findMe',
          method: 'GET',
          path: '/api/professionals/me',
        },
        request,
      ),
    ProfessionalController_findOne: (request) =>
      core.request<
        ProfessionalController_findOneResponse,
        ProfessionalController_findOneError
      >(
        {
          operationId: 'ProfessionalController_findOne',
          method: 'GET',
          path: '/api/professionals/{id}',
        },
        request,
      ),
    ProfessionalController_getMyDashboard: (request = {}) =>
      core.request<
        ProfessionalController_getMyDashboardResponse,
        ProfessionalController_getMyDashboardError
      >(
        {
          operationId: 'ProfessionalController_getMyDashboard',
          method: 'GET',
          path: '/api/professionals/me/dashboard',
        },
        request,
      ),
    ProfessionalController_getMyPatientConsultations: (request) =>
      core.request<
        ProfessionalController_getMyPatientConsultationsResponse,
        ProfessionalController_getMyPatientConsultationsError
      >(
        {
          operationId: 'ProfessionalController_getMyPatientConsultations',
          method: 'GET',
          path: '/api/professionals/me/patients/{patientId}/consultations',
        },
        request,
      ),
    ProfessionalController_getMyPatientNotes: (request) =>
      core.request<
        ProfessionalController_getMyPatientNotesResponse,
        ProfessionalController_getMyPatientNotesError
      >(
        {
          operationId: 'ProfessionalController_getMyPatientNotes',
          method: 'GET',
          path: '/api/professionals/me/patients/{patientId}/notes',
        },
        request,
      ),
    ProfessionalController_getMyPatientProfile: (request) =>
      core.request<
        ProfessionalController_getMyPatientProfileResponse,
        ProfessionalController_getMyPatientProfileError
      >(
        {
          operationId: 'ProfessionalController_getMyPatientProfile',
          method: 'GET',
          path: '/api/professionals/me/patients/{patientId}',
        },
        request,
      ),
    ProfessionalController_getMyPatients: (request = {}) =>
      core.request<
        ProfessionalController_getMyPatientsResponse,
        ProfessionalController_getMyPatientsError
      >(
        {
          operationId: 'ProfessionalController_getMyPatients',
          method: 'GET',
          path: '/api/professionals/me/patients',
        },
        request,
      ),
    ProfessionalController_getReviews: (request) =>
      core.request<
        ProfessionalController_getReviewsResponse,
        ProfessionalController_getReviewsError
      >(
        {
          operationId: 'ProfessionalController_getReviews',
          method: 'GET',
          path: '/api/professionals/{id}/reviews',
        },
        request,
      ),
    ProfessionalController_rejectMyBooking: (request) =>
      core.request<
        ProfessionalController_rejectMyBookingResponse,
        ProfessionalController_rejectMyBookingError
      >(
        {
          operationId: 'ProfessionalController_rejectMyBooking',
          method: 'PATCH',
          path: '/api/professionals/me/bookings/{bookingId}/reject',
        },
        request,
      ),
    ProfessionalController_updateMyPatientNote: (request) =>
      core.request<
        ProfessionalController_updateMyPatientNoteResponse,
        ProfessionalController_updateMyPatientNoteError
      >(
        {
          operationId: 'ProfessionalController_updateMyPatientNote',
          method: 'PATCH',
          path: '/api/professionals/me/patients/{patientId}/notes/{noteId}',
          requestMediaType: 'application/json',
        },
        request,
      ),
    ProfessionalController_updateProfessional: (request) =>
      core.request<
        ProfessionalController_updateProfessionalResponse,
        ProfessionalController_updateProfessionalError
      >(
        {
          operationId: 'ProfessionalController_updateProfessional',
          method: 'PATCH',
          path: '/api/professionals/{id}',
          requestMediaType: 'application/json',
        },
        request,
      ),
    ProfessionalController_upsertMeProfile: (request) =>
      core.request<
        ProfessionalController_upsertMeProfileResponse,
        ProfessionalController_upsertMeProfileError
      >(
        {
          operationId: 'ProfessionalController_upsertMeProfile',
          method: 'PUT',
          path: '/api/professionals/me/profile',
          requestMediaType: 'application/json',
        },
        request,
      ),
    ProfessionalVerificationDocumentsController_deleteMyDocument: (request) =>
      core.request<
        ProfessionalVerificationDocumentsController_deleteMyDocumentResponse,
        ProfessionalVerificationDocumentsController_deleteMyDocumentError
      >(
        {
          operationId:
            'ProfessionalVerificationDocumentsController_deleteMyDocument',
          method: 'DELETE',
          path: '/api/professionals/me/verification-documents/{documentType}',
        },
        request,
      ),
    ProfessionalVerificationDocumentsController_downloadMyDocument: (request) =>
      core.request<
        ProfessionalVerificationDocumentsController_downloadMyDocumentResponse,
        ProfessionalVerificationDocumentsController_downloadMyDocumentError
      >(
        {
          operationId:
            'ProfessionalVerificationDocumentsController_downloadMyDocument',
          method: 'GET',
          path: '/api/professionals/me/verification-documents/{documentType}/download',
        },
        request,
      ),
    ProfessionalVerificationDocumentsController_downloadProfessionalDocument: (
      request,
    ) =>
      core.request<
        ProfessionalVerificationDocumentsController_downloadProfessionalDocumentResponse,
        ProfessionalVerificationDocumentsController_downloadProfessionalDocumentError
      >(
        {
          operationId:
            'ProfessionalVerificationDocumentsController_downloadProfessionalDocument',
          method: 'GET',
          path: '/api/professionals/{professionalId}/verification-documents/{documentType}/download',
        },
        request,
      ),
    ProfessionalVerificationDocumentsController_listMyDocuments: (
      request = {},
    ) =>
      core.request<
        ProfessionalVerificationDocumentsController_listMyDocumentsResponse,
        ProfessionalVerificationDocumentsController_listMyDocumentsError
      >(
        {
          operationId:
            'ProfessionalVerificationDocumentsController_listMyDocuments',
          method: 'GET',
          path: '/api/professionals/me/verification-documents',
        },
        request,
      ),
    ProfessionalVerificationDocumentsController_listProfessionalDocuments: (
      request,
    ) =>
      core.request<
        ProfessionalVerificationDocumentsController_listProfessionalDocumentsResponse,
        ProfessionalVerificationDocumentsController_listProfessionalDocumentsError
      >(
        {
          operationId:
            'ProfessionalVerificationDocumentsController_listProfessionalDocuments',
          method: 'GET',
          path: '/api/professionals/{professionalId}/verification-documents',
        },
        request,
      ),
    ProfessionalVerificationDocumentsController_uploadMyDocument: (request) =>
      core.request<
        ProfessionalVerificationDocumentsController_uploadMyDocumentResponse,
        ProfessionalVerificationDocumentsController_uploadMyDocumentError
      >(
        {
          operationId:
            'ProfessionalVerificationDocumentsController_uploadMyDocument',
          method: 'POST',
          path: '/api/professionals/me/verification-documents/{documentType}',
          requestMediaType: 'multipart/form-data',
        },
        request,
      ),
    ProfessionalVerificationStatusController_getMyStatus: (request = {}) =>
      core.request<
        ProfessionalVerificationStatusController_getMyStatusResponse,
        ProfessionalVerificationStatusController_getMyStatusError
      >(
        {
          operationId: 'ProfessionalVerificationStatusController_getMyStatus',
          method: 'GET',
          path: '/api/professionals/me/verification-status',
        },
        request,
      ),
    ProfessionalVerificationStatusController_listHistory: (request) =>
      core.request<
        ProfessionalVerificationStatusController_listHistoryResponse,
        ProfessionalVerificationStatusController_listHistoryError
      >(
        {
          operationId: 'ProfessionalVerificationStatusController_listHistory',
          method: 'GET',
          path: '/api/professionals/{professionalId}/verification-status/history',
        },
        request,
      ),
    ProfessionalVerificationStatusController_reject: (request) =>
      core.request<
        ProfessionalVerificationStatusController_rejectResponse,
        ProfessionalVerificationStatusController_rejectError
      >(
        {
          operationId: 'ProfessionalVerificationStatusController_reject',
          method: 'POST',
          path: '/api/professionals/{professionalId}/reject',
          requestMediaType: 'application/json',
        },
        request,
      ),
    ProfessionalVerificationStatusController_verify: (request) =>
      core.request<
        ProfessionalVerificationStatusController_verifyResponse,
        ProfessionalVerificationStatusController_verifyError
      >(
        {
          operationId: 'ProfessionalVerificationStatusController_verify',
          method: 'POST',
          path: '/api/professionals/{professionalId}/verify',
        },
        request,
      ),
    SpecialityController_create: (request) =>
      core.request<
        SpecialityController_createResponse,
        SpecialityController_createError
      >(
        {
          operationId: 'SpecialityController_create',
          method: 'POST',
          path: '/api/specialities',
          requestMediaType: 'application/json',
        },
        request,
      ),
    SpecialityController_findAll: (request = {}) =>
      core.request<
        SpecialityController_findAllResponse,
        SpecialityController_findAllError
      >(
        {
          operationId: 'SpecialityController_findAll',
          method: 'GET',
          path: '/api/specialities',
        },
        request,
      ),
    SpecialityController_findOne: (request) =>
      core.request<
        SpecialityController_findOneResponse,
        SpecialityController_findOneError
      >(
        {
          operationId: 'SpecialityController_findOne',
          method: 'GET',
          path: '/api/specialities/{id}',
        },
        request,
      ),
    SpecialityController_update: (request) =>
      core.request<
        SpecialityController_updateResponse,
        SpecialityController_updateError
      >(
        {
          operationId: 'SpecialityController_update',
          method: 'PATCH',
          path: '/api/specialities/{id}',
          requestMediaType: 'application/json',
        },
        request,
      ),
    TwoFactorAuthController_enable2fa: (request = {}) =>
      core.request<
        TwoFactorAuthController_enable2faResponse,
        TwoFactorAuthController_enable2faError
      >(
        {
          operationId: 'TwoFactorAuthController_enable2fa',
          method: 'POST',
          path: '/api/auth/2fa/enable',
        },
        request,
      ),
  };
};
