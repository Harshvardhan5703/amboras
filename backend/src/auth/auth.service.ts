import { Injectable, UnauthorizedException } from '@nestjs/common';                           
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Store } from './store.entity';

export interface JwtPayload {
  sub: string;
  store_id: string;
  name: string;
}

export interface LoginResponse {
  access_token: string;
  store_id: string;
  name: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponse> {
    const store = await this.storeRepo.findOne({
      where: { ownerEmail: email },
    });

    if (!store) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, store.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = {
      sub: store.id,
      store_id: store.id,
      name: store.name,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      access_token: accessToken,
      store_id: store.id,
      name: store.name,
    };
  }
}
