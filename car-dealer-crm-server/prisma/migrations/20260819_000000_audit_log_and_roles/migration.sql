-- New audit event types. Adding enum values is transaction-safe on PG 12+ so
-- long as nothing in this migration writes one of them.
ALTER TYPE "AuditAction" ADD VALUE 'PHOTO_ADD';
ALTER TYPE "AuditAction" ADD VALUE 'PHOTO_DELETE';
ALTER TYPE "AuditAction" ADD VALUE 'PHOTO_REORDER';
ALTER TYPE "AuditAction" ADD VALUE 'TELEGRAM_PUBLISH';
ALTER TYPE "AuditAction" ADD VALUE 'TELEGRAM_DELETE';
ALTER TYPE "AuditAction" ADD VALUE 'AUTORIA_PUBLISH';
ALTER TYPE "AuditAction" ADD VALUE 'AUTORIA_DELETE';
ALTER TYPE "AuditAction" ADD VALUE 'USER_APPROVE';
ALTER TYPE "AuditAction" ADD VALUE 'USER_DISABLE';
ALTER TYPE "AuditAction" ADD VALUE 'USER_ENABLE';
ALTER TYPE "AuditAction" ADD VALUE 'USER_DELETE';
ALTER TYPE "AuditAction" ADD VALUE 'USER_ROLE_CHANGE';
ALTER TYPE "AuditAction" ADD VALUE 'LOGIN';
ALTER TYPE "AuditAction" ADD VALUE 'LOGOUT';

-- Actor email, denormalized so entries stay readable after a user is deleted.
ALTER TABLE "audit_logs" ADD COLUMN "userEmail" TEXT;

-- Roles. Everyone starts as manager; the boot-time sync in index.ts promotes
-- the accounts listed in ADMIN_EMAILS.
CREATE TYPE "UserRole" AS ENUM ('admin', 'manager');
ALTER TABLE "user" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'manager';
