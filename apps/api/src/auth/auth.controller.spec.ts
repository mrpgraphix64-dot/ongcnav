import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let service: any;

  beforeEach(async () => {
    service = {
      login: jest.fn().mockResolvedValue({ accessToken: 'tok', user: { id: '1', role: 'GATE_OPERATOR' } }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: service }],
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
      'admin_token',
      'tok',
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
  });

  it('logout clears the admin_token cookie', async () => {
    const res = { clearCookie: jest.fn() } as any;
    const result = await controller.logout(res);

    expect(res.clearCookie).toHaveBeenCalledWith('admin_token');
    expect(result.success).toBe(true);
  });
});
