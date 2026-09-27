import {maxHealth,itemFor} from './progression.mjs';
import {createWorld,addPlayer} from './engine.mjs';
import {MAPS,safePoint} from './world.mjs';
export function createStageTest(map,character='warrior',cycle=0,testLevel=1,embers=0,loot=false){
 if(!Number.isInteger(map)||!MAPS[map])throw new Error('Fase inválida');
 const world=createWorld(Math.max(0,Math.min(1000000,Math.floor(Number(cycle)||0))),12345);world.testMap=map;for(const enemy of world.enemies)if(enemy.map<map){enemy.hp=0;enemy.state='dead';}
 if(map>2)world.puzzle={progress:3,solved:true};
 const player=addPlayer(world,'solo',character);const points=Math.max(0,Math.min(1000000,Math.floor(Number(testLevel)||1)-1));Object.keys(player.attributes).forEach((key,i)=>player.attributes[key]=Math.floor(points/5)+(i<points%5?1:0));player.maxHp=maxHealth(player);player.hp=player.maxHp;player.embers=Math.max(0,Math.min(1e15,Number(embers)||0));player.map=map;player.checkpointMap=map;Object.assign(player,safePoint(map,MAPS[map].spawn));world.campfires[map]=true;if(loot)for(const boss of ['malenio','warden','titan'])player.inventory.push(itemFor(world,player,'admin-test',boss));player.message='Teste isolado — sem gravar saves.';return world;
}
