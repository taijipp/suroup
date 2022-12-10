'use strict'
const _ = require('lodash');

const type = process.env.type;
const EW11 = {
	host:process.env.ew11_host,
	port:process.env.ew11_port
};
if( EW11.host && EW11.port && type ) {
	const { connect } = require('net');

	const lib = require(__dirname+'/lib/'+type+'.js');
	const { chop, parsing, save, setup } = lib

	_.assign( Handler, _.pick( lib , ['light', 'thermostat', 'outlet', 'gas', 'breaker']));

	let ew11 = connect(EW11);
    	ew11.on('connect', () => console.log(`EW11 - connected [${EW11.host}:${EW11.port}]`));
    	ew11.on('end', () => console.log('EW11 - disconnected. [end]')); 
    	ew11.on('close', () => {
    		console.log('EW11 - disconnected. [close]');
    	}); 
    	ew11.on('error', err => {
			console.log('EW11 - error');
			console.error(err);
			process.exit(0);
		});
    	ew11.on('timeout', () => console.log('EW11 - connection timeout.'));
		ew11.setTimeout(10000);
		ew11.setKeepAlive(true, 9000);
	
	    ew11
			.pipe(chop)
			.pipe(parsing)
			.pipe(save)
			.pipe(setup);

	Socket.ew11 = ew11;
}

const ESV = {
	host:process.env.esv_host,
	port:process.env.esv_port
};
if( ESV.host && ESV.port && type ) {
	const { connect } = require('net');

	const lib = require(__dirname+'/lib/esv/'+type+'.js');
	const { chop, parsing, save, setup } = lib;

	_.assign( Handler, _.pick( lib , ['esv']));

	let esv = connect(ESV);
    	esv.on('connect', () => console.log(`ESV - connected [${ESV.host}:${ESV.port}]`));
    	esv.on('end', () => console.log('ESV - disconnected. [end]')); 
    	esv.on('close', () => {
    		console.log('ESV - disconnected. [close]');
    	}); 
    	esv.on('error', err => {
			console.log('ESV - error');
			console.error(err);
			process.exit(0);
		});
    	esv.on('timeout', () => console.log('ESV - connection timeout.'));
		esv.setTimeout(10000);
		esv.setKeepAlive(true, 9000);
	
	    esv
			.pipe(chop)
			.pipe(parsing)
			.pipe(save)
			.pipe(setup);

	Socket.esv = esv;
}
