'use strict'
const _ = require('lodash');
const SmartApp = require('@smartthings/smartapp');
const SmartAppContext = require('@smartthings/smartapp/lib/util/smart-app-context');
let ctx;
class SmartApps extends SmartApp {	
	async _handleCallback(evt, responder) {
		/*if(!ctx)*/ ctx = new SmartAppContext(this, evt);
		return await super._handleCallback(evt, responder);
	}
}

// LowDB {{{
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const adapter = new FileSync(__basedir+'/db.json')
const db = low(adapter)
const defaults = { outlet: [], esv: [], light: [], thermostat: [], gas: [], breaker: [] }; 
db.defaults(defaults).write();
// }}}

const createEvent = (key, value, component='main') => {
	let event;
	switch(key) {
		case 'switch':
			event = {
				component,
				capability:'switch',
				attribute:'switch',
				value:value||'off'
			};
			break;
		case 'fanSpeed':
			event = {
				component,
				capability:'fanSpeed',
				attribute:'fanSpeed',
				value:value||0
			};
			break;
		case 'power':
			event = {
				component,
				capability:'powerMeter',
				attribute:'power',
				value:value||0
			};
			break;
		case 'setTemp':
			event = {
				component,
				capability:'thermostatHeatingSetpoint',
				attribute:'heatingSetpoint',
				value:value||0,
				unit:'C'
			};
			break;
		case 'curTemp':
			event = {
				component,
				capability:'temperatureMeasurement',
				attribute:'temperature',
				value:value||0,
				unit:'C'
			};
			break;
		case 'bypass':
			event = {
				component:'bypass',
				capability:'switch',
				attribute:'switch',
				value:value||'off'
			};
			break;
	}
	return event;
}

devices = new Proxy({}, {
    set: function(target, externalId, value, receiver) {
		const type = _.get(devices, externalId+'.type');
		if(type && ctx && ctx.api && ctx.api.devices){
			const original = _.get(target, externalId+'.property');
			const changed = _.get(value, 'property');

			if( !_.isEqual(original, changed) ){
				const device = db.get(type).find({externalId}).value();
				if(device){
					let events = [];
					const { property } = value;
					_.map(property, (val, key) => {
						if( _.get(original, key) != _.get(changed, key) ){
							events.push(createEvent(key, val));
						}
					});
					ctx.api.devices.createEvents(device.deviceId, events);
				}
			}
		}
        target[externalId] = value;
        return true;
    }
});

const createDevice = async (ctx, configure, profileId, events=[])=>{
	const { id, property } = configure;
	const { locationId, installedAppId } = ctx.api.config;
	
	let device = await ctx.api.devices.create({
		label: id,
		locationId,
		installedAppId,
		externalId: id,
		profileId
	});

	events.push(createEvent('switch', property.switch));
	await ctx.api.devices.createEvents(device.deviceId, events);
	
	return device;
}

const createLight = async (ctx, configure) => await createDevice(ctx, configure, process.env.deviceLight);
const createGasValve = async (ctx, configure) => await createDevice(ctx, configure, process.env.deviceGasValve);
const createBreaker = async (ctx, configure) => await createDevice(ctx, configure, process.env.deviceBreaker);
const createESV = async (ctx, configure)=>{ 
	const { property } = configure;
	
	let events = [
		createEvent('fanSpeed', property.fanSpeed),
		createEvent('bypass', property.bypass)
	];
	
	return await createDevice(ctx, configure, process.env.deviceESV, events);
}
const createOutlet = async (ctx, configure)=>{ 
	const { property } = configure;
	
	let events = [
		createEvent('power', property.power)
	];
	
	return await createDevice(ctx, configure, process.env.deviceOutlet, events);
}
const createThermostat = async (ctx, configure)=>{ 
	const { property } = configure;
	
	let events = [
		createEvent('setTemp', property.setTemp),
		createEvent('curTemp', property.curTemp)
	];
	
	return await createDevice(ctx, configure, process.env.deviceThermostat, events);
}

const setup = async (ctx, promises, configure, type, creator) => {
	const registered = db.get(type).value();
	
	const delete_devices = _.filter(registered, d=>_.map(configure, 'id').indexOf(d.externalId)==-1);
	if( delete_devices ) {
		promises = promises.concat(delete_devices.map(async configure => {
			await ctx.api.devices.delete(configure.deviceId);
			db.get(type).remove(configure).write();
		}));
	}
	
	const create_devices = _.filter(configure, d=>_.map(registered, 'externalId').indexOf(d.id)==-1); 
	if( create_devices ) {
		promises = promises.concat(create_devices.map(async configure => {
			const { deviceId, label:externalId } = await creator(ctx, configure);
			db.get(type).push({deviceId,externalId}).write();
		}));
	}
	
	return promises;
}

