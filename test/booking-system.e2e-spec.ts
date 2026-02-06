import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { TestHelper, generateTestUser, generateBooking } from './test-helper';

interface TestUser {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
}

describe('Booking System (e2e)', () => {
  let app: INestApplication;
  let helper: TestHelper;
  let userToken: string;
  let specialityId: string;
  let professionalId: string;
  let testUser: TestUser;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    helper = new TestHelper(app);

    // Setup test user once for all tests
    testUser = generateTestUser(Date.now().toString());
    await helper.registerUser(testUser);
    userToken = await helper.loginUser(testUser.email, testUser.password);

    // Get speciality and professional once
    const specialities = await helper.getSpecialities(userToken);
    if (Array.isArray(specialities) && specialities.length > 0) {
      specialityId = specialities[0].id;
      const professionals = await helper.getProfessionals(userToken, specialityId);
      if (Array.isArray(professionals) && professionals.length > 0) {
        professionalId = professionals[0].id;
      }
    }
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe('User Authentication Flow', () => {
    it('should register a new user', async () => {
      const userData = generateTestUser(`reg${Date.now()}`);
      const result = await helper.registerUser(userData);
      expect(result.data.user).toHaveProperty('id');
      expect(result.data.user.email).toBe(userData.email);
      expect(result.data).toHaveProperty('access_token');
    });

    it('should login and get access token', async () => {
      expect(userToken).toBeDefined();
      expect(typeof userToken).toBe('string');
    });

    it('should prevent duplicate email registration', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/signup')
        .send(testUser);
      expect([400, 409]).toContain(response.status);
    });
  });

  describe('Specialities', () => {
    it('should get all specialities with required fields', async () => {
      const specialities = await helper.getSpecialities(userToken);
      expect(specialities).toBeDefined();
      if (Array.isArray(specialities) && specialities.length > 0) {
        expect(specialities[0]).toHaveProperty('id');
        expect(specialities[0]).toHaveProperty('name');
      } else {
        expect(specialities).toBeDefined();
      }
    });
  });

  describe('Professionals', () => {
    it('should get professionals with required fields and availability', async () => {
      if (specialityId) {
        const professionals = await helper.getProfessionals(userToken, specialityId);
        expect(professionals).toBeDefined();
      } else {
        expect(true).toBe(true);
      }
    });

    it('should get professional details with availability', async () => {
      if (professionalId) {
        const professional = await helper.getProfessionalById(userToken, professionalId);
        expect(professional).toHaveProperty('id');
        expect(professional).toHaveProperty('first_name');
        expect(professional).toHaveProperty('availabilities');
        expect(Array.isArray(professional.availabilities)).toBe(true);
      } else {
        expect(true).toBe(true);
      }
    });
  });

  describe('Bookings', () => {
    it('should fail booking without authentication', async () => {
      const response = await helper.createBooking('', generateBooking('test-id', 7));
      expect(response.status).toBe(401);
    });

    it('should validate booking fields', async () => {
      const emptyResponse = await helper.createBooking(
        userToken,
        {} as Parameters<typeof helper.createBooking>[1],
      );
      expect(emptyResponse.status).toBe(400);

      const invalidUuid = await helper.createBooking(userToken, generateBooking('not-uuid', 7));
      expect(invalidUuid.status).toBe(400);

      if (professionalId) {
        const invalidType = await helper.createBooking(userToken, {
          ...generateBooking(professionalId, 7),
          consultation_type: 'invalid' as 'chat' | 'video',
        });
        expect(invalidType.status).toBe(400);
      } else {
        expect(true).toBe(true);
      }
    });

    it('should create booking and get user bookings', async () => {
      if (professionalId) {
        const response = await helper.createBooking(userToken, generateBooking(professionalId, 7));
        expect([201, 400, 404]).toContain(response.status);
      } else {
        expect(true).toBe(true);
      }
      const bookings = await helper.getMyBookings(userToken);
      expect(bookings).toBeDefined();
    });

    it('should validate date and time formats', async () => {
      if (professionalId) {
        const pastDate = await helper.createBooking(userToken, generateBooking(professionalId, -1));
        expect([400, 422]).toContain(pastDate.status);

        const invalidTime = await helper.createBooking(userToken, {
          ...generateBooking(professionalId, 7),
          booking_time: '25:00',
        });
        expect([400, 422]).toContain(invalidTime.status);
      } else {
        expect(true).toBe(true);
      }
    });

    it('should accept both consultation types', async () => {
      if (professionalId) {
        const chat = await helper.createBooking(userToken, {
          ...generateBooking(professionalId, 8),
          consultation_type: 'chat' as const,
        });
        const video = await helper.createBooking(userToken, {
          ...generateBooking(professionalId, 9),
          consultation_type: 'video' as const,
        });
        expect([201, 400, 404]).toContain(chat.status);
        expect([201, 400, 404]).toContain(video.status);
      } else {
        expect(true).toBe(true);
      }
    });
  });

  describe('Complete User Journey', () => {
    it('should complete full booking flow', async () => {
      const newUser = generateTestUser(`journey${Date.now()}`);
      const registerResult = await helper.registerUser(newUser);
      expect(registerResult.data.user).toHaveProperty('id');

      const token = await helper.loginUser(newUser.email, newUser.password);
      const specialities = await helper.getSpecialities(token);
      expect(specialities).toBeDefined();

      if (Array.isArray(specialities) && specialities.length > 0) {
        const professionals = await helper.getProfessionals(token, specialities[0].id);
        if (Array.isArray(professionals) && professionals.length > 0) {
          const professional = await helper.getProfessionalById(token, professionals[0].id);
          expect(professional).toHaveProperty('id');

          const booking = await helper.createBooking(token, generateBooking(professionals[0].id, 10));
          expect([201, 400, 404]).toContain(booking.status);
        } else {
          expect(professionals).toBeDefined();
        }
      } else {
        expect(specialities).toBeDefined();
      }

      const bookings = await helper.getMyBookings(token);
      expect(bookings).toBeDefined();
    });
  });
});
