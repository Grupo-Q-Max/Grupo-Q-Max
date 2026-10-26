require("dotenv/config");

const { PrismaService } = require("C:/Users/RodrigoSantePenhalve/Desktop/finora-experience/apps/api/dist/src/prisma/prisma.service.js");

async function main() {
  const prisma = new PrismaService();

  await prisma.$connect();

  try {
    const loginName =
      process.env.FINORA_ADMIN_LOGIN_NAME;

    if (!loginName) {
      throw new Error(
        "FINORA_ADMIN_LOGIN_NAME ausente."
      );
    }

    const normalized =
      loginName
        .trim()
        .toLowerCase();

    const email =
      normalized + "@finora.local";

    let admin =
      await prisma.admin_users.findUnique({
        where: {
          email: email
        }
      });

    if (admin) {
      admin =
        await prisma.admin_users.update({
          where: {
            id: admin.id
          },

          data: {
            name: loginName,
            active: true
          }
        });
    }
    else {
      admin =
        await prisma.admin_users.create({
          data: {
            name: loginName,
            email: email,
            password_hash:
              "AUTH_MANAGED_BY_NEXT",
            role: "ADMIN",
            active: true
          }
        });
    }

    console.log(
      "FINORA_ADMIN_JSON=" +
      JSON.stringify({
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      })
    );
  }
  finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });