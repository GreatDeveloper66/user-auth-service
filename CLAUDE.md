# user-auth-service

Registration, login, and JWT issuance for KitchenWise. Every other service trusts tokens issued here. Branch: `master`. Deployed at https://user-auth-service-xi.vercel.app (do not rename).

Stack: Node.js, Express, plain JavaScript (ES modules, not TypeScript), MongoDB via Mongoose, Nodemailer over SMTP for email (`services/emailService.js`), currently Brevo with a verified Gmail sender. All routes are defined in `src/server.js`; handlers are in `controllers/authController.js`. `src/server.js` exports the app for Vercel and calls `app.listen(PORT || 3000)` only when run directly (`npm run dev` / `npm start`). `npm run build` is just `npm install`.

## Routes

| Method | Route | Auth | Body |
|---|---|---|---|
| GET | /api/health | none | — |
| GET | /api/hello | none | — (test route) |
| POST | /api/register | none | `firstName`, `lastName`, `email`, `password`, `phone` |
| POST | /api/login | none | `email` or `phone`, plus `password` or `code` |
| POST | /api/logout | header present (not verified) | — |
| GET | /api/profile | Bearer | — |
| PATCH | /api/update-profile | Bearer | `firstName`, `lastName`, `phone` |
| DELETE | /api/delete-user | Bearer | — |
| POST | /api/forgot-password | none | `email` |
| POST | /api/reset-password | none | `email`, `token`, `newPassword` |
| POST | /api/send-login-code | none | `email` |
| POST | /api/login-with-code | none | `email`, `code` |

Register/login responses: `{ message, user: { id, email, firstName, lastName }, token }`. Tokens expire after `"1d"` (hardcoded). Reset tokens and login codes are 6 digits, valid 15 minutes.

Env: `MONGO_URI` (required). A connection failure is logged, not fatal: health keeps working, DB routes 500. Also `JWT_SECRET`, and for email `SMTP_HOST`, `SMTP_PORT` (default 587), `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` (must be a sender the provider has verified). Without them, send-login-code and forgot-password return 502. Never log the SMTP credentials.

## Known issues

- Protected routes verify the JWT inline in each handler. `middleware/authMiddleware.js` (`protect`) exists but is not used.
- Logout only checks that an `Authorization` header exists; tokens are not revoked (stateless logout).
- `update-profile` ignores `email` and `password`. The Postman request still sends them.
- The TTL index `{ codeExpiresAt: 1 }` (expireAfterSeconds 0) was removed from the schema on 2026-11-17 because it deletes the whole user 15 minutes after an unused login code. It was also dropped in Atlas on 2026-11-17 (`codeExpiresAt_1`); Mongoose does not drop indexes on its own, so check `users` indexes if it ever reappears.
- Brute-force limits (2026-11-17) are per account, stored on the user document (`verificationAttempts`, `codeSentAt`, `resetPasswordAttempts`, `resetPasswordSentAt`): 5 wrong attempts per code/token, then it is cleared (429); one new code/token per minute (429 + Retry-After). Password login: 10 wrong passwords lock the account for 15 minutes (`failedLoginAttempts`, `lockUntil`); code login and reset still work while locked, and a reset unlocks. Per IP: 30 failures per 15 minutes across all accounts (`services/loginThrottle.js`, `loginthrottles` collection with its own TTL index, which is safe because it only holds counters). The IP comes from `x-forwarded-for`, which Vercel sets; locally it can be spoofed.
- If an email fails to send, the issued code and cooldown are withdrawn and the route returns 502. Brevo's free tier allows 300 emails a day. Because the sender is an @gmail.com address sent through Brevo, some emails may land in spam; a verified custom domain would fix that.

## Rules

- Every request field used in a query or compared to a stored secret must pass `isNonEmptyString()` first. One-time codes and reset tokens go through `isValidOneTimeSecret()`. Never query with a possibly-undefined field or a raw body object.
- Never put a TTL index on a field of `User`: TTL deletes the whole document.

- `JWT_SECRET` here must match every service that verifies tokens. Changing the token payload shape (currently `{ id }`) breaks kitchenwise-diet-profile-service and kitchenwise-plan-storage-service, which both read `id`.
- Never log passwords, reset tokens, or login codes.
