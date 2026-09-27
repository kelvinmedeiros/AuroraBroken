import {createWorld,addPlayer} from './engine.mjs';
import {MAPS,safePoint} from './world.mjs';
export function createStageTest(map,character='warrior'){
 if(!Number.isInteger(map)||!MAPS[map])throw new Error('Fase inválida');
 const world=createWorld();world.testMap=map;for(const enemy of world.enemies)if(enemy.map<map){enemy.hp=0;enemy.state='dead';}
 if(map>2)world.puzzle={progress:3,solved:true};
 const player=addPlayer(world,'solo',character);player.map=map;player.checkpointMap=map;Object.assign(player,safePoint(map,MAPS[map].spawn));world.campfires[map]=true;player.message='Teste isolado — sem gravar saves.';return world;
}
