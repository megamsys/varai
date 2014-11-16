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

var express = require('express');
var util = require('util');
var when = require('when');

var createUI = require("./ui");
var varaiNodes = require("./nodes");

var app = null;
var nodeApp = null;
var server = null;
var settings = null;
var storage = null;

function createServer(_server, _settings) {
	server = _server;
	settings = _settings;
	storage = require("./actions");
	app = createUI(settings);
	nodeApp = express();

	app.get("/nodes", function(req, res) {
		res.send(varaiNodes.getNodeConfigs());
	});

	app.get("/cloudsettings", function(req, res) {
		varaiNodes.loadCloudSettings().then(function() {
			var cloudsettings = varaiNodes.getCloudSettings();
			res.json(cloudsettings);
		}).otherwise(function(err) {
			util.log("[varai] Error loading cloud settings : " + err);
		});
	});

	app.get("/domains", function(req, res) {
		varaiNodes.loadDomains().then(function() {
			var domains = varaiNodes.getDomains();
			res.json(domains);
		}).otherwise(function(err) {
			util.log("[varai] Error loading Domains : " + err);
		});
	});

	app.get("/flows", function(req, res) {
		var cloudsettings = {};
		varaiNodes.loadFlows().then(function() {
			var flows = varaiNodes.getFlows();
			res.json(flows);
		}).otherwise(function(err) {
			util.log("[varai] Error loading flows : " + err);
		});
	});

	app.post("/flows", express.json(), function(req, res) {
		var flows = req.body;
		varaiNodes.postFlows(flows).then(function() {
			var resp = varaiNodes.getPostResult();
			try {
				jsonResult = JSON.parse(resp);
				if (jsonResult.code > 205) {
					res.send(500, jsonResult.more);
				} else {
					res.json(204);
				}
			} catch (e) {
				res.send(500, "");
			};

		}).otherwise(function(err) {
			util.log("[varai] Error saving flows : " + err);
			res.send(500, err.message);
		});
	}, function(error, req, res, next) {
		res.send(400, "Invalid Flow");
	});
}

function start() {
	var VARAI = require("./varai");
	var defer = when.defer();

	storage.init(settings).then(function() {
		console.log("\nWelcome to varai\n===================\n");
		if (settings.version) {
			util.log("[varai] Version: " + settings.version);
		}
		util.log("[varai] Loading palette nodes");
		varaiNodes.init(settings, storage);
		varaiNodes.load().then(function(nodeErrors) {
			if (nodeErrors.length > 0) {
				util.log("------------------------------------------");
				if (settings.verbose) {
					for (var i = 0; i < nodeErrors.length; i += 1) {
						util.log("[" + nodeErrors[i].fn + "] " + nodeErrors[i].err);
					}
				} else {
					util.log("[varai] Failed to register " + nodeErrors.length + " node type" + (nodeErrors.length == 1 ? "" : "s"));
					util.log("[varai] Run with -v for details");
				}
				util.log("------------------------------------------");
			}
			defer.resolve();
		});
	});

	return defer.promise;
}

function stop() {
	varaiNodes.stopFlows();
}

module.exports = {
	init : createServer,
	start : start,
	stop : stop
};

module.exports.__defineGetter__("app", function() {
	return app
});
module.exports.__defineGetter__("nodeApp", function() {
	return nodeApp
});
module.exports.__defineGetter__("server", function() {
	return server
}); 


