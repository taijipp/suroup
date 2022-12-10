'use strict';
const _ = require('lodash');
const { Transform } = require("stream");
const { xorsum, addsum, hex2bin, hexStringToByte } = require("./checksum.js");

const DEBUG = true;
const HEADER = 'f7';
const TYPE = { LIGHT:'0e', GAS:'12', ELECMETER:'30', DOOR:'31', BREAKER:'33', THERMOSTAT:'36', POWEROUTLET:'39', UNKNOWN1:'40', UNKNOWN2:'60' };

const REQ_STATE='01', REQ_ATTR='0f', CMD_ONE='41', CMD_ALL='42', CMD_THERMOSTAT=['43','44','45','46','47'], CMD_BREAKER='43', CMD_ELEVATOR='44',
      ACK_STATE='81', ACK_ATTR='8f', ACK_CMD='c1', ACK_THERMOSTAT = ['c3','c4','c5','c6','c7'], ACK_BREAKER='c3', ACK_ELEVATOR='c4';

let ratelimit = {};

const hexStringToPacket = (hexString) => {
	let header =  hexString.substring(0, 2);
	let devId =   hexString.substring(2, 4);
	let subId =   hexString.substring(4, 6);
	let command = hexString.substring(6, 8);

	let len =  parseInt(hexString.substring(8, 10), 16);
	let end =  10+(2*len);
	let data = hexString.substring(10, end);

	let src = hexString.substring(0, end);
	let xor = hexString.substring(end, end+2);
	let add = hexString.substring(end+2, end+4);
	if( add.length < 2 ) add = '';

	let checksum = {};
	    checksum.xor = xorsum(src);
	    checksum.add = addsum(src + checksum.xor);
	
	let parity = xor==checksum.xor && add==checksum.add;
		
	return { header, devId, subId, command, len, data, xor, add, size:hexString.length, hexString, checksum, parity };
}

const packetToThermostat = (packet) => {
	const { data } = packet;
	let err = data.substring(0,2);
	let heating =  data.substring(2,4);
	let outing =   data.substring(4,6);
	let reservation = data.substring(6,8);
	let hotwater = data.substring(8,10);
	let temperature = data.substring(10, data.length);

	let table = []
		table.push(hex2bin(heating));
		table.push(hex2bin(outing));
		table.push(hex2bin(reservation));
		table.push(hex2bin(hotwater));

	const thermostats = [];
	const count = table.length;
	for( let i=0, pad=8; i < pad; i++ ){
		let check='';
		for ( let j=0; j < count; j++ ) {
			check+=table[j].substr(pad-i-1, 1);
		}
		if( parseInt(check) > 0 ){
			let mode;
			switch (check) {
				case '1000': default: 
					//mode='heating'; break;
					mode='heat'; break;
				case '0100': 
					//mode='outing'; break;
					mode='off'; break;
				case '0010': 
					mode='reservation'; break;
				case '0001': 
					mode='hotwater'; break;
			}

			let setTemp = parseInt(temperature.substr(i*4, 2), 16);
			let curTemp = parseInt(temperature.substr((i*4)+2, 2), 16);

			thermostats.push({mode, setTemp, curTemp});
		}
	}

	return { err, heating, outing, reservation, hotwater, temperature, thermostats };
}

const packetToOutlet = (packet) => {
	const err_size = 2;
	const dev_size = 6;

	const { data } = packet;
	const sub_length = (data.length-err_size)/dev_size;

	let err = data.substring(0, err_size);
	let outlets = [];
	for( let i=0; i<sub_length; i++ ) {
		let dev = data.substr(err_size+(i*dev_size), dev_size );
		let state = parseInt(dev.substr(0,1)) % 2;
		let power = parseInt(dev.substr(1,5)) / 10;
		outlets.push({ state, power });
	}

	return { err, outlets };
}

const chop = new Transform({
	transform(chunk, encoding, callback) {
		let data = chunk.toString('hex');
		let keys = new RegExp(`(${HEADER})`,'g');
		let find = [...data.matchAll(keys)];

		if( find.length > 0 ){
			let mock = [null, null];
			    mock.index = data.length;
			    mock.input = data;
			find.push(mock);
		}

		let keep = '';
		for( let i=0, max=find.length-1; i<max; i++){
			let source = keep + data.substring(find[i].index, find[i+1].index);
			let packet = hexStringToPacket(source);
			
			if( packet.xor && packet.add ){
				keep = '';
				this.push( source );
			} else {
				keep = source;
			}
		}

		callback();
	}
});

const parsing = new Transform({
	readableObjectMode: true,
	transform(chunk, encoding, callback) {
		let packet = hexStringToPacket(chunk.toString());
		if( packet.parity ){
			this.push( packet );
		} else {
			console.error('parity error :: ', packet);
		}

		callback();
	}
});

const save = new Transform({
	readableObjectMode: true,
	writableObjectMode: true,
	transform(packet, encoding, callback) {
		const addr = packet.devId + packet.subId;
		if( packet.command == ACK_CMD ) {
			if( packet.devId == TYPE.LIGHT ) {
				_.set(ack, addr, packet);
			} else 
			if( packet.devId == TYPE.POWEROUTLET ) {
				_.set(ack, addr, packet);
			} else 
			if( packet.devId == TYPE.GAS ) {
				_.set(ack, addr, packet);
			}
			if( packet.devId == TYPE.BREAKER ) {
				_.set(ack, addr, packet);
			}

		} else
		if( ACK_THERMOSTAT.indexOf( packet.command ) > -1 ) {
			if( packet.devId == TYPE.THERMOSTAT ) {
				_.set(ack, addr, packet);
			}
		}

		this.push( packet );
		callback();
	}
});

