import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
config({ path: '.env.local' }); config();
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
const rows = await prisma.photo.findMany({ where:{status:'PUBLISHED'}, select:{id:true,igAccount:true,igMediaId:true,shootKey:true,shootOrder:true,width:true,height:true,lowRes:true,takenAt:true,createdAt:true,slug:true} });
const m = new Map();
for (const r of rows) { if(!r.shootKey) continue; const k=`${r.igAccount}|${r.shootKey}|${r.shootOrder}`; m.set(k,[...(m.get(k)||[]),r]); }
const collide=[...m.entries()].filter(([,g])=>g.length>1);
let extra=0; const byAcct={};
for (const [k,g] of collide){ extra+=g.length-1; const a=k.split('|')[0]; byAcct[a]=(byAcct[a]||0)+g.length-1; }
console.log('같은 (계정,게시물,순번) 충돌 묶음:', collide.length, '| 잉여 장수:', extra, '| 계정별', JSON.stringify(byAcct));
console.log('\n표본 12건:');
for (const [k,g] of collide.slice(0,12)){
  console.log(' 묶음', k.split('|')[0], k.split('|')[1].slice(-8), 'ord', k.split('|')[2]);
  for (const r of g) console.log('   ', r.id.slice(0,8), `${r.width}x${r.height}`, r.lowRes?'[low]':'    ', 'ig=',(r.igMediaId||'').slice(-8), 'created=', r.createdAt.toISOString().slice(0,16));
}
// 해상도 차이 유무
let sameSize=0, diffSize=0;
for (const [,g] of collide){ const s=new Set(g.map(r=>`${r.width}x${r.height}`)); s.size===1?sameSize++:diffSize++; }
console.log('\n해상도 동일 묶음', sameSize, '| 해상도 다른 묶음', diffSize);
await prisma.$disconnect();
