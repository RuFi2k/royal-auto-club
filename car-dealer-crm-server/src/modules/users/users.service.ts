import { prisma } from "../../db";

export const UsersService = {
  async upsert(uid: string, email: string, name?: string) {
    return prisma.appUser.upsert({
      where: { uid },
      create: { uid, email, name, approved: false },
      update: { email, name },
    });
  },

  async findByUid(uid: string) {
    return prisma.appUser.findUnique({ where: { uid } });
  },

  async isApproved(uid: string): Promise<boolean> {
    const user = await prisma.appUser.findUnique({ where: { uid } });
    if (!user?.approved || user?.disabled) return false;
    return true;
  },

  async getStatus(uid: string, email: string, isAdmin: boolean) {
    if (isAdmin) return { approved: true, isAdmin: true, disabled: false };
    const user = await prisma.appUser.findUnique({ where: { uid } });
    return { approved: user?.approved ?? false, isAdmin: false, disabled: user?.disabled ?? false };
  },

  async getPending() {
    return prisma.appUser.findMany({
      where: { approved: false },
      orderBy: { createdAt: "asc" },
    });
  },

  async getApproved() {
    return prisma.appUser.findMany({
      where: { approved: true },
      orderBy: { createdAt: "asc" },
    });
  },

  async approve(uid: string) {
    return prisma.appUser.update({ where: { uid }, data: { approved: true } });
  },

  async disable(uid: string) {
    return prisma.appUser.update({ where: { uid }, data: { disabled: true } });
  },

  async enable(uid: string) {
    return prisma.appUser.update({ where: { uid }, data: { disabled: false } });
  },

  async remove(uid: string) {
    return prisma.appUser.delete({ where: { uid } });
  },
};
