'use strict'
const _ = require('lodash');
const { connect } = require('net');

const type = process.env.type;
const reconnectDelay = Number(process.env.socket_reconnect_delay || 5000);

const connectSocket = ({ name, socketKey, options, modulePath, handlerKeys }) => {
	if( !options.host || !options.port || !type ) {
		return;
	}

	let reconnectTimer = null;

	const scheduleReconnect = () => {
		if( reconnectTimer ) {
			return;
		}

		Socket[socketKey] = null;
		console.log(`${name} - reconnecting in ${reconnectDelay}ms.`);
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			openSocket();
		}, reconnectDelay);
	};

	const openSocket = () => {
		const resolvedPath = require.resolve(modulePath);
		delete require.cache[resolvedPath];

		const lib = require(modulePath);
		const { chop, parsing, save, setup } = lib;

		_.assign( Handler, _.pick( lib , handlerKeys));

		const socket = connect(options);
		Socket[socketKey] = socket;

		socket.on('connect', () => console.log(`${name} - connected [${options.host}:${options.port}]`));
		socket.on('end', () => console.log(`${name} - disconnected. [end]`));
		socket.on('close', hadError => {
			console.log(`${name} - disconnected. [close${hadError?':error':''}]`);
			scheduleReconnect();
		});
		socket.on('error', err => {
			console.log(`${name} - error`);
			console.error(err);
		});
		socket.on('timeout', () => {
			console.log(`${name} - connection timeout.`);
			socket.destroy(new Error(`${name} connection timeout`));
		});
		socket.setTimeout(10000);
		socket.setKeepAlive(true, 9000);

		[chop, parsing, save, setup].forEach(stream => {
			stream.on('error', err => {
				console.log(`${name} - stream error`);
				console.error(err);
				socket.destroy(err);
			});
		});

		socket
			.pipe(chop)
			.pipe(parsing)
			.pipe(save)
			.pipe(setup);
	};

	Socket[socketKey] = null;
	openSocket();
};

const EW11 = {
	host:process.env.ew11_host,
	port:process.env.ew11_port
};
connectSocket({
	name:'EW11',
	socketKey:'ew11',
	options:EW11,
	modulePath:__dirname+'/lib/'+type+'.js',
	handlerKeys:['light', 'thermostat', 'outlet', 'gas', 'breaker']
});

const ESV = {
	host:process.env.esv_host,
	port:process.env.esv_port
};
connectSocket({
	name:'ESV',
	socketKey:'esv',
	options:ESV,
	modulePath:__dirname+'/lib/esv/'+type+'.js',
	handlerKeys:['esv']
});
