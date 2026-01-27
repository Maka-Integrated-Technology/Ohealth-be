//system messages object
// This object contains constant strings used throughout the system for various messages.
//example: SYS_MSG.ACCOUNT_CREATED will return "ACCOUNT_CREATED"
//example usage in your controller or service:
// import { LOGIN_SUCCESS } from 'src/constants/system.messages';
// message:LOGIN_SUCCESS;

//NOTE: you can modify the messages as per your requirements.You can also add new messages as needed.

//⚠️ WARNING: Do not change the variable names as they are used throughout the system. check before modifying or adding new messages.

// Authentication
export const LOGIN_SUCCESS = 'login success';
export const LOGIN_FAILED = 'login failed';
export const INVALID_CREDENTIALS = 'invalid credentials';
export const TOKEN_EXPIRED = 'token expired';
export const TOKEN_INVALID = 'token invalid';
export const TOKEN_REFRESH_SUCCESS = 'Tokens refresh successful';
export const LOGOUT_SUCCESS = 'logout success';
