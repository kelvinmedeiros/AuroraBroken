import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LANGUAGE_KEY,readLanguage,setLanguage,t} from '../client/i18n.mjs';
import {MAPS,ENEMY_TYPES,RUNES,portalsOf} from '../client/world.mjs';
import {WEAPONS,ARMOR_SETS} from '../client/equipment.mjs';
import {createWorld,addPlayer,interact,objective} from '../client/engine.mjs';

test('language preference persists independently of campaign data and tolerates unavailable storage',()=>{
 const data=new Map([['campaign','untouched']]),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
 assert.equal(readLanguage(storage),'pt-BR');setLanguage('en',storage);assert.equal(readLanguage(storage),'en');assert.equal(data.get('campaign'),'untouched');assert.equal(data.get(LANGUAGE_KEY),'en');
 setLanguage('invalid',storage);assert.equal(readLanguage(storage),'pt-BR');const denied={getItem(){throw Error();},setItem(){throw Error();}};
 assert.equal(readLanguage(denied),'pt-BR');assert.doesNotThrow(()=>setLanguage('en',denied));assert.equal(t('Guerreiro'),'Warrior');setLanguage('pt-BR');assert.equal(t('Guerreiro'),'Guerreiro');
});
test('maps, enemies, gear and server events have translations without mutating shared state',()=>{
 setLanguage('en');const strings=[...MAPS.flatMap(m=>[m.name,...portalsOf(m.id).map(p=>p.label)]),...RUNES.map(r=>r.label),...Object.values(ENEMY_TYPES).flatMap(e=>[e.name,e.reward]),...Object.values(WEAPONS).flatMap(w=>[w.name,w.special]),...Object.values(ARMOR_SETS).flat().map(s=>s.name)];
 for(const text of strings)assert.notEqual(t(text),text,text);
 const world=createWorld(),p=addPlayer(world,'a');const original=JSON.stringify(world);assert.match(t(objective(world)),/^Free the Garden/);assert.equal(JSON.stringify(world),original);
 Object.assign(p,{map:2,x:1024,y:1650,portalCd:0});interact(world,p);assert.match(t(p.message),/MOON.*EMBER.*SUN/);assert.match(p.message,/LUA/);
 assert.equal(t('Elmo · Guardião da Aurora (bloqueado)'),'Helmet · Dawn Guardian (locked)');assert.equal(t('E · Ativar Brasa'),'E · Activate Ember');assert.equal(t('Energia 52 · Q pronto · F 1.2s'),'Energy 52 · Q ready · F 1.2s');
 assert.equal(t('Salvo · Minha Jornada Sol'),'Saved · Minha Jornada Sol');assert.equal(t('Sala LUA-SOL · 2/4'),'Room LUA-SOL · 2/4');setLanguage('pt-BR');
});
test('every static player UI text and accessibility label is translated or language-neutral',()=>{
 const html=readFileSync(new URL('../client/index.html',import.meta.url),'utf8');
 const strings=[...html.matchAll(/>([^<>]+)</g)].map(m=>m[1].trim()).filter(Boolean);
 strings.push(...[...html.matchAll(/(?:aria-label|title|placeholder|alt)="([^"]+)"/g)].map(m=>m[1]));
 const neutral=new Set(['A','✦','Solo','Saves','J','M','☰','WASD','Shift','E','↑','←','↓','→','Q','F','Idioma / Language','Português','English','AURORABROKEN','AuroraBroken','01','02','×']);
 setLanguage('en');for(const source of strings)if(!neutral.has(source))assert.notEqual(t(source),source,source);setLanguage('pt-BR');
});
