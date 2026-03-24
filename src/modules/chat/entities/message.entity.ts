import { Entity, Column, ManyToOne } from 'typeorm';

import { BaseEntity } from '../../../entities/base-entity';

import { Chat } from './chat.entity';

@Entity('messages')
export class Message extends BaseEntity {
  @ManyToOne(() => Chat, (chat) => chat.id)
  chat: Chat;

  @Column()
  sender: string; // 'user' or 'ai'

  @Column('text')
  content: string;
}
