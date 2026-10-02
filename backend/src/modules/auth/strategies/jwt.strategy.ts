import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

const jwtSecret = process.env.JWT_SECRET;

if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required');
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: jwtSecret,
        });
    }

    async validate(payload: any) {
        return {
            id: payload.sub,
            email: payload.email,
            role: payload.role,
            organizationId: payload.organizationId || null,
            plan: payload.plan || null,
        };
    }
}
