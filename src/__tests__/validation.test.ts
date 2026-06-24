import {
  registerSchema,
  taskCreateSchema,
  attendanceActionSchema,
  dailyReportSchema,
  messageSchema,
  projectCreateSchema,
  channelCreateSchema,
  voiceRoomCreateSchema,
} from '../lib/validation';

describe('registerSchema', () => {
  it('validates a correct registration', () => {
    expect(
      registerSchema.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'StrongPass1!',
        accountType: 'employee',
      }).success,
    ).toBe(true);
  });

  it('rejects weak passwords', () => {
    expect(
      registerSchema.safeParse({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'weak',
        accountType: 'employee',
      }).success,
    ).toBe(false);
  });

  it('rejects invalid email', () => {
    expect(
      registerSchema.safeParse({
        name: 'John Doe',
        email: 'not-an-email',
        password: 'StrongPass1!',
        accountType: 'employee',
      }).success,
    ).toBe(false);
  });

  it('rejects client accountType', () => {
    expect(
      registerSchema.safeParse({
        name: 'John',
        email: 'john@example.com',
        password: 'StrongPass1!',
        accountType: 'client',
      }).success,
    ).toBe(false);
  });
});

describe('taskCreateSchema', () => {
  it('validates a minimal task', () => {
    expect(taskCreateSchema.safeParse({ title: 'Test task' }).success).toBe(true);
  });

  it('rejects empty title', () => {
    expect(taskCreateSchema.safeParse({ title: '' }).success).toBe(false);
  });

  it('rejects negative progress', () => {
    expect(taskCreateSchema.safeParse({ title: 'Task', progress: -1 }).success).toBe(false);
  });

  it('rejects progress over 100', () => {
    expect(taskCreateSchema.safeParse({ title: 'Task', progress: 101 }).success).toBe(false);
  });

  it('accepts all valid priorities', () => {
    for (const priority of ['LOW', 'STANDARD', 'ELEVATED', 'CRITICAL']) {
      expect(taskCreateSchema.safeParse({ title: 'T', priority }).success).toBe(true);
    }
  });

  it('rejects invalid priority', () => {
    expect(taskCreateSchema.safeParse({ title: 'T', priority: 'ULTRA' }).success).toBe(false);
  });

  it('rejects negative budget', () => {
    expect(taskCreateSchema.safeParse({ title: 'T', budget: -1 }).success).toBe(false);
  });
});

describe('attendanceActionSchema', () => {
  it('accepts check_in', () => {
    expect(attendanceActionSchema.safeParse({ action: 'check_in' }).success).toBe(true);
  });

  it('accepts check_out', () => {
    expect(attendanceActionSchema.safeParse({ action: 'check_out' }).success).toBe(true);
  });

  it('rejects invalid action', () => {
    expect(attendanceActionSchema.safeParse({ action: 'invalid' }).success).toBe(false);
  });

  it('accepts optional tz field', () => {
    expect(
      attendanceActionSchema.safeParse({ action: 'check_in', tz: 'Asia/Kolkata' }).success,
    ).toBe(true);
  });
});

describe('dailyReportSchema', () => {
  it('accepts valid report', () => {
    expect(dailyReportSchema.safeParse({ report_text: 'Worked on feature X' }).success).toBe(true);
  });

  it('rejects empty report', () => {
    expect(dailyReportSchema.safeParse({ report_text: '' }).success).toBe(false);
  });

  it('rejects report over 10000 chars', () => {
    expect(dailyReportSchema.safeParse({ report_text: 'x'.repeat(10001) }).success).toBe(false);
  });
});

describe('messageSchema', () => {
  it('accepts valid message', () => {
    expect(messageSchema.safeParse({ body: 'Hello team' }).success).toBe(true);
  });

  it('rejects empty body', () => {
    expect(messageSchema.safeParse({ body: '' }).success).toBe(false);
  });

  it('rejects body over 4000 chars', () => {
    expect(messageSchema.safeParse({ body: 'x'.repeat(4001) }).success).toBe(false);
  });

  it('accepts optional channel_id', () => {
    expect(messageSchema.safeParse({ body: 'hi', channel_id: 'general' }).success).toBe(true);
  });
});

describe('projectCreateSchema', () => {
  it('accepts valid project', () => {
    expect(projectCreateSchema.safeParse({ name: 'Project Alpha' }).success).toBe(true);
  });

  it('rejects empty name', () => {
    expect(projectCreateSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('accepts all valid statuses', () => {
    for (const status of ['Planning', 'Active', 'On Hold', 'Completed']) {
      expect(projectCreateSchema.safeParse({ name: 'P', status }).success).toBe(true);
    }
  });
});

describe('channelCreateSchema', () => {
  it('accepts a valid text channel', () => {
    const r = channelCreateSchema.safeParse({ name: 'Design' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.type).toBe('text');
  });

  it('accepts announcement type', () => {
    expect(
      channelCreateSchema.safeParse({ name: 'News', type: 'announcement' }).success,
    ).toBe(true);
  });

  it('rejects empty name', () => {
    expect(channelCreateSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('rejects name over 50 chars', () => {
    expect(channelCreateSchema.safeParse({ name: 'a'.repeat(51) }).success).toBe(false);
  });

  it('rejects invalid type', () => {
    expect(channelCreateSchema.safeParse({ name: 'test', type: 'voice' }).success).toBe(false);
  });

  it('rejects description over 500 chars', () => {
    expect(
      channelCreateSchema.safeParse({ name: 'test', description: 'x'.repeat(501) }).success,
    ).toBe(false);
  });
});

describe('voiceRoomCreateSchema', () => {
  it('accepts a minimal valid room', () => {
    const r = voiceRoomCreateSchema.safeParse({ name: 'Daily Standup' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.max_participants).toBe(20);
  });

  it('accepts custom max_participants', () => {
    expect(
      voiceRoomCreateSchema.safeParse({ name: 'Room', max_participants: 50 }).success,
    ).toBe(true);
  });

  it('rejects empty name', () => {
    expect(voiceRoomCreateSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('rejects name over 100 chars', () => {
    expect(voiceRoomCreateSchema.safeParse({ name: 'a'.repeat(101) }).success).toBe(false);
  });

  it('rejects max_participants below 2', () => {
    expect(voiceRoomCreateSchema.safeParse({ name: 'Room', max_participants: 1 }).success).toBe(false);
  });

  it('rejects max_participants above 100', () => {
    expect(voiceRoomCreateSchema.safeParse({ name: 'Room', max_participants: 101 }).success).toBe(false);
  });

  it('rejects non-integer max_participants', () => {
    expect(voiceRoomCreateSchema.safeParse({ name: 'Room', max_participants: 5.5 }).success).toBe(false);
  });
});
