import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('profile_photos')
export class ProfilePhoto {
  @PrimaryColumn({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar' })
  object_key: string;

  @Column({ type: 'varchar' })
  bucket: string;

  @Column({ type: 'varchar' })
  version_id: string;

  @Column({ type: 'varchar' })
  content_type: string;

  @Column({ type: 'integer' })
  byte_size: number;

  @Column({ type: 'integer' })
  width: number;

  @Column({ type: 'integer' })
  height: number;

  @Column({ type: 'char', length: 64 })
  sha256: string;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}
