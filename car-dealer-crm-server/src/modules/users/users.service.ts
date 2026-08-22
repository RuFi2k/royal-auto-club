import { prisma } from "../../db";

// Operates on the Better Auth `user` table. User identity/creation is handled by
// Better Auth (sign-up); this service only manages the CRM approval workflow.
export const UsersService = {
  async findByUid(uid: string) {
    return prisma.user.findUnique({ where: { id: uid } });
  },

  async isApproved(uid: string): Promise<boolean> {
    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user?.approved || user?.disabled) return false;
    return true;
  },

  async getStatus(uid: string, _email: string, isAdmin: boolean) {
    if (isAdmin) return { approved: true, isAdmin: true, role: "admin", disabled: false };
    const user = await prisma.user.findUnique({ where: { id: uid } });
    return {
      approved: user?.approved ?? false,
      isAdmin: false,
      role: "manager",
      disabled: user?.disabled ?? false,
    };
  },

  async getPending() {
    return prisma.user.findMany({
      where: { approved: false },
      orderBy: { createdAt: "asc" },
    });
  },

  async getApproved() {
    return prisma.user.findMany({
      where: { approved: true },
      orderBy: { createdAt: "asc" },
    });
  },

  async approve(uid: string) {
    return prisma.user.update({ where: { id: uid }, data: { approved: true } });
  },

  async disable(uid: string) {
    return prisma.user.update({ where: { id: uid }, data: { disabled: true } });
  },

  async enable(uid: string) {
    return prisma.user.update({ where: { id: uid }, data: { disabled: false } });
  },

  async setRole(uid: string, role: "admin" | "manager") {
    return prisma.user.update({ where: { id: uid }, data: { role } });
  },

  async remove(uid: string) {
    return prisma.user.delete({ where: { id: uid } });
  },
};
