import { Request } from 'express';

export interface IAuthUser {
  id: string;
  userId: string;
  email: string;
  roles: string[];
}

export interface IRequestWithUser extends Request {
  user: IAuthUser;
}

export * from './base-response.interface';
export * from './multer.types';
