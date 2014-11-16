/**
 * Copyright 2013 IBM Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

/* 
 * This is modified by Megam Systems.
 */

var util = require("util");
var when = require("when");

var typeRegistry = require("./registry");
var credentials = require("./credentials");
var log = require("../log");
var events = require("../events");
var megam = require("../megam");

var component_loop = 0;
var setcomponents = false;
var storage = null;
var postresult;
var nodes = {};
var activeConfig = [];
var cloud_settings = [];
var domains = [];
var missingTypes = [];

events.on('type-registered', function(type) {
	if (missingTypes.length > 0) {
		var i = missingTypes.indexOf(type);
		if (i != -1) {
			missingTypes.splice(i, 1);
			util.log("[varai] Missing type registered: " + type);
		}
		if (missingTypes.length === 0) {
			parseConfig();
		}
	}
});
var parseCredentials = function(config) {
	return when.promise(function(resolve, defect) {
		for (var i in config) {
			if (config.hasOwnProperty(i)) {
				var node = config[i];
				if (node.credentials) {
					var type = node.type;
					credentials.merge(node.id, type, node.credentials);
					delete node.credentials;
				}
			}
		}
		credentials.save().then(function() {
			resolve(config);
		}).otherwise(function(err) {
			defect(err);
		});
	});
};

var load_cloud_settings = function() {
	var cs_defer = when.defer();
	megam.loadFlows("", "predefclouds").then(function() {
		cloud_settings = megam.getData();
		cs_defer.resolve();
	}).otherwise(function(err) {
		util.log("[varai] Error loading cloud settings : " + err);
	});

	return cs_defer.promise;
};

var load_domains = function() {
	var domain_defer = when.defer();
	megam.loadFlows("megam.co", "domains").then(function() {

		domains = megam.getData();
		domain_defer.resolve();
	}).otherwise(function(err) {
		util.log("[varai] Error loading domains : " + err);
	});

	return domain_defer.promise;
};

/*var initial_flows_load = function() {
 var initial_defer = when.defer();
 megam.loadFlows("AMS1144661953453621248", "assemblies").then(function() {
 loadAssemblies(megam.getData()).then(function() {
 if (activeConfig && activeConfig.length > 0) {
 console.log("==================after assemblies");
 initial_defer.resolve();
 }

 }).otherwise(function(err) {
 util.log("[varai] Error loading flows : " + err);
 });
 }).otherwise(function(err) {
 util.log("[varai] Error loading flows : " + err);
 });

 return initial_defer.promise;
 }; */

var initial_flows_load = function() {
	var initial_defer = when.defer();
	var complinks;
	activeConfig = [];
	var id = typeRegistry.getID();
	if (id.length > 1) {
		megam.loadFlows(id, "assemblies").then(function() {

			data = megam.getData();

			var response = JSON.parse(data);
			var assemblies = response.results[0];
			var sheet = {};

			sheet.type = assemblies.inputs.assemblies_type;
			sheet.id = assemblies.inputs.id;
			sheet.label = assemblies.inputs.label;
			//activeConfig.push(sheet);
			activeConfig[0] = sheet;

			for ( j = 0; j < assemblies.inputs.cloudsettings.length; j++) {
				var cloud_settings = {};
				cloud_settings.id = assemblies.inputs.cloudsettings[j].id;
				cloud_settings.type = assemblies.inputs.cloudsettings[j].cstype;
				cloud_settings.cloudsettings = assemblies.inputs.cloudsettings[j].cloudsettings;
				cloud_settings.x = parseInt(assemblies.inputs.cloudsettings[j].x);
				cloud_settings.y = parseInt(assemblies.inputs.cloudsettings[j].y);
				cloud_settings.z = assemblies.inputs.cloudsettings[j].z;
				cloud_settings.wires = [];
				cloud_settings.wires[0] = [];
				console.log(assemblies.inputs.cloudsettings[j].wires[1]);
				cloud_settings.wires[0] = assemblies.inputs.cloudsettings[j].wires;
				//activeConfig.push(cloud_settings);
				activeConfig[activeConfig.length] = cloud_settings;
			}

			var assembly_links = assemblies.assemblies;
			for ( i = 0; i < assembly_links.length - 1; i++) {
				if (assembly_links[i].length > 1) {
					megam.loadFlows(assembly_links[i], "assembly").then(function() {
						var aData = megam.getData();
						var assembly_response = JSON.parse(aData);
						var assembly = assembly_response.results[0];
						var assembly_name = assembly.name;
						var component_links = assembly.components;
						complinks = component_links.length;
						for ( i = 0; i < component_links.length - 1; i++) {
							megam.loadFlows(component_links[i], "components").then(function() {
								var cData = megam.getData();
								var component_response = JSON.parse(cData);
								var component = component_response.results[0];
								var flow = JSON.parse("{}");
								flow.id = component.inputs.design_inputs.id;
								var type = component.tosca_type.split(".");
								flow.type = type[2];
								flow.name = component.name;
								flow.app = assembly_name;
								flow.domain = component.inputs.domain;
								flow.source = "";
								flow.ha = false;
								flow.x = parseInt(component.inputs.design_inputs.x);
								flow.y = parseInt(component.inputs.design_inputs.y);
								flow.z = component.inputs.design_inputs.z;
								flow.wires = [];
								flow.wires[0] = component.inputs.design_inputs.wires;
								//activeConfig.push(flow);
								activeConfig[activeConfig.length] = flow;
								if (activeConfig.length == complinks + 2) {
									initial_defer.resolve();
								}
							}).otherwise(function(err) {
								util.log("[varai] Error loading flows(Components) : " + err);
							});
						}

					}).otherwise(function(err) {
						util.log("[varai] Error loading flows (Assembly) : " + err);
					});
				}
			}

		}).otherwise(function(err) {
			util.log("[varai] Error loading flows : " + err);
		});
	}
	return initial_defer.promise;
};

