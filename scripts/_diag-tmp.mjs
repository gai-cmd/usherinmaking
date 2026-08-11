import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
config({ path: '.env.local' }); config();
const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
const rows = await prisma.photo.findMany({ select:{id:true,igMediaId:true,caption:true,takenAt:true,shootKey:true,status:true,igAccount:true,originalUrl:true,width:true,height:true} });
console.log('전체', rows.length, '| 상태별', JSON.stringify(rows.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{})));
console.log('계정별', JSON.stringify(rows.reduce((a,r)=>(a[r.igAccount]=(a[r.igAccount]||0)+1,a),{})));
// 같은 캡션+같은 촬영시각이 여러 건 = 같은 게시물이 두 번 들어온 흔적
const byCap = new Map();
for (const r of rows) { const k = `${r.takenAt.toISOString()}|${(r.caption||'').slice(0,80)}`; byCap.set(k,[...(byCap.get(k)||[]),r]); }
const dupPosts = [...byCap.values()].filter(g=>g.length>1);
console.log('같은 캡션+시각 묶음:', dupPosts.length, '| 그 안의 총 장수', dupPosts.reduce((a,g)=>a+g.length,0));
// shootKey 별 장수 분포
const byShoot = new Map();
for (const r of rows) { const k=r.shootKey??`single:${r.id}`; byShoot.set(k,(byShoot.get(k)||0)+1); }
const sizes = [...byShoot.values()].sort((a,b)=>b-a);
console.log('shootKey 묶음 수', byShoot.size, '| 최대 장수', sizes[0], '| 상위10', sizes.slice(0,10).join(','));
// 같은 originalUrl 이 두 행에?
const byUrl = new Map();
for (const r of rows) byUrl.set(r.originalUrl,(byUrl.get(r.originalUrl)||0)+1);
console.log('같은 originalUrl 중복 행:', [...byUrl.values()].filter(v=>v>1).length);
// igMediaId 없는(수동/네이버) 행
console.log('igMediaId 없는 행:', rows.filter(r=>!r.igMediaId).length);
await prisma.$disconnect();
