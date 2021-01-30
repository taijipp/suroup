'use strict';
const _ = require('lodash');
const { Transform } = require("stream");
const { xorsum, addsum, hexStringToByte } = require("./checksum.js");

const DEBUG = true;
const HEADER = 'f7';
const TYPE = { LIGHT:'0e', GAS:'12', ELECMETER:'30', DOOR:'31', BREAKER:'33', THERMOSTAT:'36', POWERPLUG:'39', UNKNOWN1:'40', UNKNOWN2:'60' };

const REQ_STATE = '01', REQ_ATTR = '0f', CMD_ONE='41', CMD_ALL='42', ACK_STATE = '81', ACK_ATTR = '8f', ACK_CMD = 'c1';

const hexStringToPacket = (hexString) => {
	let header =	hexString.substring(0,2);
	let devId = 	hexString.substring(2,4);
	let subId = 	hexString.substring(4,6);
	let command =	hexString.substring(6,8);
	let len = 	parseInt(hexString.substring(8,10),16);
	let data =	hexString.substring(10,10+(2*len));
	let src = 	hexString.substring(0, hexString.length-4);
	let xor = 	xorsum(src);
	let add = 	addsum(src+xor);
		
	return { header, devId, subId, command, len, data, xor, add, size:hexString.length, hexString };
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

		for( let i=0, max=find.length-1; i<max; i++){
			this.push( data.substring(find[i].index, find[i+1].index) );
		}

		callback();
	}
});

const parsing = new Transform({
	readableObjectMode: true,
	transform(chunk, encoding, callback) {
		let packet = hexStringToPacket(chunk.toString());
		this.push( packet );

		callback();
	}
});

const save = new Transform({
	readableObjectMode: true,
	writableObjectMode: true,
	transform(packet, encoding, callback) {
		if( packet.devId == TYPE.LIGHT ) {
			const addr = packet.devId + packet.subId
			if( packet.command == ACK_CMD ) {
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
		if( packet.devId == TYPE.LIGHT && packet.command == ACK_STATE ) {
			for(let i=1, max=packet.len; i<max; i++){
				const id = packet.devId+packet.subId+'_'+i;
				const state = packet.data.substr(i*2, 2);
				const device = {
					type: 'light',
					id,
					uri: '/homenet/'+id,
					state,
					property: {switch:parseInt(state,16)?'on':'off'}
				}

				_.set(devices, device.id, device);
			}
		}

		callback();
	}
});

const typeOf = (id) => {
	const device = _.get(devices, id);
	return device.type;
}

const light = (id) => {
	const [devId, idx] = id.split('_');
	let src = HEADER+devId+CMD_ONE+'03'+_.padStart(idx, 2, '0');

	return {
		command(socket, src) {	
			let xor = 	xorsum(src);
			let add = 	addsum(src+xor);

			send(socket)(src+xor+add);
		},
		set on(socket) {
			this.command(socket, src+'0100');
		},	
		set off(socket) {
			this.command(socket, src+'0000');
		}
	}
}

const send = (socket) => (hexString) => {
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

module.exports = {chop, parsing, save, setup, typeOf, light};
