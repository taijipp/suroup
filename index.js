'use strict'
const _ = require('lodash');
const axios = require('axios');
const express = require('express');

require('dotenv').config();

require('./global.js');
require('./suroup.js');

const smartapp = require('./smartapp.js');

const app = express();
	app.use(express.urlencoded({extended: false}));
	app.use(express.json());

	app.get("/", (req, res) => res.redirect('homenet'));
	app.get ('/homenet', (req, res) => {
		res.send(_.values(devices));
	});
	
	app.post('/', (req, res) => {
		smartapp.handleHttpCallback(req, res);
		const { lifecycle, confirmationData } = req.body;
		if(lifecycle=='CONFIRMATION' && confirmationData.confirmationUrl){

			axios.get(confirmationData.confirmationUrl)
			  .then(response => {
			    console.log(response);
			  })
			  .catch(error => {
			    console.log(error);
			  });	
		}
	});

let port = process.env.port || 30110;
app.listen(port, () => console.log(`Server is up and runngin on port ${port}`));