/*var loadAssemblies = function(data) {
 var assembly_defer = when.defer();
 var response = JSON.parse(data);
 var assemblies = response.results[0];
 var sheet = {};

 sheet.type = assemblies.inputs.assemblies_type;
 sheet.id = assemblies.inputs.id;
 sheet.label = assemblies.inputs.label;
 activeConfig.push(sheet);

 for ( j = 0; j < assemblies.inputs.cloudsettings.length; j++) {
 var cloud_settings = {};
 cloud_settings.id = assemblies.inputs.cloudsettings[j].id;
 cloud_settings.type = assemblies.inputs.cloudsettings[j].cstype;
 cloud_settings.cloudsettings = assemblies.inputs.cloudsettings[j].cloudsettings;
 cloud_settings.x = assemblies.inputs.cloudsettings[j].x;
 cloud_settings.y = assemblies.inputs.cloudsettings[j].y;
 cloud_settings.z = assemblies.inputs.cloudsettings[j].z;
 cloud_settings.wires = [];
 console.log(assemblies.inputs.cloudsettings[j].wires[1]);
 cloud_settings.wires.push = assemblies.inputs.cloudsettings[j].wires;
 activeConfig.push(cloud_settings);
 }

 var assembly_links = assemblies.assemblies;
 for ( i = 0; i < assembly_links.length - 1; i++) {
 if (assembly_links[i].length > 1) {
 megam.loadFlows(assembly_links[i], "assembly").then(function() {
 loadComponents(megam.getData()).then(function() {
 if (i == assembly_links.length - 2) {
 assembly_defer.resolve();
 }
 }).otherwise(function(err) {
 util.log("[varai] Error loading flows : " + err);
 });
 }).otherwise(function(err) {
 util.log("[varai] Error loading flows (Assembly) : " + err);
 });
 }
 }

 return assembly_defer.promise;
 };

 var loadComponents = function(data) {
 var component_defer = when.defer();
 var assembly_response = JSON.parse(data);
 var assembly = assembly_response.results[0];
 var assembly_name = assembly.name;
 var component_links = assembly.components;

 for ( i = 0; i < component_links.length - 1; i++) {
 megam.loadFlows(component_links[i], "components").then(function() {
 var cData = megam.getData();
 var component_response = JSON.parse(cData);
 var component = component_response.results[0];
 var flow = JSON.parse("{}");
 flow.id = component.inputs.design_inputs.id;
 var type = component.tosca_type.split(".");
 flow.type = type[2];
 flow.name = component.name;
 flow.app = assembly_name;
 flow.domain = component.inputs.domain;
 flow.source = "";
 flow.ha = false;
 flow.x = component.inputs.design_inputs.x;
 flow.y = component.inputs.design_inputs.y;
 flow.z = component.inputs.design_inputs.z;
 flow.wires = [];
 flow.wires.push(component.inputs.design_inputs.wires);
 activeConfig.push(flow);
 console.log("==============++++++++++++++++++++++++++active config");
 console.log(activeConfig);

 if (i == component_links.length - 1) {
 component_defer.resolve();
 }
 }).otherwise(function(err) {
 util.log("[varai] Error loading flows(Components) : " + err);
 });
 }
 return component_defer.promise;
 };*/

