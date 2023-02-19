"use strict";
const { SchemaConnector, StateUpdateRequest } = require("st-schema");

const _ = require('lodash');
const DTH = require('./dth');
const db = require('./db')

const { client_id, client_secret } = process.env;

const createEvent = (key, value, component='main') => {
	let event;
	switch(key) {
		case 'switch':
			event = {
				component,
				capability:'st.switch',
				attribute:'switch',
				value:value||'off'
			};
			break;
		case 'fanSpeed':
			event = {
				component,
				capability:'st.fanSpeed',
				attribute:'fanSpeed',
				value:value||0
			};
			break;
		case 'power':
			event = {
				component,
				capability:'st.powerMeter',
				attribute:'power',
				value:value||0
			};
			break;
		case 'setTemp':
			event = {
				component,
				capability:'st.thermostatHeatingSetpoint',
				attribute:'heatingSetpoint',
				value:value||0,
				unit:'C'
			};
			break;
		case 'curTemp':
			event = {
				component,
				capability:'st.temperatureMeasurement',
				attribute:'temperature',
				value:value||0,
				unit:'C'
			};
			break;
		case 'bypass':
			event = {
				component:'bypass',
				capability:'st.switch',
				attribute:'switch',
				value:value||'off'
			};
			break;
	}
	return event;
}

devices = new Proxy({}, {
    set: async function(target, externalId, value, receiver) {
		try {
			const type = _.get(devices, externalId+'.type');
			if(type && client_id && client_secret){
				const original = _.get(target, externalId+'.property');
				const changed = _.get(value, 'property');

				if( !_.isEqual(original, changed) ){
					for (const item of db.getCallbacks()) {
						const updateRequest = new StateUpdateRequest(client_id, client_secret);
						const deviceState = {
							externalDeviceId: externalId,
							states:[]
							};
					
						const { property } = value;
						_.map(property, (val, key) => {
							if( _.get(original, key) != _.get(changed, key) ){
								deviceState.states.push(createEvent(key, val));
							}
						});

						let { accessToken, callbackAuthentication, callbackUrls } = item;
						const result = await updateRequest.updateState(callbackUrls, callbackAuthentication, [deviceState], async(refreshCallbackAuthentication) => {
							callbackAuthentication = refreshCallbackAuthentication;
							db.addCallback(accessToken, {callbackAuthentication, callbackUrls});
						}).then(res => {return res.json()});
					}
				}
			}
		} catch (error) {
			console.error('Set Devices Error', error);
		}
        target[externalId] = value;
        return true;
    }
});

const connector = new SchemaConnector()
	.clientId(client_id)
	.clientSecret(client_secret)
	.discoveryHandler((accessToken, response) =>{
		_.map(devices, device => {
			if(DTH[device.type]){
				let dev = response
					.addDevice(device.id, device.id, DTH[device.type])
					.manufacturerName('Suroup')
					.modelName('Suroup '+device.type);
			} else {
				console.log('deviceprofile not found : '+device.type);
			}
		});	
	})
	.stateRefreshHandler((accessToken, response) => {
		_.map(devices, device => {
			const { id, states } = device;
			response.addDevice(id, states); 
		});
	})
	.commandHandler((accessToken, response, st_devices) => {
		st_devices.map(({ externalDeviceId, deviceCookie, commands }) => {
			const parsedDeviceCookie =  Array.isArray(deviceCookie) ? deviceCookie : [deviceCookie];

			const { type=null } = _.get(devices, externalDeviceId);
			const sock = type!='esv'?Socket.ew11:Socket.esv;

			_.map(commands, cmd=>{

				let attribute, value, attr, unit;
				switch(cmd.capability) {
					case 'st.switch':
						attribute = cmd.component=='bypass'?'bypass':'switch';
						attr = 'switch';
						value = cmd.command;
					break;
					case 'st.thermostatHeatingSetpoint':
						attribute = 'setTemp';
						attr = 'heatingSetpoint';
						value = cmd.arguments[0];
						unit = 'C';
					break;
					case 'st.fanSpeed':
						attribute = 'fanSpeed';
						attr = 'fanSpeed';
						value = cmd.arguments[0];
					break;
				}
				if( attribute && typeof value !== 'undefined' ){
					_.set(Handler[type](externalDeviceId, sock), attribute, value);
	
					let device = response.addDevice(externalDeviceId);
						device.addState(cmd.component, cmd.capability, attr, value, unit);
				}
			});
	
		});
	})
	.callbackAccessHandler((accessToken, callbackAuthentication, callbackUrls) => {
		db.addCallback(accessToken, {callbackAuthentication, callbackUrls});
	})
	.integrationDeletedHandler(accessToken => {
		db.removeCallback(accessToken);
	})

module.exports = {
	connector,
	createEvent
};