const setup = new Transform({
	writableObjectMode: true,
	transform(packet, encoding, callback) {
		if( packet.command == ACK_STATE ) {
			if( packet.devId == TYPE.LIGHT ) {
				for(let i=1, max=packet.len; i<max; i++){
					const id = packet.devId+packet.subId+'_'+i;
					const state = packet.data.substr(i*2, 2);
					const device = {
						type: 'light',
						id,
						property: {
							switch:parseInt(state, 16)?'on':'off'
						}
					}

					_.set(devices, device.id, device);
				}
			} else
			if( packet.devId == TYPE.THERMOSTAT ) {
				const { thermostats } = packetToThermostat(packet);
				for(let i=0, max=thermostats.length; i<max; i++){
					const { mode, setTemp, curTemp } = thermostats[i];
					const id = packet.devId+packet.subId+'_'+(i+1);
					const device = {
						type: 'thermostat',
						id,
						property: {
							switch:mode=='heat'?'on':'off',
							mode, setTemp, curTemp
						}
					};

					_.set(devices, device.id, device);
				}
			} else
			if( packet.devId == TYPE.POWEROUTLET ) {
				const { outlets } = packetToOutlet(packet);
				for(let i=0, max=outlets.length; i<max; i++){
					const { state, power } = outlets[i];
					let id = packet.devId;
					if( packet.subId[1] == 'f'){
						id += ( packet.subId[0]+(i+1)+'_f' );
					} else {
						id += ( packet.subId+'_f' );
					}
					const device = {
						type: 'outlet',
						id,
						property: {
							switch:parseInt(state, 16)?'on':'off',
							power
						}
					};

					if( _.get(ratelimit, id, 0) < Number(Date.now()) ) {
						ratelimit[id] = Number(Date.now()) + 15000;
						_.set(devices, device.id, device);
					}
				}
					
			} else
			if( packet.devId == TYPE.GAS ) {
				const id = packet.devId+packet.subId+'_f';
				const state = packet.data[3] == '1';
				const device = {
					type: 'gas',
					id,
					property: {
						switch:state?'on':'off'
					}
				};

				_.set(devices, device.id, device);
			} else
			if( packet.devId == TYPE.BREAKER ) {
				const id = packet.devId+packet.subId+'_f';
				const flag = hex2bin(packet.data[3], 4);
				const state = flag[1] == '1';

				const device = {
					type: 'breaker',
					id,
					property: {
						switch:state?'on':'off'
					}
				};

				_.set(devices, device.id, device);
			}

		}

		callback();
	}
});

const light = (id, socket) => {
	const [devId, idx] = id.split('_');
	let src = HEADER+devId+CMD_ONE+'03'+_.padStart(idx, 2, '0');

	return {
		set switch(value) {
			send(socket)(src + (value=='on'?'0100':'0000'));
		}
	}
}

const thermostat = (id, socket) => {
	const [devId, idx] = id.split('_');
	let src = HEADER;
	if( devId[3] == 'f' ) { //device group
		let groupId = devId[2];
		src += (TYPE.THERMOSTAT+groupId+idx);
	} else { //device one
		src += devId;
	}

	return {
		set switch(value) {
			send(socket)(src + (value=='on'?'430101':'450101'));
		},
		set setTemp(temp) {
			send(socket)(src + '4401' + (temp & 0xff).toString(16));
		}
	}
}

const outlet = (id, socket) => {
	const [ devId ] = id.split('_');
	let src = HEADER+devId+CMD_ONE+'01';

	return {
		set switch(value) {
			send(socket)(src + (value=='on'?'11':'10'));
		}
	}
}

const gas = (id, socket) => {
	const [ devId ] = id.split('_');
	let src = HEADER+devId+CMD_ONE+'0100';

	return {
		set switch(value) {
			if( value=='off' ){
				send(socket)(src);
			}
		}
	}
}

const breaker = (id, socket) => {
	const [ devId ] = id.split('_');
	let src = HEADER+devId+CMD_ONE+'01';

	return {
		set switch(value) {
			send(socket)(src + (value=='on'?'01':'00'));
		}
	}
}


const send = (socket) => (hexString, checksum=true) => {
	if( checksum ) {
			let xor = xorsum(hexString);
			let add = addsum(hexString+xor);

			hexString = hexString+xor+add;
	}

	const packet = hexStringToPacket(hexString);
	const addr = packet.devId+packet.subId;

	_.unset(ack, addr);
	let count = 0;

	function intervalFunc() {
		let response = _.get(ack, addr);
		if(!_.isEmpty(response) || count >= 7) {
			_.unset(ack, addr);
			clearInterval(this);
		} else {
			count++;
			socket.write(hexStringToByte(hexString));
		}
	}
	setInterval(intervalFunc, 100);
}

module.exports = {chop, parsing, save, setup, light, thermostat, outlet, gas, breaker, send };
