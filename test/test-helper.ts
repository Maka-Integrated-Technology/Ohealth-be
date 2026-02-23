import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

export class TestHelper {
  constructor(private app: INestApplication) {}

  async registerUser(userData: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
  }) {
    const response = await request(this.app.getHttpServer())
      .post('/auth/signup')
      .send(userData)
      .expect(201);
    return response.body;
  }

  async loginUser(email: string, password: string) {
    const response = await request(this.app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return response.body.data.access_token;
  }

  async getSpecialities(token: string) {
    const response = await request(this.app.getHttpServer())
      .get('/specialities')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return response.body;
  }

  async getProfessionals(token: string, specialityId: string) {
    const response = await request(this.app.getHttpServer())
      .get(`/professionals?speciality_id=${specialityId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return response.body;
  }

  async getProfessionalById(token: string, professionalId: string) {
    const response = await request(this.app.getHttpServer())
      .get(`/professionals/${professionalId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return response.body;
  }

  async createBooking(
    token: string,
    data: {
      professional_id: string;
      booking_date: string;
      booking_time: string;
      consultation_type: 'chat' | 'video';
      notes?: string;
    },
  ) {
    const response = await request(this.app.getHttpServer())
      .post('/bookings')
      .set('Authorization', `Bearer ${token}`)
      .send(data);
    return response;
  }

  async getMyBookings(token: string) {
    const response = await request(this.app.getHttpServer())
      .get('/bookings')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    return response.body;
  }
}

export const generateTestUser = (suffix = '') => ({
  email: `test${suffix}@example.com`,
  password: 'Test@1234',
  first_name: 'Test',
  last_name: 'User',
});

export const generateBooking = (professionalId: string, daysFromNow = 1) => {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return {
    professional_id: professionalId,
    booking_date: date.toISOString().split('T')[0],
    booking_time: '10:00',
    consultation_type: 'video' as const,
    notes: 'Test booking',
  };
};
