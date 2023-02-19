'use-strict';
const fs = require('fs');
const path = require('path');
const dataDirectory = __dirname+'/..';
const dataFile = path.join(dataDirectory, 'oAuth.json');

module.exports = {
	save(data) {
		fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf-8');
	},
	remove() {
		try {
			fs.unlinkSync(dataFile);
		} catch (err) {
			console.error(err);
		}
	},
	load() {
		try {
			const json = fs.readFileSync(dataFile, 'utf-8');
			return JSON.parse(json);
		} catch (err) {
			return {
				code:{},
				refreshData:{},
				authHeaderData:{},
				tokenIdData:{},
				redirectUri:''
			};
		}
	}
}
