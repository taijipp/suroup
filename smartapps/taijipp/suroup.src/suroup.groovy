/**
 *  suroup
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
 *
 */
definition(
	name: "suroup",
	namespace: "taijipp",
	author: "taijipp@gmail.com",
	description: "connect EW11 and SmartThings",
	category: "My Apps",
	iconUrl: "https://user-images.githubusercontent.com/4987449/107354933-22102980-6b12-11eb-8230-d9e52ac36ada.png",
	iconX2Url: "https://user-images.githubusercontent.com/4987449/107354933-22102980-6b12-11eb-8230-d9e52ac36ada.png",
	iconX3Url: "https://user-images.githubusercontent.com/4987449/107354933-22102980-6b12-11eb-8230-d9e52ac36ada.png")


preferences {
	page(name: "settingPage")
	page(name: "connectingPage")
}

def installed() {
	if (!state.accessToken) {
		log.debug "creating token..."
		createAccessToken()
	}

	def options = [
		"method": "POST",
		"path": "/smartthings/installed",
		"headers": [
			"HOST": settings.serverAddress,
			"Content-Type": "application/json"
		],
		"body":[
			"app_url":"${apiServerUrl}/api/smartapps/installations/",
			"app_id":app.id,
			"access_token":state.accessToken
		]
	]
def myhubAction = new physicalgraph.device.HubAction(options, null, [callback: null])
	sendHubCommand(myhubAction)
	initialize()
}

def updated() {
	unsubscribe()
	initialize()
}

def uninstalled() {
	def options = [
		"method": "POST",
		"path": "/smartthings/uninstalled",
		"headers": [
			"HOST": settings.serverAddress,
			"Content-Type": "application/json"
		]
	]
	def myhubAction = new physicalgraph.device.HubAction(options, null, [callback: null])
	sendHubCommand(myhubAction)
}

def childUninstalled() {
	log.debug "childUninstalled()"
}

def initialize() {
	// TODO: subscribe to attributes, devices, locations, etc.
}

// TODO: implement event handlers
def settingPage(){	
	state.addedCountNow = 0
	state.curStatus = "setting"
	state.dniHeaderStr = "suroup-"
	dynamicPage(name:"settingPage", title:"Settings", nextPage: "connectingPage", uninstall: true) {
		section("Label") {
			label name: "label", title:"You can change the name of this smartapp", required: false, multiple: false, description: name
		}
		section("Suroup server setting") {
			paragraph "Please input Suroup server's local IP address including port number."
			input "serverAddress", "text", title: "IP address (ex. 192.168.1.10:30100)", required: true, value: "192.168.1.10:30100"
		}
	}
}

def connectingPage(){
	if (state.curStatus == "setting") {
		state.curStatus = "connecting"
		getConnectorStatus()
	} 

	if (state.curStatus == "setting" || state.curStatus == "connecting") {
		dynamicPage(name:"connectingPage", title:"Connecting", refreshInterval:1) {
			section("Connecting") {
				paragraph "Trying to connect ${settings.serverAddress}\nPlease wait...."        	
			}
		}        
	} else if (state.curStatus == "connected") {
		dynamicPage(name:"connectingPage", title:"Connected", install: true, uninstall: true) {
			section("Connected") {
				paragraph "Connected to ${settings.serverAddress}"
				paragraph "Added Count : " + state.addedCountNow
			}
		}
	}
}

def getConnectorStatus() {	
	def options = [
		"method": "GET",
		"path": "/homenet",
		"headers": [
			"HOST": settings.serverAddress,
			"Content-Type": "application/json"
		]
	]
	sendHubCommand(new physicalgraph.device.HubAction(options, null, [callback: connectorCallback]))
}

def connectorCallback(physicalgraph.device.HubResponse hubResponse){
	def msg, status, json
	try {
		msg = parseLanMessage(hubResponse.description)        
		def jsonObj = msg.json
		log.debug "connectorCallback() - response : ${jsonObj}"
		def count = 0
		jsonObj.each{ item->
			def dni = state.dniHeaderStr + item.id.toLowerCase()
			log.debug "dni : ${dni}, item : ${item}"
			if(!getChildDevice(dni)){
				try{
					def typeName
					if (item.type == "light") {
						typeName = "suroup-light"
					} else if (item.type == "thermostat") {
						typeName = "suroup-thermostat"
					} else if (item.type == "outlet") {
						typeName = "suroup-outlet"
					}

					def childDevice = addChildDevice("suroup", typeName, dni, location.hubs[0].id, [
						"label": item.id,
						"uri": item.uri
					])                    
					childDevice.init()
					childDevice.setUrl("${settings.serverAddress}")
					childDevice.setPath("/homenet/${item.id}")
					childDevice.refresh()

					state.addedCountNow = (state.addedCountNow.toInteger() + 1)
					log.debug "[addChildDevice] - typeName:${typeName}, dni:${dni}, label:${label}"
				}catch(e){
					log.error("ADD DEVICE Error!!! ${e}")
				}
			}
		}
		state.curStatus = "connected"
		log.debug "connected"
	} catch (e) {
		log.error("Exception caught while parsing data: "+e);
	}
}

def updateProperty(){
	def dni = state.dniHeaderStr + params.id.toLowerCase()
	def chlidDevice = getChildDevice(dni)
	if(chlidDevice){
		chlidDevice.updateProperty(params.property, params.value)
		def resultString = new groovy.json.JsonOutput().toJson("result":true)
		render contentType: "text/plain", data: resultString   
	} else {
		log.error "Device not found - dni : ${dni}"
		httpError(501, "Device not found - dni : ${dni}")
	}
}

def authError() {
	[error: "Permission denied"]
}

mappings {
	if (!params.access_token || (params.access_token && params.access_token != state.accessToken)) {
		path("/updateProperty/:id/:property/:value")    { action: [POST: "authError"]  }
	} else {
		path("/updateProperty/:id/:property/:value")    { action: [POST: "updateProperty"]  }
	}
}