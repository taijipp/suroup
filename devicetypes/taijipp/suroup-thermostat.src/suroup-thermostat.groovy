/**
 *  suroup-thermostat
 *
 *  Copyright 2021 taijipp@gmail.com
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 *  in compliance with the License. You may obtain a copy of the License at:
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software distributed under the License is distributed
 *  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License
 *  for the specific language governing permissions and limitations under the License.
 */
metadata {
	definition (name: "suroup-thermostat", namespace: "taijipp", author: "taijipp@gmail.com", cstHandler: true, ocfDeviceType: "oic.d.thermostat") {
		capability "Switch"
		capability "Actuator"
		capability "Temperature Measurement"
		capability "Thermostat Mode"
		capability "Thermostat Heating Setpoint"
		capability "Refresh"
		capability "Sensor"
	}

	simulator {
		// TODO: define status and reply messages here
	}

	tiles {
		// TODO: define your main and details tiles here
	}
}

def installed() {
	log.debug "installed()"
}

// parse events into attributes
def parse(String description) {
	log.debug "Parsing '${description}'"
	// TODO: handle attributes
}

// handle commands
def setHeatingSetpoint(setTemp) {
	setProperty("setTemp", "${setTemp}")
}

def off() {
	log.debug "Executing 'off'"
	setProperty("mode", "off")
}

def on() {
	heat()
}

def heat() {
	log.debug "Executing 'heat'"
	setProperty("mode", "heat")
}

def setThermostatMode(mode) {
	setProperty("mode", "${mode}")
}

def sendCommand(options, _callback){
	def myhubAction = new physicalgraph.device.HubAction(options, null, [callback: _callback])
	sendHubCommand(myhubAction)
}

def refresh() {
	log.debug "Executing 'refresh'"
	try{
		def options = [
			"method": "GET",
			"path": state.path,
			"headers": [
				"HOST": state.address,
				"Content-Type": "application/json"
			]
		]
		sendCommand(options, refreshCallback)
	} catch(e) {
		log.error "Refresh Error!!! ${e}"
	}
}

def refreshCallback(physicalgraph.device.HubResponse hubResponse) {
	def msg
	try {
		msg = parseLanMessage(hubResponse.description)
		log.debug msg.json

		updateProperty("mode", msg.json.property.mode)
		updateProperty("setTemp", msg.json.property.setTemp)
		updateProperty("curTemp", msg.json.property.curTemp)
	} catch (e) {
		log.error("Exception caught while parsing data: "+e)
	}
}

def init(data) {
	sendEvent(name: "supportedThermostatModes", value: ["heat", "off"])
}

def setUrl(String url){
	log.debug "URL >> ${url}"
	state.address = url
}

def setPath(String path){
	log.debug "path >> ${path}"
	state.path = path
}

def updateProperty(propertyName, propertyValue) {
	switch(propertyName) {
		case "mode":
			sendEvent(name: "thermostatMode", value: propertyValue)
			if (propertyValue == "off") {
				sendEvent(name:"switch", value:"off")
			} else {
				sendEvent(name:"switch", value:"on")
			}
			break
		case "setTemp":
			sendEvent(name: "heatingSetpoint", value: propertyValue)
			break
		case "curTemp":
			sendEvent(name: "temperature", value: propertyValue)
			break
		default:
			log.debug "UNKNOWN PROPERTY!!"
	}
}

def setProperty(String name, String value) {
	try{    
		def options = [
			"method": "PUT",
			"path": state.path + "/" + name + "/" + value,
			"headers": [
				"HOST": state.address,
				"Content-Type": "application/json"
			]
		]
		sendCommand(options, setPropertyCallback)
	} catch(e) {
		log.error "Error!!! ${e}"
	}
}

def setPropertyCallback(physicalgraph.device.HubResponse hubResponse) {
	def msg
	try {
		msg = parseLanMessage(hubResponse.description)
		log.debug msg.json
	} catch (e) {
		log.error("Exception caught while parsing data: "+e);
	}
}
