# Architecture Diagram — Car Dealer CRM

```mermaid
flowchart TB
    subgraph CLIENT["Client — Vercel (React 19 + Vite)"]
        direction TB
        Login["Login page\n─────────────\nFirebase Auth\nEmail / Google OAuth"]
        CarsPage["CarsPage\n─────────────\nFilter · Pagination\nCarsList · Modals"]
        Storage_SDK["Firebase Storage SDK\n─────────────\nCache-Control: max-age=1yr\nPhotos · Scans · Archives"]
    end

    subgraph FIREBASE["Firebase (Google Cloud)"]
        FB_AUTH["Authentication\n─────────────\nID token issuer\nEmail + Google OAuth"]
        FB_STORAGE["Storage\n─────────────\nCar photos\nTech passport scans\nDefect check scans\nPhoto archives (zip)"]
    end

    subgraph VPS["VPS — Hetzner (PM2 cluster)"]
        direction TB

        subgraph EXPRESS["Node.js · Express"]
            RateLimit["Rate Limiter\n120 req/min/IP"]
            AuthMW["Auth Middleware\n─────────────\nVerify Firebase ID token\nIn-memory token cache\n(5 min TTL)"]
            Router["Cars Router\n─────────────\nGET  /cars\nPOST /cars\nPATCH /cars/:id\nPATCH /cars/:id/availability\nDELETE /cars/:id\nGET  /cars/audit-logs\nGET|POST|DELETE /cars/:id/archives"]
            Service["Cars Service\n─────────────\nAES-256-GCM encrypt/decrypt\nvinNumber · registrationNumber\nAudit log writer"]
            Backup["Backup Scheduler\n─────────────\nnode-cron · daily 03:00\npg_dump -Fc\n7-day retention"]
        end

        subgraph PG["PostgreSQL 17"]
            T_CARS["cars\n─────────────\n~30 fields\nvinNumber encrypted\nregistrationNumber encrypted\nvinNumberHash (HMAC·unique)"]
            T_AUDIT["audit_logs\n─────────────\nuserId · action · carId\nchangedFields (JSON)\ntimestamp"]
            T_ARCHIVES["car_photo_archives\n─────────────\ncarId · url · filename\ncreatedAt"]
        end

        BACKUPS["backups/\n─────────────\n*.dump files\nRetained 7 days"]
    end

    %% Auth flow
    Login -- "1 · sign in" --> FB_AUTH
    FB_AUTH -- "2 · ID token" --> Login
    Login -- "3 · token stored in memory" --> CarsPage

    %% API calls
    CarsPage -- "Bearer token\nREST API calls\nHTTPS" --> RateLimit
    RateLimit --> AuthMW
    AuthMW -- "token valid" --> Router
    Router --> Service
    Service -- "Prisma ORM\nconnection pool (20)" --> T_CARS
    Service -- "write on every\ncreate/update/delete" --> T_AUDIT
    Router -- "direct Prisma" --> T_ARCHIVES

    %% File uploads
    CarsPage -- "upload directly\n(bypasses server)" --> Storage_SDK
    Storage_SDK --> FB_STORAGE
    FB_STORAGE -- "download URL\nreturned to client" --> CarsPage
    CarsPage -- "save URL in car record" --> Router

    %% Backup
    Backup -- "pg_dump" --> PG
    Backup -- "write .dump" --> BACKUPS

    %% Styles
    classDef firebase fill:#FFA000,color:#000,stroke:#E65100
    classDef vps fill:#1565C0,color:#fff,stroke:#0D47A1
    classDef client fill:#2E7D32,color:#fff,stroke:#1B5E20
    classDef db fill:#4527A0,color:#fff,stroke:#311B92

    class FB_AUTH,FB_STORAGE firebase
    class RateLimit,AuthMW,Router,Service,Backup vps
    class Login,CarsPage,Storage_SDK client
    class T_CARS,T_AUDIT,T_ARCHIVES,BACKUPS db
```

---

## Data Flow Summary

### Authentication
1. User signs in via Firebase Auth (email or Google)
2. Firebase returns a JWT ID token (valid 1 hour)
3. Token is attached as `Authorization: Bearer <token>` on every API request
4. Server middleware verifies the token against Google's public keys, caches result for 5 minutes

### Car Listing Request
1. Client sends `GET /cars?filters&page` with Bearer token
2. Rate limiter checks 120 req/min per IP
3. Auth middleware validates token (cache hit → no Google call)
4. Service decrypts `vinNumber` and `registrationNumber` from DB before returning

### Create / Edit Car
1. If files selected → uploaded directly from browser to Firebase Storage (server never touches binary data)
2. Firebase returns download URLs → merged into form payload
3. `POST /cars` or `PATCH /cars/:id` sent to server
4. Server encrypts sensitive fields, writes to DB, creates audit log entry

### File Asset Loading
- Firebase Storage URLs include `Cache-Control: public, max-age=31536000`
- Browser caches assets for 1 year; new upload = new unique URL, no stale cache risk

---

## Security Layers

| Layer | Mechanism |
|---|---|
| Transport | HTTPS (Let's Encrypt via Nginx) |
| Authentication | Firebase ID token on every request |
| Rate limiting | 120 req / min / IP (express-rate-limit) |
| Field encryption | AES-256-GCM — vinNumber, registrationNumber |
| VIN uniqueness | HMAC-SHA256 stored separately |
| DB access | Restricted `crm_app` user (planned) |
| Network | PostgreSQL bound to localhost only (planned) |
| Audit trail | Every write logged to audit_logs with userId + diff |
| Backups | Daily pg_dump, 7-day retention |
```
