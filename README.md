# user-auth-service

A microservice responsible for user registration, login, and JWT token management. Part of the KitchenWise application — a full-stack microservice architecture for personalized meal planning and local grocery store discovery.

---

## Overview

This service handles all authentication concerns for the application. It exposes endpoints for registering new users, authenticating existing users, and managing JWT tokens. All other services in the architecture rely on tokens issued by this service for request authorization.

---

## Tech Stack

- **Runtime:** Node.js
- **Language:** JavaScript (ES modules)
- **Framework:** Express
- **Database:** MongoDB (Mongoose)
- **Authentication:** JWT (JSON Web Tokens), bcrypt password hashing
- **Email:** Nodemailer over SMTP, currently through Brevo (login codes and password reset tokens)

---

## Features

- User registration with password hashing
- Login with email or phone, using a password or an emailed one-time code
- JWT issuance (tokens expire after 1 day)
- Password reset by emailed token

Logout is stateless: the server does not revoke tokens, so the client must discard its token.

---

## API Endpoints

| Method | Endpoint | Auth | Body | Description |
| -------- | ---------- | ---- | ---- | ------------- |
| GET | `/api/health` | none | — | Health check |
| POST | `/api/register` | none | `firstName`, `lastName`, `email`, `password`, `phone` | Register a new user and return a JWT |
| POST | `/api/login` | none | `email` or `phone`, plus `password` or `code` | Authenticate and return a JWT |
| POST | `/api/logout` | Bearer | — | Acknowledge logout (client removes the token) |
| GET | `/api/profile` | Bearer | — | Get the current user's profile (password excluded) |
| PATCH | `/api/update-profile` | Bearer | `firstName`, `lastName`, `phone` (all optional) | Update the current user's profile |
| DELETE | `/api/delete-user` | Bearer | — | Delete the current user |
| POST | `/api/forgot-password` | none | `email` | Email a 6-digit reset token (valid 15 minutes) |
| POST | `/api/reset-password` | none | `email`, `token`, `newPassword` | Reset the password with that token |
| POST | `/api/send-login-code` | none | `email` | Email a 6-digit login code (valid 15 minutes) |
| POST | `/api/login-with-code` | none | `email`, `code` | Log in with that code and return a JWT |

Login codes and reset tokens are 6 digits, valid for 15 minutes, and single use. Each allows 5 wrong attempts; after that it is cleared and the endpoint returns `429` until a new one is requested. A new code or token can be requested at most once per minute (`429` with a `Retry-After` header otherwise). Missing or non-string fields return `400`. If the email can't be sent, send-login-code and forgot-password return `502` and no code is kept, so the user can retry right away.

Password guessing is limited too: after 10 wrong passwords an account is locked for 15 minutes (`429` with `Retry-After`). Logging in with an emailed code or resetting the password still works while locked, and a reset unlocks the account. Separately, each client IP is allowed 30 failed attempts (wrong password, unknown account, or bad code/token) per 15 minutes across all accounts, then gets `429`.

`/api/update-profile` cannot change email or password; any `email` or `password` in the body is ignored. Use the forgot/reset flow to change a password.

Register and login responses:

```json
{
  "message": "Login successful",
  "user": { "id": "...", "email": "...", "firstName": "...", "lastName": "..." },
  "token": "<JWT>"
}
```

The JWT payload is `{ id }` (the user's MongoDB `_id`). Other services read the user ID from it.

---

## Environment Variables

Create a `.env` file in the root of the project with the following variables:

```env
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your_brevo_smtp_login
SMTP_PASS=your_brevo_smtp_key
EMAIL_FROM=KitchenWise <verified_sender@example.com>
```

If MongoDB can't be reached, the service logs the error and keeps running: `/api/health` still responds, and database routes return 500.

`JWT_SECRET` must be the same value used by every service that verifies tokens.

---

## Getting Started

### Prerequisites

- Node.js v18+
- A MongoDB connection string (`MONGO_URI`)

### Installation

```bash
git clone https://github.com/GreatDeveloper66/user-auth-service.git
cd user-auth-service
npm install
```

### Running

The app is deployed on Vercel, which imports the Express app exported from `src/server.js`.

`npm run dev` and `npm start` both run `node src/server.js`, which listens on `PORT` (default 3000). Vercel imports the same file and does not use that listener. `npm run build` only runs `npm install`.

---

## Project Architecture

This repository is one of seven components in the KitchenWise application (six backend microservices plus the React frontend):

| Repository | Responsibility |
|---------|---------------|
| [kitchenwise-frontend](https://github.com/GreatDeveloper66/kitchenwise-frontend) | React + TypeScript frontend |
| **[user-auth-service](https://github.com/GreatDeveloper66/user-auth-service)** | Authentication & JWT management |
| [kitchenwise-diet-profile-service](https://github.com/GreatDeveloper66/kitchenwise-diet-profile-service) | Diet profile storage & management |
| [kitchenwise-meal-plan-service](https://github.com/GreatDeveloper66/kitchenwise-meal-plan-service) | AI-powered meal plan generation |
| [kitchenwise-plan-storage-service](https://github.com/GreatDeveloper66/kitchenwise-plan-storage-service) | User meal plan storage |
| [kitchenwise-grocery-service](https://github.com/GreatDeveloper66/kitchenwise-grocery-service) | Grocery store discovery by location (Google Places) |
| [kitchenwise-recipe-service](https://github.com/GreatDeveloper66/kitchenwise-recipe-service) | AI recipe generation |
