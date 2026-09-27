import {progressionStats} from './progression.mjs';
export const SLOTS={helmet:'Elmo / capuz',chest:'Peitoral / manto',gloves:'Luvas',legs:'Calças',boots:'Botas'};
export const WEAPONS={
 sword:{name:'Espada dos Vigias',class:'warrior',damage:24,range:112,cooldown:.43,arc:.25,color:'#e8d2a1',special:'Redemoinho',style:'sweep'},
 spear:{name:'Lança da Alvorada',class:'warrior',damage:28,range:185,cooldown:.65,arc:.84,color:'#c4e6e2',special:'Estocada perfurante',style:'thrust'},
 axe:{name:'Machado das Cinzas',class:'warrior',damage:38,range:100,cooldown:.9,arc:0,color:'#efad76',special:'Ruptura sísmica',style:'slam'},
 staff:{name:'Cajado de Brasas',class:'witch',damage:25,range:220,cooldown:.65,arc:.25,color:'#c4b4ff',special:'Nova arcana',style:'nova'},
 wand:{name:'Varinha do Eclipse',class:'witch',damage:16,range:280,cooldown:.3,arc:.8,color:'#8ad7ff',special:'Raio concentrado',style:'beam'},
 tome:{name:'Grimório do Sol Partido',class:'witch',damage:35,range:170,cooldown:.9,arc:-1,color:'#f8cf87',special:'Círculo solar',style:'nova'}
};
export const ARMOR_SETS={
 warrior:[{name:'Vigia',color:'#a9a9a2',defense:0,power:0,regen:0},{name:'Ferro Solar',color:'#d1a968',defense:3,power:.025,regen:0},{name:'Guardião da Aurora',color:'#f4d782',defense:5,power:.045,regen:.5}],
 witch:[{name:'Aprendiz',color:'#ad8ccb',defense:0,power:0,regen:0},{name:'Tecelã do Eclipse',color:'#83c4d7',defense:2,power:.04,regen:.8},{name:'Oráculo da Aurora',color:'#e8b4f5',defense:3,power:.065,regen:1.5}]
};
export function defaultGear(character){return {weapon:character==='witch'?'staff':'sword',...Object.fromEntries(Object.keys(SLOTS).map(k=>[k,0]))};}
export function normalizeGear(character,input){const gear=defaultGear(character);if(WEAPONS[input?.weapon]?.class===character)gear.weapon=input.weapon;for(const slot of Object.keys(SLOTS))if(Number.isInteger(input?.[slot])&&input[slot]>=0&&input[slot]<=2)gear[slot]=input[slot];return gear;}
export function unlockTier(world){if(world.enemies.some(e=>e.type==='malenio'&&e.hp===0))return 2;return world.enemies.filter(e=>e.hp===0).length>=3?1:0;}
export function equipmentStats(player){const gear=normalizeGear(player.character,player.equipment),sets=ARMOR_SETS[player.character];let defense=0,power=1,regen=18;for(const slot of Object.keys(SLOTS)){const set=sets[gear[slot]];defense+=set.defense;power+=set.power;regen+=set.regen;}const bonus=progressionStats(player);return {defense:Math.min(70,defense+bonus.defense+(bonus.ward?10:0)),power:power*bonus.power*(bonus.solar?1.15:1),regen:regen+Math.min(40,(player.attributes?.vigor||0)*.4),weapon:WEAPONS[gear.weapon]};}
export function equip(world,player,slot,value){
 if(!player||player.hp<=0)throw new Error('Você precisa estar vivo para trocar equipamento.');
 if(slot==='weapon'){if(WEAPONS[value]?.class!==player.character)throw new Error('Arma incompatível com a classe.');}
 else if(!(slot in SLOTS)||!Number.isInteger(value)||value<0||value>unlockTier(world))throw new Error('Peça bloqueada: liberte o Jardim ou derrote Malênio.');
 player.equipment=normalizeGear(player.character,player.equipment);if(slot==='weapon'&&player.lootGear)delete player.lootGear.weapon;player.equipment[slot]=value;return player.equipment;
}
