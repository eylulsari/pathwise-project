import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  // 32 random bytes as hex. Bounded so an oversized string is rejected before
  // it reaches a hash and a query.
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token: string;

  // Same rules as registration — a reset must not be a way around them.
  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt truncates beyond 72 bytes
  password: string;
}
