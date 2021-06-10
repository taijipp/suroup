'use strict';
const _ = require('lodash');
const { Transform } = require("stream");
const { xorsum, addsum, orsum,  hex2bin, hexStringToByte } = require("../checksum.js");

const DEBUG = true;
const HEADER = '7e';
const TYPE = { ESV:'5500' };

const REQ_STATE = '05', CMD_ONE = '04', CMD_HEATER = '08',
      ACK_STATE = '15', ACK_CMD = '14', ACK_HEATER = '18'

//let ratelimit = {};

const hexStringToPacket = (hexString) => {
	let header =  hexString.substr(0, 2);
	let command = hexString.substr(2, 2);
	let length =  hexString.substr(4, 2);

	let len =  parseInt(length, 16);
	let devId = len >= 2?
		hexString.substr(6, 4):'';
	let data = len >= 5?
		hexString.substr(10, 6):'';

	let end = 6+(2*len);
	let src = hexString.substr(0, end);
	let xor = hexString.substr(end, 2);
	let or = hexString.substr(end+2, 2);

	let checksum = {};
	    checksum.xor = xorsum(src);
		checksum.or = orsum(src + checksum.xor);

	let parity = xor==checksum.xor && or==checksum.or;
		
	return { header, command, len, devId, data, xor, or, size:hexString.length, hexString, checksum, parity};
}

const packetToESV = (packet) => {
	const { data } = packet;
	let fanSpeed = parseInt( data.substr(0,2), 16 )+'';
	//let fanSpeed = parseInt( data.substr(0,2), 16 );
	let main  = data.substr(2,2);
	let bypass= data.substr(4,2) == '08';
	return { fanSpeed, main, bypass };
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
			
			if( packet.xor && packet.or ){
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
		/*
			if(
			packet.command == '05' || 
			packet.command == '15'){
				console.log(packet.data);
			} else {
				console.log(packet);
			}
		*/
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
		if( packet.command == ACK_CMD ) {
			if( packet.devId == TYPE.ESV ) {
				_.set(ack, packet.devId, packet);
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
			if( packet.devId == TYPE.ESV ) {
					const { fanSpeed, bypass } = packetToESV(packet);

					const id = packet.devId+'_f';
					const device = {
						type: 'esv',
						id,
						uri: '/homenet/'+id,
						property: {
							switch:fanSpeed>0?'on':'off',
							fanSpeed, fanLevel:fanSpeed, bypass
						}
					};

					_.set(devices, device.id, device);				
			}
		}
		
		this.push();
		callback();
	}
});

const esv = (id, socket) => {
	const [devId, idx] = id.split('_');
	let src = HEADER + CMD_ONE + '05' + devId;

	return {
		set bypass(value) {
			send(socket)(src+'0100'+value=='on'?'06':'03');
		},
		set fanSpeed(value) {

			let fanSpeed = (value & 0xff).toString(16);
			send(socket)(src+'0'+fanSpeed+'00'+(fanSpeed==0?'00':'03'));
		},
		set switch(value) {
			send(socket)(src + value=='off'?'000000':'010003');
		}
	}
}

const send = (socket) => (hexString, checksum=true) => {
	if( checksum ) {
			let xor = xorsum(hexString);
			let or = orsum(hexString+xor);

			hexString = hexString+xor+or;
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

module.exports = {chop, parsing, save, setup, esv};
