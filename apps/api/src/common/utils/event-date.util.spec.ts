import { getTodayIST, resolveActiveEventDate } from './event-date.util';

describe('event-date.util', () => {
  describe('getTodayIST', () => {
    it('returns a valid YYYY-MM-DD date string in Asia/Kolkata', () => {
      const date = getTodayIST();
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('resolveActiveEventDate', () => {
    it('returns modern event_control.active_event_date when present', async () => {
      const mockPrisma = {
        setting: {
          findFirst: jest.fn().mockImplementation(({ where }) => {
            if (where?.key === 'event_control.active_event_date') {
              return Promise.resolve({ key: 'event_control.active_event_date', value: '2026-10-15' });
            }
            if (where?.key === 'active_event_date') {
              return Promise.resolve({ key: 'active_event_date', value: '2026-10-11' });
            }
            return Promise.resolve(null);
          }),
        },
      };

      const date = await resolveActiveEventDate(mockPrisma);
      expect(date).toBe('2026-10-15');
    });

    it('falls back to legacy active_event_date when modern key is absent', async () => {
      const mockPrisma = {
        setting: {
          findFirst: jest.fn().mockImplementation(({ where }) => {
            if (where?.key === 'event_control.active_event_date') {
              return Promise.resolve(null);
            }
            if (where?.key === 'active_event_date') {
              return Promise.resolve({ key: 'active_event_date', value: '2026-10-12' });
            }
            return Promise.resolve(null);
          }),
        },
      };

      const date = await resolveActiveEventDate(mockPrisma);
      expect(date).toBe('2026-10-12');
    });

    it('falls back to getTodayIST when neither setting is present', async () => {
      const mockPrisma = {
        setting: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      };

      const date = await resolveActiveEventDate(mockPrisma);
      expect(date).toBe(getTodayIST());
    });

    it('works with findUnique when findFirst is not present', async () => {
      const mockPrisma = {
        setting: {
          findUnique: jest.fn().mockImplementation(({ where }) => {
            if (where?.key === 'active_event_date') {
              return Promise.resolve({ key: 'active_event_date', value: '2026-10-13' });
            }
            return Promise.resolve(null);
          }),
        },
      };

      const date = await resolveActiveEventDate(mockPrisma);
      expect(date).toBe('2026-10-13');
    });
  });
});
