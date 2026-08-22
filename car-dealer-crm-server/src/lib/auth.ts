import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer } from "better-auth/plugins";
import { prisma } from "../db";
import { recordAudit } from "./audit";

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.has(email.toLowerCase());
}

const trustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    autoSignIn: true,
  },
  user: {
    // CRM approval workflow. `input: false` keeps clients from self-approving
    // or self-promoting to admin.
    additionalFields: {
      approved: { type: "boolean", defaultValue: false, input: false },
      disabled: { type: "boolean", defaultValue: false, input: false },
      role: { type: "string", defaultValue: "manager", input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Admins (from ADMIN_EMAILS) are approved on creation; everyone else
          // starts pending as a manager until an admin approves them.
          const admin = isAdminEmail(user.email ?? "");
          return { data: { ...user, approved: admin, role: admin ? "admin" : "manager" } };
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          const user = await prisma.user.findUnique({ where: { id: session.userId } });
          void recordAudit({
            userId: session.userId,
            userEmail: user?.email ?? null,
            action: "LOGIN",
            changedFields: { ip: session.ipAddress ?? null },
          });
        },
      },
    },
  },
  plugins: [bearer()],
});
