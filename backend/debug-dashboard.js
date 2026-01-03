
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Fetching first tracked email...');
        const email = await prisma.trackedEmail.findFirst();
        if (!email) {
            console.log('No emails found.');
            return;
        }

        console.log('Fetching dashboard data for email ID:', email.id);
        const results = await prisma.trackedEmail.findMany({
            where: { id: email.id },
            include: {
                opens: { orderBy: { openedAt: 'desc' } },
                _count: { select: { opens: true } }
            }
        });

        console.log('Result:', JSON.stringify(results, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
