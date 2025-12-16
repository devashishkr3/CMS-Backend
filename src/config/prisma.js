// // // const { PrismaClient } = require("@prisma/client");
// // // const prisma = new PrismaClient();

// // // module.exports = prisma;

// // const { PrismaClient } = require("@prisma/client");

// // const prisma = new PrismaClient({
// //   log: process.env.NODE_ENV === "development"
// //     ? ["query", "error", "warn"]
// //     : ["error"],
// // });

// // module.exports = prisma;

// const { PrismaClient } = require("@prisma/client");

// const prisma = new PrismaClient({
//   __internal: {
//     engine: {
//       type: "binary",
//     },
//   },
// });

// module.exports = prisma;


const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

module.exports = prisma;