var parseConfig = function() {
	var i;
	var nt;
	missingTypes = [];

	for ( i = 0; i < activeConfig.length; i++) {
		var type = activeConfig[i].type;
		// TODO: remove workspace in next release+1
		if (type != "workspace" && type != "tab") {
			nt = typeRegistry.get(type);
			if (!nt && missingTypes.indexOf(type) == -1) {
				missingTypes.push(type);
			}
		}
	}
	if (missingTypes.length > 0) {
		util.log("[varai] Waiting for missing types to be registered:");
		for ( i = 0; i < missingTypes.length; i++) {
			util.log("[varai]  - " + missingTypes[i]);
		}
		return;
	}

	util.log("[varai] Starting flows");
	events.emit("nodes-starting");
	for ( i = 0; i < activeConfig.length; i++) {
		var nn = null;
		// TODO: remove workspace in next release+1
		if (activeConfig[i].type != "workspace" && activeConfig[i].type != "tab") {
			nt = typeRegistry.get(activeConfig[i].type);
			if (nt) {
				try {
					nn = new nt(activeConfig[i]);
				} catch (err) {
					util.log("[varai] " + activeConfig[i].type + " : " + err);
				}
			}
			// console.log(nn);
			if (nn === null) {
				util.log("[varai] unknown type: " + activeConfig[i].type);
			}
		}
	}
	// Clean up any orphaned credentials
	credentials.clean(flowNodes.get);
	events.emit("nodes-started");
};

function stopFlows() {
	if (activeConfig && activeConfig.length > 0) {
		util.log("[varai] Stopping flows");
	}
	return flowNodes.clear();
}

var flowNodes = module.exports = {
	init : function(_actions) {
		actions = _actions;
	},
	loadCloudSettings : function() {
		var cs_defer = when.defer();
		load_cloud_settings().then(function() {
			cs_defer.resolve();
		}).otherwise(function(err) {
			util.log("[varai] Error loading cloud settings : " + err);
		});
		return cs_defer.promise;
	},
	load : function() {
		/*
		 * return actions.getFlows().then(function(flows) { return
		 * credentials.load().then(function() { activeConfig = flows; if
		 * (activeConfig && activeConfig.length > 0) { parseConfig(); } });
		 * }).otherwise(function(err) { util.log("[varai] Error loading flows : " +
		 * err); });
		 */
		var defer1 = when.defer();
		initial_flows_load().then(function() {
			parseConfig();
			defer1.resolve();
		}).otherwise(function(err) {
			util.log("[varai] Error loading flows : " + err);
		});
		return defer1.promise;
	},
	add : function(n) {
		nodes[n.id] = n;
		n.on("log", log.log);
	},
	get : function(i) {
		return nodes[i];
	},
	clear : function() {
		return when.promise(function(resolve) {
			events.emit("nodes-stopping");
			var promises = [];
			for (var n in nodes) {
				if (nodes.hasOwnProperty(n)) {
					try {
						var p = nodes[n].close();
						if (p) {
							promises.push(p);
						}
					} catch (err) {
						nodes[n].error(err);
					}
				}
			}
			when.settle(promises).then(function() {
				events.emit("nodes-stopped");
				nodes = {};
				resolve();
			});
		});
	},
	each : function(cb) {
		for (var n in nodes) {
			if (nodes.hasOwnProperty(n)) {
				cb(nodes[n]);
			}
		}
	},

	getFlows : function() {
		return activeConfig;
	},
	getCloudSettings : function() {
		return cloud_settings;
	},
	postFlows : function(conf) {
		var postdefer = when.defer();
		parseCredentials(conf).then(function(confCredsRemoved) {
			megam.postFlows(JSON.stringify(confCredsRemoved)).then(function() {
				postresult = megam.getPostData();
				postdefer.resolve();
			});
		});
		return postdefer.promise;
	},
	getPostResult : function() {
		return postresult;
	},
	loadDomains : function() {
		var dd_defer = when.defer();
		load_domains().then(function() {
			dd_defer.resolve();
		}).otherwise(function(err) {
			util.log("[varai] Error loading domains : " + err);
		});
		return dd_defer.promise;
	},
	getDomains : function() {
		return domains;
	},
	stopFlows : stopFlows
};
