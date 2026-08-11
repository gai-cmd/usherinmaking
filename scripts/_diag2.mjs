import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
config({ path: '.env.local' }); config();
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
const rows = await prisma.photo.findMany({ where:{igAccount:'main', takenAt:{gte:new Date('2026-06-26'),lt:new Date('2026-06-28')}}, select:{id:true,shootKey:true,shootOrder:true,width:true,height:true,takenAt:true,lowRes:true}, orderBy:[{shootKey:'asc'},{shootOrder:'asc'}] });
for (const r of rows) console.log(r.id.slice(0,8), r.takenAt.toISOString().slice(0,10), `${r.width}x${r.height}`, 'shoot=', (r.shootKey||'').slice(-8), 'ord=', r.shootOrder, r.lowRes?'[low]':'');
console.log('---');
// 공개 갤러리 카드 수 = shootKey 묶음 수
const all = await prisma.photo.findMany({where:{igAccount:'main',status:'PUBLISHED'},select:{shootKey:true,id:true}});
const keys = new Set(all.map(r=>r.shootKey??`single:${r.id}`));
console.log('main 공개 사진', all.length, '→ 갤러리 카드(촬영 묶음)', keys.size);
await prisma.$disconnect();
