# user-auth-service

A microservice responsible for user registration, login, and JWT token management. Part of the KitchenWise application — a full-stack microservice architecture for personalized meal planning and local grocery store discovery.

---

## Overview

This service handles all authentication concerns for the application. It exposes endpoints for registering new users, authenticating existing users, and managing JWT tokens. All other services in the architecture rely on tokens issued by this service for request authorization.

---

## Tech Stack

- **Runtime:** Node.js
- **Language:** TypeScript
- **Framework:** Express
- **Database:** MongoDB
- **Authentication:** JWT (JSON Web Tokens)

---

## Features

- User registration with input validation
- Secure login with password hashing
- JWT token issuance and verification
- Token-based session management

---

## API Endpoints

| Method | Endpoint | Description |
| -------- | ---------- | ------------- |
| POST | `/api/register` | Register a new user |
| POST | `/api/login` | Authenticate a user and return a JWT token |
| POST | `/api/logout` | Invalidate a user session |
| GET | `/api/profile` | Get user profile information |
| DELETE | `/api/delete-user` | Delete user |
| PATCH | `/api/update-user` | Update user |
| POST | `/api/forgot-password` | Forgot password |
| POST | `/api/reset-password` | Reset password |
| POST | `/api/send-login-code` | Send login code |
| POST | `/api/login-with-code` | Login with code |

---

## Environment Variables

Create a `.env` file in the root of the project with the following variables:

```env
PORT=3001
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=24h
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- MongoDB instance (local or cloud)

### Installation

```bash
git clone https://github.com/GreatDeveloper66/user-auth-service.git
cd user-auth-service
npm install
```

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

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
