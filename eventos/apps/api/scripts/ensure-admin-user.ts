import "dotenv/config";

import { AdminUsersService } from "../src/admin-users/admin-users.service";
import { PrismaService } from "../src/prisma/prisma.service";

// Cria ou redefine o SUPER_ADMIN inicial a partir de variáveis de ambiente.
// Uso: FINORA_ADMIN_LOGIN_NAME=... FINORA_ADMIN_PASSWORD=... node dist/scripts/ensure-admin-user.js
async function main() {
  const loginName = process.env.FINORA_ADMIN_LOGIN_NAME?.trim();
  const password = process.env.FINORA_ADMIN_PASSWORD;

  if (!loginName) {
    throw new Error("FINORA_ADMIN_LOGIN_NAME ausente.");
  }

  if (!password || password.length < 12) {
    throw new Error("FINORA_ADMIN_PASSWORD ausente ou com menos de 12 caracteres.");
  }

  const email = (
    process.env.FINORA_ADMIN_EMAIL || `${loginName}@finora.local`
  )
    .trim()
    .toLowerCase();

  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const passwordHash = new AdminUsersService(prisma).hashPassword(password);

    const admin = await prisma.admin_users.upsert({
      where: { email },
      update: {
        name: loginName,
        password_hash: passwordHash,
        role: "SUPER_ADMIN",
        active: true,
      },
      create: {
        name: loginName,
        email,
        password_hash: passwordHash,
        role: "SUPER_ADMIN",
        active: true,
      },
    });

    console.log(
      JSON.stringify({
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role,
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
