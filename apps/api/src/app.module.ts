import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController, AuthService, JwtGuard } from './auth';
import { GameController, GameService } from './game';
import { HealthController } from './health';
import { PrismaService } from './prisma.service';

@Module({
  imports:[JwtModule.register({ global:true, secret:process.env.JWT_SECRET ?? 'development-only-secret-change-me', signOptions:{ expiresIn:'15m' } })],
  controllers:[AuthController, GameController, HealthController],
  providers:[PrismaService, AuthService, JwtGuard, GameService]
})
export class AppModule {}
