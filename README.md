# GymSync

A gym management system with **PT–Member–Admin** roles and a session-based booking system.

- **Backend:** ASP.NET Core 8 Web API (Clean Architecture, EF Core, PostgreSQL, JWT, SignalR)
- **Mobile:** React Native + Expo (TypeScript, Expo Router, NativeWind/Tailwind)
- **Database:** PostgreSQL 16 (via Docker)
- **Realtime:** SignalR hub for chat (`/hubs/chat`)

---

## Repository Layout

```
GymSync-App/
├── docker-compose.yml          # Postgres 16 service
├── GymSync-App.sln
├── Backend/
│   └── GymSync.Api/            # ASP.NET Core 8 Web API
│       ├── Controllers/        # Auth, Users, Appointments, Availability, Chat
│       ├── Data/               # AppDbContext, DbInitializer (seed)
│       ├── DTOs/               # Request/response contracts
│       ├── Hubs/               # ChatHub (SignalR)
│       ├── Mapping/            # AutoMapper profiles
│       ├── Migrations/         # EF Core migrations
│       ├── Models/             # User, Appointment, Availability, Message
│       ├── Services/           # AuthService (BCrypt + JWT)
│       ├── appsettings.json    # Connection string + JWT config
│       └── Program.cs
└── Mobile/
    └── GymSyncMobile/          # Expo app
        ├── app/                # Expo Router screens (tabs, login, chat)
        ├── components/         # Screen + UI components
        ├── contexts/           # AuthContext
        ├── lib/                # api.ts, chat-connection.ts, secure-storage.ts
        ├── tailwind.config.js
        └── app.json
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| .NET SDK | 8.0+ |
| Node.js | 20 LTS+ |
| npm / pnpm / yarn | latest |
| Docker Desktop | latest (for PostgreSQL) |
| Expo Go app | on a physical device, **or** Android Studio / Xcode for emulators |

---

## 1. Database (PostgreSQL via Docker)

From the repository root:

```powershell
docker compose up -d
```

This starts `gymsync-postgres` on `localhost:5432` with:

- **Database:** `gymsync`
- **User:** `postgres`
- **Password:** `postgres`
- **Volume:** `gymsync_pgdata` (persistent)

Stop / reset:

```powershell
docker compose down            # stop
docker compose down -v         # stop + drop volume (wipes data)
```

---

## 2. Backend (ASP.NET Core 8 API)

### Configuration

Edit [Backend/GymSync.Api/appsettings.json](Backend/GymSync.Api/appsettings.json):

- `ConnectionStrings:DefaultConnection` — defaults to the docker-compose Postgres above.
- `Jwt:Key` — **replace with a long secret (≥ 32 chars) before any non-local use.**
- `Jwt:Issuer`, `Jwt:Audience`, `Jwt:ExpiresInMinutes` — adjust as needed.

### Run

```powershell
cd Backend/GymSync.Api
dotnet restore
dotnet run
```

The API binds to `http://0.0.0.0:5159` (see [Properties/launchSettings.json](Backend/GymSync.Api/Properties/launchSettings.json)) so physical devices on your LAN can reach it.

- Swagger UI: <http://localhost:5159/swagger>
- SignalR hub: `ws://<host>:5159/hubs/chat` (JWT via `?access_token=...`)

### Migrations

Migrations are applied automatically on startup by `DbInitializer.InitializeAsync`. To create a new one:

```powershell
cd Backend/GymSync.Api
dotnet ef migrations add <Name>
dotnet ef database update
```

### Seeded Accounts

On first run [DbInitializer](Backend/GymSync.Api/Data/DbInitializer.cs) seeds:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@gymsync.local` | `Admin123!` |
| PT | `burak@gymsync.local`, `selin@gymsync.local` | `Trainer123!` |
| Member | `ayse@`, `mehmet@`, `zeynep@`, `ali@`, `elif@gymsync.local` | `Member123!` |

> Change the admin password before any non-local deployment.

---

## 3. Mobile (Expo)

### Configuration

The API base URL is resolved in [Mobile/GymSyncMobile/lib/api.ts](Mobile/GymSyncMobile/lib/api.ts):

1. `EXPO_PUBLIC_API_URL` env var (preferred), otherwise
2. Hardcoded fallback `http://192.168.1.107:5159`.

Set your dev machine's LAN IP so Expo Go on a physical device can reach the API:

```powershell
# From Mobile/GymSyncMobile, create .env
"EXPO_PUBLIC_API_URL=http://<your-lan-ip>:5159" | Out-File -Encoding ascii .env
```

Find your LAN IP with `ipconfig` (look for IPv4 on your Wi-Fi adapter).

### Install & Run

```powershell
cd Mobile/GymSyncMobile
npm install
npm start
```

Then:

- **Physical device:** scan the QR code with **Expo Go** (same Wi-Fi as the dev machine).
- **Android emulator:** press `a` (use `EXPO_PUBLIC_API_URL=http://10.0.2.2:5159`).
- **iOS simulator:** press `i` (use `EXPO_PUBLIC_API_URL=http://localhost:5159`).
- **Web:** press `w`.

---

## 4. End-to-End Smoke Test

1. `docker compose up -d`
2. `dotnet run` in `Backend/GymSync.Api` → check Swagger at <http://localhost:5159/swagger>.
3. `npm start` in `Mobile/GymSyncMobile` → open in Expo Go.
4. Login with `admin@gymsync.local` / `Admin123!`.

---

## Architecture Notes

- **Auth:** Email + password (BCrypt) → JWT bearer. Token stored on device via `expo-secure-store` ([secure-storage.ts](Mobile/GymSyncMobile/lib/secure-storage.ts)) and attached by an Axios interceptor.
- **Roles:** `Admin`, `PT`, `Member` (enum on [User](Backend/GymSync.Api/Models/User.cs)). UI in `app/(tabs)/` adapts per role.
- **Booking:** Members consume credits (`TotalCredits` / `RemainingCredits`) against PT availability slots ([AvailabilityController](Backend/GymSync.Api/Controllers/AvailabilityController.cs), [AppointmentsController](Backend/GymSync.Api/Controllers/AppointmentsController.cs)).
- **Chat:** SignalR `ChatHub` with custom `IUserIdProvider`; mobile uses `@microsoft/signalr` ([chat-connection.ts](Mobile/GymSyncMobile/lib/chat-connection.ts)). JWT is passed via `?access_token=` because WebSockets cannot set headers.
- **CORS:** `AllowAll` policy for development convenience — tighten for production.
- **HTTPS redirect:** disabled so LAN devices can hit plain HTTP. Re-enable behind a reverse proxy in production.

---

## Common Issues

| Symptom | Fix |
|--------|-----|
| Mobile app cannot reach API | Set `EXPO_PUBLIC_API_URL` to your LAN IP; ensure phone + PC are on the same Wi-Fi; allow port 5159 through Windows Firewall. |
| `Jwt:Key missing` on startup | Add a key (≥ 32 chars) to `appsettings.json` or user-secrets. |
| `relation "Users" does not exist` | Postgres container not running, or migrations failed — check `docker compose ps` and backend logs. |
| Port 5432 already in use | Stop the local Postgres service or change the host port in `docker-compose.yml`. |
