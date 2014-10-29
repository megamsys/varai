/*
** Copyright [2012-2013] [Megam Systems]
**
** Licensed under the Apache License, Version 2.0 (the "License");
** you may not use this file except in compliance with the License.
** You may obtain a copy of the License at
**
** http://www.apache.org/licenses/LICENSE-2.0
**
** Unless required by applicable law or agreed to in writing, software
** distributed under the License is distributed on an "AS IS" BASIS,
** WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
** See the License for the specific language governing permissions and
** limitations under the License.
*/

//var randomWords = require('random-words');

VARAI.nodes = function() {

	var node_defs = {};
	var nodes = [];
	var configNodes = {};
	var links = [];
	var defaultWorkspace;
	var workspaces = {};
	var obj = JSON.parse("{}");

	//function randomword() {
	//	return randomWords();
	// }

	function registerType(nt, def) {
		node_defs[nt] = def;
		// TODO: too tightly coupled into palette UI
		VARAI.palette.add(nt, def);
	}

	function getID() {
		return (1 + Math.random() * 4294967295).toString(16);
	}

	function getType(type) {
		return node_defs[type];
	}

	function addNode(n) {
		if (n._def.category == "config") {
			configNodes[n.id] = n;
			VARAI.sidebar.config.refresh();
		} else {
			n.dirty = true;
			nodes.push(n);
			var updatedConfigNode = false;
			for (var d in n._def.defaults) {
				var property = n._def.defaults[d];
				if (property.type) {
					var type = getType(property.type)
					if (type && type.category == "config") {
						var configNode = configNodes[n[d]];
						if (configNode) {
							updatedConfigNode = true;
							configNode.users.push(n);
						}
					}
				}
			}
			if (updatedConfigNode) {
				VARAI.sidebar.config.refresh();
			}
		}
	}

	function addLink(l) {
		links.push(l);
	}

	function addConfig(c) {
		configNodes[c.id] = c;
	}

	function getNode(id) {
		if ( id in configNodes) {
			return configNodes[id];
		} else {
			for (var n in nodes) {
				if (nodes[n].id == id) {
					return nodes[n];
				}
			}
		}
		return null;
	}

	function removeNode(id) {
		var removedLinks = [];
		if ( id in configNodes) {
			delete configNodes[id];
			VARAI.sidebar.config.refresh();
		} else {
			var node = getNode(id);
			if (node) {
				nodes.splice(nodes.indexOf(node), 1);
				removedLinks = links.filter(function(l) {
					return (l.source === node) || (l.target === node);
				});
				removedLinks.map(function(l) {
					links.splice(links.indexOf(l), 1);
				});
			}
			var updatedConfigNode = false;
			for (var d in node._def.defaults) {
				var property = node._def.defaults[d];
				if (property.type) {
					var type = getType(property.type)
					if (type && type.category == "config") {
						var configNode = configNodes[node[d]];
						if (configNode) {
							updatedConfigNode = true;
							var users = configNode.users;
							users.splice(users.indexOf(node), 1);
						}
					}
				}
			}
			if (updatedConfigNode) {
				VARAI.sidebar.config.refresh();
			}
		}
		return removedLinks;
	}

	function removeLink(l) {
		var index = links.indexOf(l);
		if (index != -1) {
			links.splice(index, 1);
		}
	}

	function refreshValidation() {
		for (var n in nodes) {
			VARAI.editor.validateNode(nodes[n]);
		}
	}

	function addWorkspace(ws) {
		workspaces[ws.id] = ws;
	}

	function getWorkspace(id) {
		return workspaces[id];
	}

	function removeWorkspace(id) {
		delete workspaces[id];
		var removedNodes = [];
		var removedLinks = [];
		for (var n in nodes) {
			var node = nodes[n];
			if (node.z == id) {
				removedNodes.push(node);
			}
		}
		for (var n in removedNodes) {
			var rmlinks = removeNode(removedNodes[n].id);
			removedLinks = removedLinks.concat(rmlinks);
		}
		return {
			nodes : removedNodes,
			links : removedLinks
		};
	}

	function getAllFlowNodes(node) {
		var visited = {};
		visited[node.id] = true;
		var nns = [node];
		var stack = [node];
		while (stack.length != 0) {
			var n = stack.shift();
			var childLinks = links.filter(function(d) {
				return (d.source === n) || (d.target === n);
			});
			for (var i in childLinks) {
				var child = (childLinks[i].source === n) ? childLinks[i].target : childLinks[i].source;
				if (!visited[child.id]) {
					visited[child.id] = true;
					nns.push(child);
					stack.push(child);
				}
			}
		}
		return nns;
	}

	/**
	 * Converts a node to an exportable JSON Object
	 **/
	function convertNode(n, exportCreds) {
		exportCreds = exportCreds || false;
		var node = {};
		node.id = n.id;
		node.type = n.type;
		for (var d in n._def.defaults) {
			node[d] = n[d];
		}
		if (exportCreds && n.credentials) {
			node.credentials = {};
			for (var cred in n._def.credentials) {
				if (n._def.credentials.hasOwnProperty(cred)) {
					if (n.credentials[cred] != null) {
						node.credentials[cred] = n.credentials[cred];
					}
				}
			}
		}
		if (n._def.category != "config") {
			node.x = n.x;
			node.y = n.y;
			node.z = n.z;
			node.wires = [];
			for (var i = 0; i < n.outputs; i++) {
				node.wires.push([]);
			}
			var wires = links.filter(function(d) {
				return d.source === n;
			});
			for (var i in wires) {
				var w = wires[i];
				node.wires[w.sourcePort].push(w.target.id);
			}
		}
		return node;
	}

	/**
	 * Converts the current node selection to an exportable JSON Object
	 **/
	function createExportableNodeSet(set) {
		var nns = [];
		var exportedConfigNodes = {};
		for (var n in set) {
			var node = set[n].n;
			var convertedNode = VARAI.nodes.convertNode(node);
			for (var d in node._def.defaults) {
				if (node._def.defaults[d].type && node[d] in configNodes) {
					var confNode = configNodes[node[d]];
					var exportable = getType(node._def.defaults[d].type).exportable;
					if ((exportable == null || exportable)) {
						if (!(node[d] in exportedConfigNodes)) {
							exportedConfigNodes[node[d]] = true;
							nns.unshift(VARAI.nodes.convertNode(confNode));
						}
					} else {
						convertedNode[d] = "";
					}
				}
			}

			nns.push(convertedNode);
		}
		return nns;
	}

	//TODO: rename this (createCompleteNodeSet)
	function createCompleteNodeSet() {
		var nns = [];
		for (var i in workspaces) {
			nns.push(workspaces[i]);
		}
		for (var i in configNodes) {
			nns.push(convertNode(configNodes[i], true));
		}
		for (var i in nodes) {
			var node = nodes[i];
			nns.push(convertNode(node, true));
		}

		return nns;
	}

	function importNodes(newNodesObj, createNewIds) {
		try {
			var newNodes;
			if ( typeof newNodesObj === "string") {
				if (newNodesObj == "") {
					return;
				}
				newNodes = JSON.parse(newNodesObj);
			} else {
				newNodes = newNodesObj;
			}

			if (!$.isArray(newNodes)) {
				newNodes = [newNodes];
			}
			var unknownTypes = [];
			for (var i = 0; i < newNodes.length; i++) {
				var n = newNodes[i];
				// TODO: remove workspace in next release+1
				if (n.type != "workspace" && n.type != "tab" && !getType(n.type)) {
					// TODO: get this UI thing out of here! (see below as well)
					n.name = n.type;
					n.type = "unknown";
					if (unknownTypes.indexOf(n.name) == -1) {
						unknownTypes.push(n.name);
					}
					if (n.x == null && n.y == null) {
						// config node - remove it
						newNodes.splice(i, 1);
						i--;
					}
				}
			}
			if (unknownTypes.length > 0) {
				var typeList = "<ul><li>" + unknownTypes.join("</li><li>") + "</li></ul>";
				var type = "type" + (unknownTypes.length > 1 ? "s" : "");
				VARAI.notify("<strong>Imported unrecognised " + type + ":</strong>" + typeList, "error", false, 10000);
				//"DO NOT DEPLOY while in this state.<br/>Either, add missing types to varai, restart and then reload page,<br/>or delete unknown "+n.name+", rewire as required, and then deploy.","error");
			}

			for (var i in newNodes) {
				var n = newNodes[i];
				// TODO: remove workspace in next release+1
				if (n.type === "workspace" || n.type === "tab") {
					if (n.type === "workspace") {
						n.type = "tab";
					}
					if (defaultWorkspace == null) {
						defaultWorkspace = n;
					}
					addWorkspace(n);
					VARAI.view.addWorkspace(n);
				}
			}
			if (defaultWorkspace == null) {
				defaultWorkspace = {
					type : "tab",
					id : getID(),
					label : "Sheet 1"
				};
				addWorkspace(defaultWorkspace);
				VARAI.view.addWorkspace(defaultWorkspace);
			}

			var node_map = {};
			var new_nodes = [];
			var new_links = [];

			for (var i in newNodes) {
				var n = newNodes[i];
				// TODO: remove workspace in next release+1
				if (n.type !== "workspace" && n.type !== "tab") {
					var def = getType(n.type);
					if (def && def.category == "config") {
						if (!VARAI.nodes.node(n.id)) {
							var configNode = {
								id : n.id,
								type : n.type,
								users : []
							};
							for (var d in def.defaults) {
								configNode[d] = n[d];
							}
							configNode.label = def.label;
							configNode._def = def;
							VARAI.nodes.add(configNode);
						}
					} else {
						var node = {
							x : n.x,
							y : n.y,
							z : n.z,
							type : 0,
							wires : n.wires,
							changed : false
						};
						if (createNewIds) {
							node.z = VARAI.view.getWorkspace();
							node.id = getID();
						} else {
							node.id = n.id;
							if (node.z == null || !workspaces[node.z]) {
								node.z = VARAI.view.getWorkspace();
							}
						}
						node.type = n.type;
						node._def = def;
						if (!node._def) {
							node._def = {
								color : "#fee",
								defaults : {},
								label : "unknown: " + n.type,
								labelStyle : "node_label_italic",
								outputs : n.outputs || n.wires.length
							}
						}
						node.outputs = n.outputs || node._def.outputs;

						for (var d in node._def.defaults) {
							node[d] = n[d];
						}

						addNode(node);
						VARAI.editor.validateNode(node);
						node_map[n.id] = node;
						new_nodes.push(node);
					}
				}
			}
			for (var i in new_nodes) {
				var n = new_nodes[i];
				for (var w1 in n.wires) {
					var wires = (n.wires[w1] instanceof Array) ? n.wires[w1] : [n.wires[w1]];
					for (var w2 in wires) {
						if (wires[w2] in node_map) {
							var link = {
								source : n,
								sourcePort : w1,
								target : node_map[wires[w2]]
							};
							addLink(link);
							new_links.push(link);
						}
					}
				}
				delete n.wires;
			}
			return [new_nodes, new_links];
		} catch(error) {
			//TODO: get this UI thing out of here! (see above as well)
			VARAI.notify("<strong>Error</strong>: " + error, "error");
			return null;
		}

	}

	function assemblyJson(data) {
		var groups = [];
		var assemblies_array = [];
		var ha_policy_flag = false;
		var css = [];

		//group(assembly) array
		for ( i = 1; i < data.length; i++) {
			if (data[i].type != "cloudsettings") {
				groups.push(data[i].app);
			} else {
				css.push(data[i]);
			}
		}

		//copy data to duplicate data
		var duplicateData = data;

		//set app id to wired service
		for ( k = 1; k < data.length; k++) {
			if (data[k]['source']) {
				if ((data[k].wires[0]).length > 0) {
				    console.log(data[k].wires[0]);
					$.each(data[k].wires[0], function(rci1, rc1) {
						for ( i = 1; i < duplicateData.length; i++) {
							if (rc1 == duplicateData[i].id) {
								var linkid = [];
								linkid.push(data[k].id);
								duplicateData[i].wires.push(linkid);
							}
						}
					});
				}
			}
		}
        
		//put changes to original data
		data = duplicateData;
		duplicateData = data
		groups = eliminateDuplicates(groups);
		//create assembly json
		for ( j = 0; j < groups.length; j++) {
			var bind_policy_flag = false;
			ha_policy_flag = false;
			assembly = JSON.parse("{}");
			assembly.name = groups[j];
			assembly.components = [];

			for ( i = 1; i < data.length; i++) {
				if (groups[j] == data[i].app) {
					if (data[i].ha == true) {
						ha_policy_flag = true;
					}
				}
			}
			// assembly.policies = JSON.parse("{}");
			assembly.policies = [];
			// if(ha_policy_flag == true) {
			//    assembly.policies.ha_policy = JSON.parse("{}");
			//     assembly.policies.ha_policy.name = "HA policy";
			//     assembly.policies.ha_policy.type = "colocated";
			//     assembly.policies.ha_policy.members = [];
			// }

			//create components json for assembly
			for ( k = 1; k < data.length; k++) {
				if (groups[j] == data[k].app) {
					var component = JSON.parse("{}");
					component.name = data[k].name
					component.tosca_type = "tosca.web." + data[k].type
					component.requirements = JSON.parse("{}");
					component.requirements.host = ""

					// put wired cloudsetting name to component host
					$.each(css, function(csi, csitem) {
						$.each(csitem.wires[0], function(csj, nodeid) {
							if (nodeid == data[k].id) {
								component.requirements.host = csitem.cloudsettings;
							}
						});
					});

					component.requirements.dummy = ""
					component.inputs = JSON.parse("{}");
					component.inputs.domain = data[k].domain || ""
					component.inputs.port = data[k].port || ""
					component.inputs.username = data[k].username || ""
					component.inputs.password = data[k].password || ""
					component.inputs.version = data[k].version || ""
					component.inputs.source = data[k].source || ""
					component.inputs.design_inputs = JSON.parse("{}");
					component.inputs.design_inputs.id = data[k].id
					component.inputs.design_inputs.x = data[k].x
					component.inputs.design_inputs.y = data[k].y
					component.inputs.design_inputs.z = data[k].z
					var wires = [];
					component.inputs.design_inputs.wires = data[k].wires[0] || wires
					component.inputs.service_inputs = JSON.parse("{}");
					component.inputs.service_inputs.dbname = data[k].dbname || ""
					component.inputs.service_inputs.dbpassword = data[k].dbpassword || ""
					//  component.external_management_resource = JSON.parse("{}");
					//  component.external_management_resource.url = "";
					component.external_management_resource = "";
					component.artifacts = JSON.parse("{}");
					component.artifacts.artifact_type = "tosca type";
					component.artifacts.content = "";
					component.artifacts.artifact_requirements = "";
					//  component.artifacts.requirements = JSON.parse("{}");
					//  component.artifacts.requirements.requirement_type = "create";

					//related components
					component.related_components = "";
					var dataWiresArray = [];
					var dataWiresLength = 0;

					//differ Apps and services array
					if (data[k]['source']) {
						dataWiresLength = data[k].wires[0].length;
						dataWiresArray = data[k].wires[0];
					} else {
						dataWiresLength = data[k].wires.length;
						dataWiresArray = data[k].wires;
					}

					if (dataWiresLength > 0) {
						if (assembly.policies.length > 0) {
							for ( bi = 0; bi < assembly.policies.length; bi++) {
								if (assembly.policies[bi].name == "bind policy") {
									bind_policy_flag = true
								}
							}
						}
						if (!bind_policy_flag) {
							bind_policy = JSON.parse("{}");
							bind_policy.name = "bind policy";
							bind_policy.ptype = "colocated";
							bind_policy.members = [];
							bind_policy.members.push(data[k].id)
							assembly.policies.push(bind_policy)
						} else {
							for ( bi = 0; bi < assembly.policies.length; bi++) {
								if (assembly.policies[bi].name == "bind policy") {
									assembly.policies[bi].members.push(data[k].id)
								}
							}
						}
					}
					if (dataWiresLength > 0) {
						$.each(dataWiresArray, function(rci, rc) {
							for ( s = 1; s < duplicateData.length; s++) {
								if (rc == duplicateData[s].id) {
									component.related_components = duplicateData[s].app + "." + duplicateData[s].domain + "/" + duplicateData[s].name;
								}
							}
						});
					}
					component.operations = JSON.parse("{}");
					component.operations.operation_type = "";
					component.operations.target_resource = "";
					assembly.components.push(component);
					//   assembly.policies = "";
					// if(data[k].ha == true) {
					//  	assembly.policies.ha_policy.members.push(data[k].name);
					//  }
				}
			}
			assembly.inputs = "";
			assembly.operations = "";

			assemblies_array.push(assembly);
		}
		obj.name = data[0].label;
		obj.assemblies = assemblies_array;
		obj.inputs = JSON.parse("{}");
		obj.inputs.id = data[0].id;
		obj.inputs.assemblies_type = data[0].type;
		obj.inputs.label = data[0].label;
		obj.inputs.cloudsettings = [];
		$.each(css, function(p, item) {
			var cloud_settings = JSON.parse("{}");
			cloud_settings.id = item.id;
			cloud_settings.cstype = item.type;
			cloud_settings.cloudsettings = item.cloudsettings
			cloud_settings.x = item.x;
			cloud_settings.y = item.y;
			cloud_settings.z = item.z;
			cloud_settings.wires = item.wires[0];
			obj.inputs.cloudsettings.push(cloud_settings);
		});

		console.log(JSON.stringify(obj));
		return obj;
	}

	function eliminateDuplicates(arr) {
		var i, len = arr.length, out = [], obj = {};

		for ( i = 0; i < len; i++) {
			obj[arr[i]] = 0;
		}
		for (i in obj) {
			out.push(i);
		}
		return out;
	}

	return {
		//	randomword: randomword,
		registerType : registerType,
		getType : getType,
		convertNode : convertNode,
		add : addNode,
		addLink : addLink,
		remove : removeNode,
		removeLink : removeLink,
		addWorkspace : addWorkspace,
		removeWorkspace : removeWorkspace,
		workspace : getWorkspace,
		eachNode : function(cb) {
			for (var n in nodes) {
				cb(nodes[n]);
			}
		},
		eachLink : function(cb) {
			for (var l in links) {
				cb(links[l]);
			}
		},
		eachConfig : function(cb) {
			for (var id in configNodes) {
				cb(configNodes[id]);
			}
		},
		node : getNode,
		import : importNodes,
		refreshValidation : refreshValidation,
		getAllFlowNodes : getAllFlowNodes,
		createExportableNodeSet : createExportableNodeSet,
		createCompleteNodeSet : createCompleteNodeSet,
		id : getID,
		assemblyJson : assemblyJson,
		nodes : nodes, // TODO: exposed for d3 vis
		links : links // TODO: exposed for d3 vis
	};
}();
