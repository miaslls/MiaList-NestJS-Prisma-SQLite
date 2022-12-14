import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { UserRepository } from './user.repository';

import { Exception } from 'src/utils/exceptions/Exception';
import { ExceptionType } from 'src/utils/exceptions/exception.helper';

import { User } from './entities/user.entity';
import { UserDto } from './dto/create-user.dto';
import { PartialUserDto } from './dto/update-user.dto';
import { UserResponse } from './UserResponse';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  // 📌 CREATE

  async create(dto: UserDto): Promise<User> {
    if ('role' in dto) throw new Exception(ExceptionType.FORBIDDEN);

    const duplicateUsername = await this.userRepository.findOne(dto.username);
    if (duplicateUsername) {
      throw new Exception(ExceptionType.DATA_INVALID, 'DUPLICATE USERNAME');
    }

    if (dto.password.length < 8) throw new Exception(ExceptionType.DATA_INVALID, 'PASSWORD TOO SHORT');

    const data: Prisma.UserCreateInput = { ...dto };

    data.password = await bcrypt.hash(dto.password, 10);
    const user = await this.userRepository.create(data);

    delete user.password;
    return user;
  }

  // 📌 READ

  async findAll(role: string): Promise<UserResponse[]> {
    if (role !== 'admin') throw new Exception(ExceptionType.FORBIDDEN);

    const users = await this.userRepository.findAll();

    return users.map((user) => new UserResponse(user));
  }

  async findOne(loggedUser: User, username: string): Promise<UserResponse> {
    if (loggedUser.role !== 'admin' && loggedUser.username !== username) {
      throw new Exception(ExceptionType.FORBIDDEN);
    }

    const user = await this.userRepository.findOne(username);
    if (!user) {
      throw new Exception(ExceptionType.RESOURCE_NOT_FOUND, 'USER NOT FOUND');
    }

    return new UserResponse(user);
  }

  // 📌 UPDATE

  async update(loggedUser: User, username: string, dto: PartialUserDto): Promise<User> {
    await this.findOne(loggedUser, username);

    if (loggedUser.role !== 'admin' && 'role' in dto) throw new Exception(ExceptionType.FORBIDDEN);

    if ('username' in dto && dto.username !== username) {
      const duplicateUsername = await this.userRepository.findOne(dto.username);
      if (duplicateUsername) {
        throw new Exception(ExceptionType.DATA_INVALID, 'DUPLICATE USERNAME');
      }
    }

    if ('password' in dto) {
      if (dto.password.length < 8) {
        throw new Exception(ExceptionType.DATA_INVALID, 'PASSWORD TOO SHORT');
      }

      dto.password = await bcrypt.hash(dto.password, 10);
    }

    const data: Prisma.UserUpdateInput = { ...dto };
    const user = await this.userRepository.update(username, data);

    delete user.password;
    return user;
  }

  // 📌 DELETE

  async remove(loggedUser: User, username: string): Promise<User> {
    await this.findOne(loggedUser, username);
    const user = await this.userRepository.remove(username);

    delete user.password;
    return user;
  }
}
