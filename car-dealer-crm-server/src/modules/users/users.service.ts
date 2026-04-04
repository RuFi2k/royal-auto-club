import { prisma } from "../../db";

export const UsersService = {
  async upsert(uid: string, email: string, name?: string) {
    return prisma.appUser.upsert({
      where: { uid },
      create: { uid, email, name, approved: false },
      update: { email, name },
    });
  },

  async isApproved(uid: string): Promise<boolean> {
    const user = await prisma.appUser.findUnique({ where: { uid } });
    return user?.approved ?? false;
  },

  async getStatus(uid: string, email: string, isAdmin: boolean) {
    if (isAdmin) return { approved: true, isAdmin: true };
    const user = await prisma.appUser.findUnique({ where: { uid } });
    return { approved: user?.approved ?? false, isAdmin: false };
  },

  async getPending() {
    return prisma.appUser.findMany({
      where: { approved: false },
      orderBy: { createdAt: "asc" },
    });
  },

  async approve(uid: string) {
    return prisma.appUser.update({ where: { uid }, data: { approved: true } });
  },

  async remove(uid: string) {
    return prisma.appUser.delete({ where: { uid } });
  },
};
