## Project overview

This project started as a real-world solution for managing personal reading history.

The initial goal was to help a frequent reader keep track of books already read, replacing years of handwritten notes with notebooks and manual searches. Over time, the system evolved into a scalable, multi-user platform supporting books, movies, and TV series.

The backend system has been in use for over 4 years and currently supports multiple users who manage real data and rely on it for daily operations.

## Main features

- User registration and authentication using JWT
- Google Sign-In integration via Firebase Admin SDK
- Multi-user support with isolated personal data
- CRUD operations for:
  - Books
  - Movies
  - TV series
- Personal **"My List"** feature for pending content
- User rankings based on consumed content per category
- Email notifications using custom templates
- Admin-protected endpoints

## Architecture and technical decisions

- **Node.js + Express** for REST API development
- **MongoDB + Mongoose** for flexible and scalable data modeling
- **Firebase Admin SDK** used exclusively on the backend to securely validate Google OAuth tokens
- **JWT-based authentication** for session management
- **Rate limiting** applied to sensitive endpoints
- **Input validation** using Joi
- **Environment variables** used for all sensitive credentials

Security note:
Firebase Admin credentials are loaded via environment variables.
No secrets are committed to the repository.
