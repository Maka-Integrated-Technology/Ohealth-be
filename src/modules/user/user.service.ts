import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';

import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  findByEmail(email: string) {
    return this.userRepository.findOne({ where: { email } });
  }

  findById(id: string) {
    return this.userRepository.findOne({ where: { id } });
  }

  findByResetToken(token: string) {
    return this.userRepository.findOne({
      where: { reset_token: token },
    });
  }

  async create(payload: DeepPartial<User>) {
    const user = this.userRepository.create(payload);
    return this.userRepository.save(user);
  }

  save(user: User) {
    return this.userRepository.save(user);
  }
}
