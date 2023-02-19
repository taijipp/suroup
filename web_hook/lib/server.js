require('dotenv').config();
require('./global.js');
require('./suroup.js');

const { connector } = require('./connector');
const express = require('express');
const bodyParser = require('body-parser');

class Webhook {
	constructor(options = {}) {
		this.config =  options;
		this.expressApp = express();
		this.setMiddleWare();
		this.setRoutes();
	}
	setMiddleWare() {
		this.expressApp.use(bodyParser.json({type: 'application/json'}));
	}
	setRoutes() {
		this.expressApp
			.post('/', (req, res) => {
				if(this.isValidToken(req.body.authentication)) {
					connector.handleHttpCallback(req, res)
				}
			});
	}
	isValidToken(authentication) {
		return authentication && authentication.token && authentication.token.length > 0
	}
	launch() {
		const port = process.env && process.env.PORT || 3000;
		const hostname = this.config && this.config.hostname || 'localhost';
		this.expressApp.listen(port, hostname, (err) => {
			if (err) {
				return console.log(err);
			} else {
				return console.log(`Server is running at port ${port}`);
			}
		});
	}
}
module.exports = { Webhook };