const smartapp = new SmartApps()
	.disableCustomDisplayName()
	.appId(process.env.appId)
	.clientId(process.env.clientId)
	.clientSecret(process.env.clientSecret)
	.configureI18n({
		locales: ['en', 'ko'],
		defaultLocale: 'en'
	})
	//.enableEventLogging(1)
	.permissions([
		'i:deviceprofiles:*',
		'r:devices:*',
		'w:devices:*',
		'x:devices:*'
	])
	.page('mainPage', (ctx, page, configData) => {
		page.complete(true);
		
		page.section('pages', section => {
			if(!_.isEmpty(_.filter(devices, {'type':'light'})))
				section.pageSetting('lightPage').page('lightPage').description("");
			if(!_.isEmpty(_.filter(devices, {'type':'outlet'})))
				section.pageSetting('outletPage').page('outletPage').description("");
			if(!_.isEmpty(_.filter(devices, {'type':'thermostat'})))
				section.pageSetting('thermostatPage').page('thermostatPage').description("");
			if(!_.isEmpty(_.filter(devices, {'type':'breaker'})))
				section.pageSetting('breakerPage').page('breakerPage').description("");
			if(!_.isEmpty(_.filter(devices, {'type':'gas'})))
				section.pageSetting('gasPage').page('gasPage').description("");
			if(!_.isEmpty(_.filter(devices, {'type':'esv'})))
				section.pageSetting('esvPage').page('esvPage').description("");
		});
	})
	.page('lightPage', (ctx, page, configData) => {
		const light = _.filter(devices, {'type':'light'});
		
		page.previousPageId('mainPage');
		page.section('ctrl', section => {
			for(let i=0, max=_.size(light); i<max; i++ ){
			section
				.booleanSetting('light-'+light[i].id)
				.defaultValue("true")
				.required(true)
				.name(light[i].id)
				.description("");
			}
		});
		page.section('footer', section => {
			section.pageSetting('mainPage').description("");
			section.style('FOOTER')
		});
	})
	.page('outletPage', (ctx, page, configData) => {
		const outlet = _.filter(devices, {'type':'outlet'});
		
		page.previousPageId('mainPage');
		page.section('ctrl', section => {
			for(let i=0, max=_.size(outlet); i<max; i++ ){
			section
				.booleanSetting('outlet-'+outlet[i].id)
				.defaultValue("true")
				.required(true)
				.name(outlet[i].id)
				.description("");
			}
		});
		page.section('footer', section => {
			section.pageSetting('mainPage').description("");
			section.style('FOOTER')
		});
	})
	.page('thermostatPage', (ctx, page, configData) => {
		const thermostat = _.filter(devices, {'type':'thermostat'});
		
		page.previousPageId('mainPage');
		page.section('ctrl', section => {
			for(let i=0, max=_.size(thermostat); i<max; i++ ){
			section
				.booleanSetting('thermostat-'+thermostat[i].id)
				.defaultValue("true")
				.required(true)
				.name(thermostat[i].id)
				.description("");
			}
		});
		page.section('footer', section => {
			section.pageSetting('mainPage').description("");
			section.style('FOOTER')
		});
	})
	.page('breakerPage', (ctx, page, configData) => {
		const breaker = _.filter(devices, {'type':'breaker'});
		
		page.previousPageId('mainPage');
		page.section('ctrl', section => {
			for(let i=0, max=_.size(breaker); i<max; i++ ){
			section
				.booleanSetting('breaker-'+breaker[i].id)
				.defaultValue("true")
				.required(true)
				.name(breaker[i].id)
				.description("");
			}
		});
		page.section('footer', section => {
			section.pageSetting('mainPage').description("");
			section.style('FOOTER')
		});
	})
	.page('gasPage', (ctx, page, configData) => {
		const gas = _.filter(devices, {'type':'gas'});
		
		page.previousPageId('mainPage');
		page.section('ctrl', section => {
			for(let i=0, max=_.size(gas); i<max; i++ ){
			section
				.booleanSetting('gas-'+gas[i].id)
				.defaultValue("true")
				.required(true)
				.name(gas[i].id)
				.description("");
			}
		});
		page.section('footer', section => {
			section.pageSetting('mainPage').description("");
			section.style('FOOTER')
		});
	})
	.page('esvPage', (ctx, page, configData) => {
		const esv = _.filter(devices, {'type':'esv'});
		
		page.previousPageId('mainPage');
		page.section('ctrl', section => {
			for(let i=0, max=_.size(esv); i<max; i++ ){
			section
				.booleanSetting('esv-'+esv[i].id)
				.defaultValue("true")
				.required(true)
				.name(esv[i].id)
				.description("");
			}
		});
		page.section('footer', section => {
			section.pageSetting('mainPage').description("");
			section.style('FOOTER')
		});
	})
	.updated(async (ctx, updateData) => {
        await ctx.api.subscriptions.delete();
    	await ctx.api.schedules.delete();
                
		let config = {};
		_.map(ctx.config, (d,i) => {
			let [type, id] = _.split(i,'-');
			if(!_.isArray(config[type])) config[type]=[];
			
			if(d[0].stringConfig.value=='true'){
				config[type].push(id);
			}
		});
		
		let promises=[];
		let { light, outlet, thermostat, breaker, esv, gas } = _.groupBy(devices, 'type');
    
		//create Light
		if( config['light'] !== undefined )
			light = _.filter(light, d=>config['light'].indexOf(d.id)>-1);
		promises = await setup(ctx, promises, light, 'light', createLight);
		
		//create Thermostat
		if( config['thermostat'] !== undefined )
			thermostat = _.filter(thermostat, d=>config['thermostat'].indexOf(d.id)>-1);
		promises = await setup(ctx, promises, thermostat, 'thermostat', createThermostat);
		
		//create Outlet
		if( config['outlet'] !== undefined )
			outlet = _.filter(outlet, d=>config['outlet'].indexOf(d.id)>-1);
		promises = await setup(ctx, promises, outlet, 'outlet', createOutlet);
		
		//create Gas Valve
		if( config['gas'] !== undefined )
			gas = _.filter(gas, d=>config['gas'].indexOf(d.id)>-1);
		promises = await setup(ctx, promises, gas, 'gas', createGasValve);
		
		//create Breaker
		if( config['breaker'] !== undefined )
			breaker = _.filter(breaker, d=>config['breaker'].indexOf(d.id)>-1);
		promises = await setup(ctx, promises, breaker, 'breaker', createBreaker);

		//create ESV
		if( config['esv'] !== undefined )
			esv = _.filter(esv, d=>config['esv'].indexOf(d.id)>-1);
		promises = await setup(ctx, promises, esv, 'esv', createESV);		
		
		await Promise.all(promises);
	})
	.uninstalled(async (ctx, uninstallData) => {
        db.setState(defaults).write();
	})
	.deviceCommand('switch/on', (ctx, deviceId, cmd, cmdEvt)=>{		
		const { externalId } = cmdEvt;
		const { type=null } = _.get(devices, externalId);
		if( type=='esv' ){
			_.set(
				Handler[type](externalId, Socket.esv),
				cmd.componentId=='bypass'?'bypass':'switch', 'on');
		} else {
			_.set(
				Handler[type](externalId, Socket.ew11),
				'switch', 'on');
		}
	})
	.deviceCommand('switch/off', (ctx, deviceId, cmd, cmdEvt)=>{
		const { externalId } = cmdEvt;
		const { type=null } = _.get(devices, externalId);
		if( type=='esv' ){
			_.set(
				Handler[type](externalId, Socket.esv),
				cmd.componentId=='bypass'?'bypass':'switch', 'off');
		} else {
			_.set(
				Handler[type](externalId, Socket.ew11),
				'switch', 'off');
		}
	})
	.deviceCommand('thermostatHeatingSetpoint/setHeatingSetpoint', (ctx, deviceId, cmd, cmdEvt)=>{
		const { externalId } = cmdEvt;
		const { type=null } = _.get(devices, externalId);
		const setTemp = cmd.arguments[0];
				
		_.set(
			Handler[type](externalId, Socket.ew11),
			'setTemp', setTemp);
	})
	.deviceCommand('fanSpeed/setFanSpeed', (ctx, deviceId, cmd, cmdEvt)=>{
		const { externalId } = cmdEvt;
		const { type=null, property={} } = _.get(devices, externalId);
		const speed = cmd.arguments[0];
				
		_.set(
			Handler[type](externalId, Socket.esv),
			'fanSpped', speed);
	})

module.exports = smartapp;
