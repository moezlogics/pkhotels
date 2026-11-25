import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Like JwtAuthGuard, but lets visitors without a session through (req.user stays empty). */
@Injectable()
export class OptionalJwtGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      // no or bad token: carry on as a guest
    }
    return true;
  }

  handleRequest(_err: any, user: any) {
    return user || null;
  }
}
