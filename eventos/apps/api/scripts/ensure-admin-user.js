const { PrismaClient } = require("../src/generated/prisma/client");

const prisma = new PrismaClient();

async function main() {
  const loginName = process.env.FINORA_ADMIN_LOGIN_NAME;

  if (!loginName) {
    throw new Error("FINORA_ADMIN_LOGIN_NAME ausente.");
  }

  const email =
    `${loginName.toLowerCase()}@finora.local`;

  const existing =
    await prisma.admin_users.findUnique({
      where: {
        email,
      },
    });

  let admin;

  if (existing) {
    admin =
      await prisma.admin_users.update({
        where: {
          id: existing.id,
        },

        data: {
          name: loginName,
          active: true,
        },
      });
  }
  else {
    admin =
      await prisma.admin_users.create({
        data: {
          name: loginName,
          email,
          password_hash:
            "AUTH_MANAGED_BY_NEXT",
          role: "ADMIN",
          active: true,
        },
      });
  }

  console.log(
    JSON.stringify({
      id: admin.id,
      name: admin.name,
      email: admin.email,
    })
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });