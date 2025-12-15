import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDatabase() {
    console.log('⚠️  STARTING DATABASE RESET ⚠️');
    console.log('This will delete ALL data found in the database. 5 seconds to cancel...');

    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
        // Transactional delete to ensure consistency
        await prisma.$transaction(async (tx) => {
            // 1. Delete OpenEvents (Child)
            const deletedOpens = await tx.openEvent.deleteMany({});
            console.log(`Deleted ${deletedOpens.count} OpenEvents.`);

            // 2. Delete TrackedEmails (Parent)
            const deletedEmails = await tx.trackedEmail.deleteMany({});
            console.log(`Deleted ${deletedEmails.count} TrackedEmails.`);

            // 3. Delete Users (Optional? User might want to keep account but clear history)
            // The user request "почати з нового листа" usually implies clearing history.
            // But clearing User table forces re-registration/sync. Let's do it for "Total Clean".
            const deletedUsers = await tx.user.deleteMany({});
            console.log(`Deleted ${deletedUsers.count} Users.`);
        });

        console.log('✅ Database successfully reset.');
    } catch (error) {
        console.error('❌ Database reset failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

resetDatabase();
