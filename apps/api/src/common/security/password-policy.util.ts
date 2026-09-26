import { BadRequestException } from '@nestjs/common';

export const MIN_PASSWORD_LENGTH = 8;

export function validatePasswordPolicy(password: string, confirmPassword?: string): void {
  if (!password || typeof password !== 'string') {
    throw new BadRequestException('Password is required.');
  }

  if (password.trim().length === 0) {
    throw new BadRequestException('Password cannot be empty or only whitespace.');
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new BadRequestException(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
    );
  }

  if (password.startsWith(' ') || password.endsWith(' ')) {
    throw new BadRequestException('Password cannot have leading or trailing whitespace.');
  }

  if (confirmPassword !== undefined && password !== confirmPassword) {
    throw new BadRequestException('Passwords do not match. Please verify your confirmation.');
  }
}
