// Shared by rendering and hazard checks, so visible platforms are safe ground.
export const PLATFORMS=[
 {x:760,y:1680,w:528,h:368},{x:380,y:1280,w:520,h:300},
 {x:1120,y:850,w:540,h:300},{x:650,y:350,w:630,h:280},{x:780,y:0,w:490,h:260},
 {x:700,y:1500,w:160,h:250},{x:700,y:1370,w:610,h:110},
 {x:1200,y:1060,w:130,h:420},{x:1190,y:540,w:120,h:420},{x:965,y:180,w:120,h:270}
];
export const inLava=(map,x,y)=>map===4&&!PLATFORMS.some(p=>x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h);
export function drawTerrain(ctx,map,time=0,stone){
 ctx.save();
 if(map===3){
  ctx.fillStyle='#15141bd9';ctx.fillRect(0,0,660,2048);ctx.fillRect(1388,0,660,2048);
  ctx.fillStyle='#9c8d762a';ctx.fillRect(660,0,728,2048);
  for(let y=100;y<2000;y+=42){ctx.fillStyle='#120f1680';ctx.fillRect(660,y,728,10);ctx.fillStyle='#d5c39b70';ctx.fillRect(660,y+10,728,3);}
  for(const y of [1650,1200,750,300]){ctx.fillStyle='#514d48';ctx.fillRect(660,y,728,100);ctx.strokeStyle='#bc9d61';ctx.lineWidth=3;ctx.strokeRect(675,y+10,698,80);}
  ctx.strokeStyle='#d2ae6b';ctx.lineWidth=9;for(const x of [670,1378]){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,2048);ctx.stroke();}
 }
 if(map===4){
  ctx.fillStyle=`rgba(255,92,8,${.07+.04*Math.sin(time*2)})`;ctx.fillRect(0,0,2048,2048);
  ctx.fillStyle='#332f36';for(const p of PLATFORMS)ctx.fillRect(p.x,p.y,p.w,p.h);
  ctx.save();ctx.beginPath();for(const p of PLATFORMS)ctx.rect(p.x,p.y,p.w,p.h);ctx.clip();
  if(stone?.naturalWidth)ctx.drawImage(stone,0,0,2048,2048);
  for(let y=0;y<2048;y+=64)for(let x=0;x<2048;x+=80){ctx.fillStyle=stone?.naturalWidth?'#20192328':(x/80+y/64)%2?'#4f4748':'#484146';ctx.fillRect(x+2,y+2,76,60);ctx.fillStyle='#c0a98b44';ctx.fillRect(x+3,y+3,74,2);}ctx.restore();
 }
 if(map===5){
  ctx.strokeStyle='#d3a75a88';ctx.lineWidth=9;for(const r of [320,650,810]){ctx.beginPath();ctx.arc(1024,940,r,0,Math.PI*2);ctx.stroke();}
  for(let i=0;i<12;i++){const a=i*Math.PI/6;ctx.fillStyle='#e7ac50';ctx.beginPath();ctx.arc(1024+650*Math.cos(a),940+650*Math.sin(a),10,0,7);ctx.fill();}
 }
 ctx.restore();
}
