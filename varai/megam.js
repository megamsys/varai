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

// We need this to build our post string
var http = require('http');
var request = require('request');
var fs = require('fs');
var when = require('when');
var crypto = require('crypto');
var time = require('time');


var now = new time.Date();
var version = "/v2";
var result = {};
var post_result = {};
var host = 'https://api.megam.co';
var email = "";
var api_key = "";

var megam = module.exports = {

   setEmail : function(req_email) {
			email = req_email;
    },	
		
    setApiKey : function(req_apikey) {
		api_key = req_apikey;
    },	
    
	auth : function() {
		var defer = when.defer();	
		var path = version + "/auth";
		var data = "{\"email\":\"" + email + "\", \"api_key\":\""+ api_key + "\", \"authority\":\"user\" }";
		var hmac = generateHMAC(data, path, api_key);
		var options = {
				url : host + path,
				method : 'POST',
				headers : {
					'X-Megam-DATE' : now.toString(),
					'X-Megam-EMAIL' : email,
					'X-Megam-APIKEY' : api_key,
					'X-Megam-HMAC' : email +":"+ hmac,
					'Accept' : 'application_vnd_megam_json',
					'Content-Type' : 'application/json'
				},				
				form : data
			};
			// Start the request
			 request(options, function(error, response, body) {				
				 result = body;
				 defer.resolve();  				
			});
			return defer.promise;
			
	},	
		
	getData : function() {
		return result;
	},
	
	getPostData : function() {
		return post_result;
	},
	
	loadFlows : function(id, url) {
		 var defer = when.defer();		
		 if (id) {
		    var path = version + "/" + url + "/" + id;
		 } else {
			 var path = version + "/" + url;
		 }
		var hmac = generateHMAC("", path, api_key);
		// An object of options to indicate where to post to
		// Configure the request		
		
		var options = {
			url : host + path,
			method : 'GET',
			headers : {
				'X-Megam-DATE' : now.toString(),
				'X-Megam-EMAIL' : email,
				'X-Megam-APIKEY' : api_key,
				'X-Megam-HMAC' : email +":"+ hmac,
				'Accept' : 'application/vnd.megam+json',
				'Content-Type' : 'application/json'
			},
			form : ""
		};
		// Start the request
		 request(options, function(error, response, body) {		
			 result = body;
			 defer.resolve();  		
		});
		return defer.promise;
		
	},	
		
	postFlows : function(flows) {	
		var defer = when.defer();
		var path = version + "/assemblies/content";
		var hmac = generateHMAC(flows, path, api_key);
		// An object of options to indicate where to post to
		// Configure the request
		var options = {
			url : host + path,
			method : 'POST',
			headers : {
				'X-Megam-DATE' : now.toString(),
				'X-Megam-EMAIL' : email,
				'X-Megam-APIKEY' : api_key,
				'X-Megam-HMAC' : email +":"+ hmac,
				'Accept' : 'application/vnd.megam+json',
				'Content-Type' : 'application/json'
			},
			form : flows
		};
		// Start the request
		 request(options, function(error, response, body) {			
				post_result = body;
				defer.resolve(); 			
		});
		return defer.promise;
	}

};

function createSign(data, path) {
	var mkSign = now.toString() + "\n" + path + "\n" + calculateMD5(data);
	console.log(mkSign);
	return mkSign;
}

function calculateMD5(data) {
	md5 = crypto.createHash("md5", "MD5").update(data).digest(encoding = 'base64');
	console.log(md5);
	return md5;
}

function generateHMAC(flows, path, apikey) {
	var algorithm = 'sha1';
	var hash, hmac;
	hmac = crypto.createHmac(algorithm, apikey).update(createSign(flows, path)).digest("hex");
	console.log(hmac);
	return hmac;
}