# StreamX Backend

The Node.js/Express **middleware server** that sits between the Flutter app,
the Admin Dashboard, and the external content API. Nothing else in the
project talks to the outside world directly — this is the single source of
truth for content, users, and app-wide settings.

## What this server does

- Stores and serves **all content** (Movies, TV, Anime, Music, Sports, News,
  Live, Education, Kids, Gaming, Shorts) through one unified schema.
- Handles **auth** for app users and, completely separately, for admins.
- Enforces the **Free / Streamer / Super Streamer** access rules on every
  stream link and download request.
- Is the **remote control** for the app: maintenance mode, force-update
  version, ads on/off, and the Telegram link all live here and change
  instantly without a new APK release.

## Folder structure

```
streamx-backend/
├── server.js                    # entry point
├── package.json
├── .env.example                  # copy to .env and fill in real values
├── scripts/
│   └── createSuperAdmin.js         # bootstraps your first admin login
└── src/
    ├── config/
    │   ├── db.js                     # MongoDB connection
    │   └── redis.js                  # optional caching (safe to leave unset)
    ├── models/
    │   ├── User.js                     # app users, subscription tier, profiles
    │   ├── AdminUser.js                # admin-only, separate collection & auth
    │   ├── Content.js                  # unified schema for every content type
    │   └── AppConfig.js                # the single "remote control" document
    ├── middleware/
    │   ├── auth.js                     # app-user JWT protection
    │   ├── adminAuth.js                # admin JWT protection + RBAC
    │   └── errorHandler.js
    ├── utils/
    │   ├── apiConfig.js                # wraps the external Dave Tech API
    │   └── accessControl.js            # Free/Streamer/Super Streamer rules
    └── routes/
        ├── index.js                    # mounts everything below
        ├── auth.js                     # /api/auth/*
        ├── content.js                  # /api/content/*  (public, tier-gated)
        ├── adminAuth.js                # /api/admin/auth/*
        ├── adminContent.js             # /api/admin/content/*  (CMS)
        ├── adminUsers.js               # /api/admin/users/*
        ├── adminConfig.js              # /api/admin/config/*
        └── adminAnalytics.js           # /api/admin/analytics/*
```

## API reference

### Public / app-facing

| Method | Route | What it does |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/app-config` | Maintenance mode, version, ads, Telegram link |
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/auth/me` | Current user, with a populated watchlist |
| POST | `/api/auth/profiles` | Add a sub-profile (e.g. Kids) |
| POST/DELETE | `/api/auth/watchlist/:contentId` | Save / remove a title |
| PUT | `/api/auth/watch-history` | Save "Continue Watching" progress |
| GET | `/api/content` | Unified list — `?type=&filter=&genre=&search=&sort=&isLive=&liveStatus=&page=&limit=` |
| GET | `/api/content/homepage` | One call: Hero + every row for the Home screen |
| GET | `/api/content/:id` | Full details, stream links already tier-gated |
| POST | `/api/content/:id/unlock-hd` | Redeems a watched Rewarded Ad for 30 min of HD |
| GET | `/api/content/:id/download?quality=` | Tier-gated direct download URL |

### Admin only (`Authorization: Bearer <admin token>`)

| Method | Route | What it does |
|---|---|---|
| POST | `/api/admin/auth/login` | The only way into the Admin Dashboard |
| GET/POST/PUT/PATCH/DELETE | `/api/admin/content` | Full CMS CRUD |
| GET/PATCH/DELETE | `/api/admin/users` | Block/unblock, override subscription tier |
| GET/PUT | `/api/admin/config` | The remote-control document |
| GET | `/api/admin/analytics/summary` | Dashboard stats |

## Access Matrix (enforced in `accessControl.js`)

| | Free | Streamer | Super Streamer |
|---|---|---|---|
| Trailer | Yes | Yes | Yes |
| SD stream | Yes | Yes | Yes |
| HD stream | Watch a Rewarded Ad | Yes | Yes |
| 4K stream | No | No | Yes |
| Download SD/HD | No | Yes | Yes |
| Download 4K | No | No | Yes |

## Running it locally

1. `cd streamx-backend && npm install`
2. Copy `.env.example` to `.env` and fill in:
   - `MONGO_URI` — a free cluster at mongodb.com/atlas works fine
   - `JWT_SECRET` and `ADMIN_JWT_SECRET` — two different long random strings
   - `REDIS_URL` — optional, leave blank if you don't have one yet
   - `PRIMARY_CONTENT_API` — your Dave Tech API base URL
3. `npm run dev`
4. Visit `http://localhost:5000/api/health`

### Creating your first admin login

There's no public admin sign-up on purpose. Run this once:

```
node scripts/createSuperAdmin.js "Your Name" you@example.com "a-strong-password"
```

## Deploying (Render)

1. Push this folder to a GitHub repo (or a subfolder of your monorepo).
2. On Render: **New → Web Service** — connect the repo, root directory
   `streamx-backend`.
3. Build command: `npm install` — Start command: `npm start`.
4. Add every variable from `.env.example` under Render's **Environment** tab.
   This is where all your real keys live — never commit `.env` itself.
5. Deploy. Your health check will be at `https://your-service.onrender.com/api/health`.
6. Run the `createSuperAdmin.js` script once (Render's Shell tab, or run it
   locally pointed at the same `MONGO_URI`).

Heroku works the same way — a `Procfile` isn't needed since Heroku reads
the `"start"` script from `package.json` automatically.
