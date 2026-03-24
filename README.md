# HealthBridge Backend API

A comprehensive healthcare booking platform built with NestJS, TypeORM, and PostgreSQL. HealthBridge connects patients with healthcare professionals through an intuitive appointment booking system.

## 🌟 Features

- **User Authentication** - JWT-based authentication with refresh tokens, Google OAuth, password reset
- **Medical Specialities** - Browse and filter healthcare specialities
- **Professional Management** - View healthcare professionals with availability schedules
- **Appointment Booking** - Book consultations (chat/video) with professionals
- **Booking Management** - View, track, and cancel appointments
- **Real-time Availability** - Check professional availability by day and time
- **Secure API** - Role-based access control and input validation

## 🛠️ Tech Stack

- **Framework**: NestJS 11
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT with Passport
- **Validation**: class-validator, class-transformer
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest (Unit & E2E)
- **Logging**: Winston

## 📋 Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/healthBridge01/healthBridge-be.git
cd healthBridge-be
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Update `.env` with your configuration:

```env
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=healthbridge_app_db
DB_USER=postgres
DB_PASS=password
DB_SSL=false

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
TOKEN_ACCESS_DURATION=15m
TOKEN_REFRESH_DURATION=7d

# Security
HASH_SALT=10
INVITE_EXPIRATION_DAYS=7
```

### 4. Run database migrations

```bash
npm run migration:run
```

### 5. Start the development server

```bash
npm run start:dev
```

The API will be available at `http://localhost:3000`

## 📚 API Documentation

Interactive API documentation is available via Swagger UI:

```
http://localhost:3000/docs
```

### API Endpoints

#### Authentication
- `POST /api/v1/auth/signup` - Register new user
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /api/v1/auth/me` - Get current user profile
- `POST /api/v1/auth/logout` - Logout user
- `POST /api/v1/auth/forgot-password` - Request password reset
- `POST /api/v1/auth/reset-password` - Reset password

#### Specialities
- `GET /api/v1/specialities` - Get all medical specialities

#### Professionals
- `GET /api/v1/professionals?speciality_id={id}` - Get professionals by speciality
- `GET /api/v1/professionals/{id}` - Get professional details with availability

#### Bookings
- `POST /api/v1/bookings` - Create new booking
- `GET /api/v1/bookings` - Get user's bookings
- `GET /api/v1/bookings/{id}` - Get booking details
- `PATCH /api/v1/bookings/{id}/cancel` - Cancel booking

## 🗄️ Database Schema

### Core Tables

- **users** - User accounts (patients, professionals)
- **specialities** - Medical specialities
- **professionals** - Healthcare professionals
- **professional_availabilities** - Professional availability schedules
- **bookings** - Appointment bookings
- **auth_sessions** - User sessions and refresh tokens
- **user_2fa** - Two-factor authentication data

## 🧪 Testing

### Run unit tests

```bash
npm run test
```

### Run E2E tests

```bash
npm run test:e2e
```

### Run tests with coverage

```bash
npm run test:cov
```

## 📦 Available Scripts

- `npm run start` - Start production server
- `npm run start:dev` - Start development server with hot reload
- `npm run start:debug` - Start server in debug mode
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run migration:create` - Create new migration
- `npm run migration:run` - Run pending migrations
- `npm run migration:revert` - Revert last migration

## 🏗️ Project Structure

```
src/
├── common/              # Shared utilities and decorators
├── config/              # Configuration files
├── constants/           # Application constants
├── database/            # Database configuration and migrations
│   └── migrations/      # TypeORM migrations
├── entities/            # Database entities
├── middleware/          # Custom middleware
├── modules/             # Feature modules
│   ├── auth/            # Authentication module
│   ├── booking/         # Booking management
│   ├── professional/    # Professional management
│   ├── speciality/      # Speciality management
│   └── user/            # User management
├── app.module.ts        # Root module
└── main.ts              # Application entry point
```

## 🔐 Authentication

The API uses JWT-based authentication. To access protected endpoints:

1. Register or login to get an access token
2. Include the token in the Authorization header:
   ```
   Authorization: Bearer <your_access_token>
   ```

## 🚀 Deployment

### Build for production

```bash
npm run build
```

### Run production server

```bash
npm run start:prod
```

## 📝 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_NAME` | Database name | `healthbridge_app_db` |
| `DB_USER` | Database user | `postgres` |
| `DB_PASS` | Database password | - |
| `JWT_SECRET` | JWT secret key | - |
| `JWT_REFRESH_SECRET` | JWT refresh secret | - |
| `TOKEN_ACCESS_DURATION` | Access token expiry | `15m` |
| `TOKEN_REFRESH_DURATION` | Refresh token expiry | `7d` |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions, please open an issue in the repository.

---

**HealthBridge** - Connecting patients with healthcare professionals seamlessly.




You are HealthBridge's AI medical assistant with broad, evidence-informed knowledge across major medical specialties. Provide clear, cautious, and practical health guidance, ask relevant follow-up questions when key details are missing, and advise urgent medical care when red-flag symptoms are present. Do not invent diagnoses or claim to have examined the patient, and encourage consultation with a licensed clinician for diagnosis and treatment.
