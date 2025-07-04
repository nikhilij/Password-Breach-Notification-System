# Password Breach Notification System - Backend

A comprehensive backend system for monitoring and notifying users about password breaches using the HaveIBeenPwned API.

## Features

- **User Authentication**: JWT-based authentication with email verification
- **Breach Monitoring**: Real-time breach checking using HaveIBeenPwned API
- **Multi-channel Notifications**: Email, SMS, and push notifications
- **Admin Dashboard**: Comprehensive admin panel for monitoring and management
- **Secure API**: Rate limiting, input validation, and security headers
- **Comprehensive Logging**: Winston-based logging with rotation
- **Testing**: Jest and Supertest for comprehensive test coverage

## Quick Start

### Prerequisites

- Node.js 16+
- MongoDB 4.4+
- Redis (optional, for caching)

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd Password-Breach-Notification-System
   ```

2. **Set up environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Install dependencies**

   ```bash
   cd backend
   npm install
   ```

4. **Run setup script**

   ```bash
   npm run setup
   ```

5. **Start the server**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3000`

## Environment Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/breachdb

# JWT
JWT_SECRET=your_jwt_secret_here_please_change_in_production

# External APIs
HIBP_API_KEY=your_hibp_api_key_here

# Email Configuration
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_email_password_here

# SMS Configuration
SMS_API_KEY=your_sms_api_key_here

# Security
BCRYPT_SALT_ROUNDS=10
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## API Endpoints

### Authentication (`/api/auth`)

- `POST /register` - Register new user
- `POST /login` - User login
- `GET /verify-email` - Verify email address
- `POST /forgot-password` - Request password reset
- `POST /reset-password` - Reset password
- `GET /me` - Get current user info (protected)
- `PUT /profile` - Update user profile (protected)
- `POST /change-password` - Change password (protected)
- `POST /logout` - Logout user (protected)

### Breach Monitoring (`/api/breach`)

- `POST /check` - Check for breaches (protected)
- `GET /history` - Get breach history (protected)
- `GET /search` - Search breaches (protected)
- `GET /:breachId` - Get breach details (protected)
- `PUT /:breachId/acknowledge` - Acknowledge breach (protected)
- `PUT /:breachId/action-completed` - Mark action completed (protected)
- `GET /admin/stats` - Get global stats (admin)
- `GET /admin/recent` - Get recent breaches (admin)

### Notifications (`/api/notifications`)

- `GET /preferences` - Get notification preferences (protected)
- `PUT /preferences` - Update notification preferences (protected)
- `GET /` - Get notifications (protected)
- `GET /stats` - Get notification statistics (protected)
- `GET /history` - Get notification history (protected)
- `PUT /mark-all-read` - Mark all notifications as read (protected)
- `PUT /:id/read` - Mark specific notification as read (protected)
- `POST /test` - Send test notification (protected)

## Scripts

### Development

```bash
npm run dev          # Start development server with nodemon
npm start           # Start production server
npm test            # Run all tests
npm run test:watch  # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run lint        # Run ESLint
npm run lint:fix    # Fix ESLint issues
```

### Database Management

```bash
npm run db:init     # Initialize database with indexes
npm run db:seed     # Seed database with sample data
npm run db:clear    # Clear seeded data
```

### Notifications

```bash
npm run alerts      # Send breach alerts
npm run digest      # Send weekly digest
npm run breach:check # Run daily breach check
npm run test:notification <email> # Send test notification
```

## Testing

Run the test suite:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

Run tests in watch mode:

```bash
npm run test:watch
```

## Project Structure

```
backend/
├── config/          # Configuration files
│   ├── db.js       # Database connection
│   └── env.js      # Environment variables
├── controllers/     # Route controllers
│   ├── authController.js
│   ├── breachController.js
│   └── notificationController.js
├── middlewares/     # Express middlewares
│   ├── authMiddleware.js
│   └── errorHandler.js
├── models/         # Mongoose models
│   ├── User.js
│   └── Breach.js
├── routes/         # Route definitions
│   ├── authRoutes.js
│   ├── breachRoutes.js
│   └── notificationRoutes.js
├── services/       # Business logic services
│   ├── breachService.js
│   ├── emailService.js
│   └── smsService.js
├── tests/          # Test files
│   ├── auth.test.js
│   ├── breach.test.js
│   ├── notification.test.js
│   └── setup.js
├── utils/          # Utility functions
│   ├── hashUtil.js
│   └── logger.js
├── index.js        # Main server file
└── package.json    # Dependencies and scripts
```

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Prevent abuse with configurable rate limits
- **Input Validation**: Comprehensive validation using express-validator
- **Password Security**: bcrypt hashing with configurable salt rounds
- **Security Headers**: Helmet.js for security headers
- **CORS Configuration**: Configurable CORS settings
- **Error Handling**: Secure error handling without information leakage

## Logging

The application uses Winston for logging with the following levels:

- `error`: Error conditions
- `warn`: Warning conditions
- `info`: Informational messages
- `debug`: Debug-level messages

Logs are written to:

- `logs/error.log` - Error logs
- `logs/request.log` - Request logs
- Console output (development)

## Monitoring

### Health Check

```
GET /health
```

Returns server status, uptime, and environment information.

### API Documentation

```
GET /api
```

Returns comprehensive API documentation.

## Deployment

### Environment Variables

Ensure all required environment variables are set:

- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret
- `HIBP_API_KEY` - HaveIBeenPwned API key
- `EMAIL_*` - Email service configuration
- `SMS_API_KEY` - SMS service API key

### Database Setup

```bash
npm run db:init
npm run db:seed  # Optional: seed with sample data
```

### Start Production Server

```bash
npm start
```

### Process Management

Consider using PM2 for production deployment:

```bash
pm2 start index.js --name "breach-notification-api"
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Run the test suite
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please open an issue in the repository.
