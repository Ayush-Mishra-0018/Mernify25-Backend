# Backend — EcoSynergy (server) 🌿

Team: StackStorm ⚡

Team Members: Kartikeya Dimri (IMT2023126), Ayush Mishra (IMT2023129), Harsh Sinha (IMT2023571)

This document covers only the backend of EcoSynergy: server bootstrapping, APIs, data models, real-time wiring, middleware and operational notes. It mirrors the frontend README style so reviewers and teammates can focus on server responsibilities.

## Quick backend overview 🔎
- Tech: Node.js, Express, Mongoose (MongoDB), Socket.IO, Redis
- Purpose: provide REST + real-time APIs for initiative lifecycle, discussions, collaborative reports and AI summarization jobs
- Key responsibilities:
  - Serve API endpoints (create/join/leave/cancel initiatives, user auth, chat)
  - Host Socket.IO server and emit real-time events
  - Enforce auth/roles (JWT + passport)
  - Validate inputs (Joi)
  - Use Redis for pub/sub and caching where applicable
  - Handle file uploads (Cloudinary + multer)


## Live demo (deployed on Railway) 🚀

- Backend (API): https://mernify25-backend-production.up.railway.app


## Where to start (quick)
```powershell
cd backend
npm install
# create a `.env` file (see Environment Variables) in backend/
# start server (no dev script in package.json by default):
node index.js
# optional: install nodemon globally and run nodemon index.js for auto-reload
```


## Backend layout (important files & folders) 🗂️
- `index.js` — main server bootstrap
  - creates HTTP server and Socket.IO instance
  - wires middleware (CORS, helmet, compression etc.)
  - sets `app.set('io', io)` so controllers can emit events
  - starts `server.listen(PORT)`
- `controller/` — business logic and handlers
  - `user.js` — community drive flows and many emitted socket events (`driveCreated`, `driveUpdated`, `driveCancelled`)
  - `admin.js` — admin operations
  - `ngo.js` — NGO-specific logic
  - `auth.js` / `nonLogged.js` — login, callbacks, public endpoints
- `routes/` — Express routers that map endpoints to controllers
  - `user.js`, `auth.js`, `admin.js`, `ngo.js`, `notLogged.js`
- `models/` — Mongoose models (DB schema)
  - `communityDrive.js`, `user.js`, `communityDriveChat.js`, `collectionInitiative.js`, `aiChat.js`
- `auth/` — passport configuration and strategies (`passport.js`)
- `cloudinary/` — Cloudinary config and `multer` storage helpers for file uploads
- `utils/` — small utilities and middleware
  - `ExpressError.js`, `catchAsync.js`, `redis.js` (ioredis client), validation helpers
- `joiSchema.js` — Joi validation schemas used by controllers
- `middleware.js` — shared Express middleware (auth guards, error handlers, rate-limiters)
- `seeds/` — scripts to populate sample data (if included)


## Important concepts & where to find them 📌
- Socket.IO wiring
  - `index.js` creates the `io` instance and attaches it to `app` via `app.set('io', io)`.
  - Controllers call `const io = req.app.get('io')` and `io.emit(...)` to broadcast events.
  - Real-time events used: `driveCreated`, `driveUpdated`, `driveCancelled`, chat messages, impact updates.

- Authentication & role checks
  - Passport + JWT are used for authentication (see `auth/passport.js`).
  - Controllers check `req.user.id` and compare with `drive.createdBy` to guard creator-only actions (e.g., cancel).

- Validation
  - Request payloads are validated using Joi schemas from `joiSchema.js`. Controllers typically throw `ExpressError` on validation failure.

- Redis
  - `utils/redis.js` exports an ioredis client used for caching chat messages and pub/sub between services or processes when needed.
  - This helps make chat/discussion and impact-board updates resilient and quicker to serve.

- File uploads & media
  - Cloudinary is used for storing images/media. Look at `cloudinary/index.js` and `cloudinary/uploadMiddleware.js` for configuration and `multer-storage-cloudinary` wiring.

- Scheduled jobs
  - `node-cron` is available for scheduled background tasks (e.g., periodic data cleanup or async summarization tasks).


## Scripts & dependencies 🧩
- The backend `package.json` includes production dependencies used by the app (Express, Mongoose, Socket.IO, ioredis, Passport, Joi, Cloudinary, multer, etc.).
- Note: the repo's `package.json` does not define a `dev` script by default. Use `node index.js` to start, or add your own npm script such as `dev: nodemon index.js`.


## Environment Variables 🔑
Create a `.env` file in `backend/` with the values below (example):

```
PORT=8080
MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.mongodb.net/ecosynergy
JWT_SECRET=your_jwt_secret_here
FRONTEND_URL=http://localhost:5173
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
REDIS_URL=redis://localhost:6379
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
```

Keep secrets out of source control and use provider-managed secrets for production.


## API reference (selected endpoints) 🔗
- POST `/user/communityDrive` — create a community drive (creator auto-enrolled)
- GET `/user/myDrive` — fetch drives created by the user (with optional filter)
- GET `/user/allDrives?status=active|completed|cancelled` — fetch all drives (optional filter)
- PUT `/user/joinDrive/:driveId` — join a drive
- POST `/user/leaveDrive/:driveId` — leave a drive
- PUT `/user/cancelDrive/:driveId` — cancel a drive (creator only)
- GET `/user/communityDrive/:driveId` — details for a single drive

Authentication: most endpoints require `Authorization: Bearer <token>`. See `auth/passport.js` and `middleware.js` for exact middleware wiring.


## Error handling & security ✨
- Centralized `ExpressError` is used to create consistent HTTP error responses.
- Security middlewares included: `helmet`, `express-mongo-sanitize`, `express-rate-limit`, `compression`.
- CORS configured in `index.js` to allow front-end origins and credentials (sockets need proper cors settings).


## Testing & local verification ✅
Manual verification checklist for backend:
- Start backend and ensure `index.js` logs server and socket initialization
- Use Postman or curl to test protected endpoints; include JWT in `Authorization` header
- Create a drive and check that server emits `driveCreated` (observe socket logs or connect a test socket client)
- Join/leave/cancel flows: verify proper validation and role enforcement
- Check chat publish/subscribe via Redis and persistence to MongoDB


## Deployment & production notes 🚀
- For multi-instance deployments, configure Socket.IO to use the Redis adapter so events broadcast across instances (see `socket.io-redis` adapter docs).
- Use managed Redis (Upstash, Redis Cloud, AWS Elasticache) and managed MongoDB (Atlas) in production.
- Ensure the host supports WebSockets or use a provider that supports sticky sessions / a Redis adapter.
- Use environment variables from the provider dashboard and keep secrets secure.


## Where to review code (map for reviewers) 🗺️
- Server entry + socket setup: `index.js`
- Community drive flows + socket emits: `controller/user.js`
- Routes wiring: `routes/user.js` and other route files in `routes/`
- Models: `models/` folder (start with `communityDrive.js` and `user.js`)
- Redis client: `utils/redis.js`
- Auth: `auth/passport.js`
- Cloudinary uploads: `cloudinary/index.js`, `cloudinary/uploadMiddleware.js`

