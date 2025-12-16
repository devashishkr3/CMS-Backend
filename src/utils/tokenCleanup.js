// const prisma = require('../config/prisma');

// // Cleanup expired blacklisted tokens
// const cleanupExpiredTokens = async () => {
//   try {
//     const now = new Date();
    
//     // Delete all expired blacklisted tokens
//     const result = await prisma.blacklistedToken.deleteMany({
//       where: {
//         expiresAt: {
//           lt: now
//         }
//       }
//     });
    
//     console.log(`Cleaned up ${result.count} expired blacklisted tokens`);
//   } catch (error) {
//     console.error('Error cleaning up expired tokens:', error);
//   }
// };

// // Run cleanup every 24 hours
// const startTokenCleanup = () => {
//   // Run immediately
//   cleanupExpiredTokens();
  
//   // Schedule to run every 24 hours
//   setInterval(cleanupExpiredTokens, 24 * 60 * 60 * 1000); // 24 hours in milliseconds
// };

// module.exports = { startTokenCleanup };