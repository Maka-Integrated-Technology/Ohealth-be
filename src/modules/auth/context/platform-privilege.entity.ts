import { Column, Entity, Index, Unique } from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';

import { PlatformPrivilege } from './platform-privilege.enum';

@Unique('UQ_platform_privileges_user_privilege', ['user_id', 'privilege'])
@Index('IDX_platform_privileges_user_id', ['user_id'])
@Entity('platform_privileges')
export class PlatformPrivilegeEntity extends BaseEntity {
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar' })
  privilege: PlatformPrivilege;
}
