/**
 *  suroup-gas
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
	definition (name: "suroup-gas", namespace: "taijipp", author: "taijipp@gmail.com", cstHandler: true, ocfDeviceType: "oic.d.switch") {
		capability "Switch"
		capability "Refresh"
		capability "Actuator"
		capability "Sensor"
	}

	simulator {
		// TODO: define status and reply messages here
	}

	tiles {
		// TODO: define your main and details tiles here
	}
}

// parse events into attributes
def parse(String description) {
	log.debug "Parsing '${description}'"
	// TODO: handle 'switch' attribute
}

// handle commands
def on() {
	log.debug "Executing 'on'"
	// TODO: handle 'on' command
	setProperty("switch", "on")
}

def off() {
	log.debug "Executing 'off'"
	// TODO: handle 'off' command
	setProperty("switch", "off")
}

def sendCommand(options, _callback){
	def myhubAction = new physicalgraph.device.HubAction(options, null, [callback: _callback])
	sendHubCommand(myhubAction)
}

def refresh() {
	// TODO: handle 'refresh' command
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
		log.error "Error!!! ${e}"
	}
}

def refreshCallback(physicalgraph.device.HubResponse hubResponse) {
	def msg
	try {
		msg = parseLanMessage(hubResponse.description)
		log.debug msg.json
		updateProperty("switch", msg.json.property.switch)
	} catch (e) {
		log.error("Exception caught while parsing data: "+e)
	}
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
	sendEvent(name:propertyName, value:propertyValue)
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
