import { Body, CanActivate, ConflictException, Controller, ExecutionContext, Injectable, Post, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ApiProperty } from '@nestjs/swagger';
import { hash, verify } from 'argon2';
import { IsEmail, IsString, MinLength } from 'class-validator';
import type { Request } from 'express';
import { PrismaService } from './prisma.service';

class RegisterDto { @ApiProperty() @IsEmail() email!:string; @ApiProperty() @IsString() @MinLength(8) password!:string; @ApiProperty() @IsString() @MinLength(2) displayName!:string }
class LoginDto { @ApiProperty() @IsEmail() email!:string; @ApiProperty() @IsString() password!:string }
export type AuthRequest = Request & { user:{ sub:string; email:string } };

@Injectable()
export class AuthService {
  constructor(private readonly db:PrismaService, private readonly jwt:JwtService) {}
  async register(dto:RegisterDto) {
    const email=dto.email.trim().toLowerCase();
    if(await this.db.user.findUnique({where:{email}})) throw new ConflictException('Cet email est déjà utilisé');
    const user=await this.db.user.create({data:{email,displayName:dto.displayName.trim(),passwordHash:await hash(dto.password)}});
    return this.token(user.id,user.email,user.displayName);
  }
  async login(dto:LoginDto) {
    const user=await this.db.user.findUnique({where:{email:dto.email.trim().toLowerCase()}});
    if(!user || !(await verify(user.passwordHash,dto.password))) throw new UnauthorizedException('Identifiants invalides');
    return this.token(user.id,user.email,user.displayName);
  }
  private token(id:string,email:string,displayName:string) { return {accessToken:this.jwt.sign({sub:id,email}),user:{id,email,displayName}}; }
}
@Controller('auth')
export class AuthController { constructor(private readonly auth:AuthService){} @Post('register') register(@Body() dto:RegisterDto){return this.auth.register(dto)} @Post('login') login(@Body() dto:LoginDto){return this.auth.login(dto)} }

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly jwt:JwtService){}
  async canActivate(context:ExecutionContext){const req=context.switchToHttp().getRequest<AuthRequest>(); const raw=req.headers.authorization; if(!raw?.startsWith('Bearer ')) throw new UnauthorizedException(); try{req.user=await this.jwt.verifyAsync(raw.slice(7));return true}catch{throw new UnauthorizedException('Session expirée')}}
}
