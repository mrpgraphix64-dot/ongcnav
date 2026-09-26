import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: any;
  let passwordResetService: any;

  beforeEach(async () => {
    service = {
      login: jest.fn().mockResolvedValue({ accessToken: 'tok', user: { id: '1', role: 'GATE_OPERATOR' } }),
    };

    passwordResetService = {
      forgotPassword: jest.fn().mockResolvedValue({
        success: true,
        message: 'If an account exists for this email, a password reset OTP has been sent.',
      }),
      resendResetOtp: jest.fn().mockResolvedValue({
        success: true,
        message: 'If an account exists for this email, a password reset OTP has been sent.',
      }),
      verifyResetOtp: jest.fn().mockResolvedValue({
        success: true,
        resetToken: 'mock.reset.token',
        message: 'OTP verified successfully.',
      }),
      resetPassword: jest.fn().mockResolvedValue({
        success: true,
        message: 'Password reset successfully. You can now sign in.',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: service },
        { provide: PasswordResetService, useValue: passwordResetService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('has no demo login route — the /auth/demo endpoint has been removed entirely', () => {
    expect((controller as any).demoLogin).toBeUndefined();
  });

  it('login sets an httpOnly cookie and returns the auth result', async () => {
    const res = { cookie: jest.fn() } as any;
    const result = await controller.login({ identifier: 'a@b.com', password: 'x' } as any, res);

    expect(result.accessToken).toBe('tok');
    expect(res.cookie).toHaveBeenCalledWith(
      'ongc_auth_session',
      'tok',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
    expect(res.cookie).toHaveBeenCalledWith(
      'admin_token',
      'tok',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
  });

  it('logout clears the auth session and admin_token cookies', async () => {
    const res = { clearCookie: jest.fn() } as any;
    const result = await controller.logout(res);

    expect(res.clearCookie).toHaveBeenCalledWith('ongc_auth_session');
    expect(res.clearCookie).toHaveBeenCalledWith('admin_token');
    expect(result.success).toBe(true);
  });

  it('delegates forgotPassword to PasswordResetService with IP extraction', async () => {
    const req = { headers: { 'x-forwarded-for': '192.168.1.100' }, ip: '127.0.0.1' } as any;
    const result = await controller.forgotPassword({ email: 'admin@ongc.co.in' }, req);

    expect(passwordResetService.forgotPassword).toHaveBeenCalledWith(
      { email: 'admin@ongc.co.in' },
      '192.168.1.100',
    );
    expect(result.success).toBe(true);
  });

  it('delegates resendResetOtp to PasswordResetService with IP extraction', async () => {
    const req = { headers: {}, ip: '10.0.0.1' } as any;
    const result = await controller.resendResetOtp({ email: 'admin@ongc.co.in' }, req);

    expect(passwordResetService.resendResetOtp).toHaveBeenCalledWith(
      { email: 'admin@ongc.co.in' },
      '10.0.0.1',
    );
    expect(result.success).toBe(true);
  });

  it('delegates verifyResetOtp to PasswordResetService', async () => {
    const result = await controller.verifyResetOtp({ email: 'admin@ongc.co.in', otp: '123456' });

    expect(passwordResetService.verifyResetOtp).toHaveBeenCalledWith({
      email: 'admin@ongc.co.in',
      otp: '123456',
    });
    expect(result.resetToken).toBe('mock.reset.token');
  });

  it('delegates resetPassword to PasswordResetService', async () => {
    const result = await controller.resetPassword({
      resetToken: 'mock.reset.token',
      newPassword: 'NewPassword@2026',
      confirmPassword: 'NewPassword@2026',
    });

    expect(passwordResetService.resetPassword).toHaveBeenCalledWith({
      resetToken: 'mock.reset.token',
      newPassword: 'NewPassword@2026',
      confirmPassword: 'NewPassword@2026',
    });
    expect(result.success).toBe(true);
  });
});
