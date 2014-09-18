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

var megam = module.exports = {

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
		var hmac = generateHMAC("", path);
		// An object of options to indicate where to post to
		// Configure the request		
		
		var options = {
			url : host + path,
			method : 'GET',
			headers : {
				'X-Megam-DATE' : now.toString(),
				'X-Megam-EMAIL' : 'megam@mypaas.io',
				'X-Megam-APIKEY' : 'IamAtlas{74}NobodyCanSeeME#07',
				'X-Megam-HMAC' : 'megam@mypaas.io:' + hmac,
				'Accept' : 'application/vnd.megam+json',
				'Content-Type' : 'application/json'
			},
			form : ""
		}
		// Start the request
		 request(options, function(error, response, body) {
		//	if (!error && response.statusCode == 200) {
				// Print out the response body			
			 result = body;
			 defer.resolve();  
			
			//	console.log(response)
			//	console.log(error)
		//	}
		});
		return defer.promise;
		
	},	
		
	postFlows : function(flows) {	
		var defer = when.defer();
		var path = version + "/assemblies/content";
		var hmac = generateHMAC(flows, path);
		// An object of options to indicate where to post to
		// Configure the request
		var options = {
			url : host + path,
			method : 'POST',
			headers : {
				'X-Megam-DATE' : now.toString(),
				'X-Megam-EMAIL' : 'megam@mypaas.io',
				'X-Megam-APIKEY' : 'IamAtlas{74}NobodyCanSeeME#07',
				'X-Megam-HMAC' : 'megam@mypaas.io:' + hmac,
				'Accept' : 'application/vnd.megam+json',
				'Content-Type' : 'application/json'
			},
			form : flows
		}
		// Start the request
		 request(options, function(error, response, body) {			
				post_result = body;
				defer.resolve(); 			
		});
		return defer.promise;
	}

}

function createSign(data, path) {
	var mkSign = now.toString() + "\n" + path + "\n" + calculateMD5(data)
	return mkSign
}

function calculateMD5(data) {
	md5 = crypto.createHash("md5", "MD5").update(data).digest(encoding = 'base64');
	return md5
}

function generateHMAC(flows, path) {
	var algorithm = 'sha1';
	var hash, hmac;
	hmac = crypto.createHmac(algorithm, 'IamAtlas{74}NobodyCanSeeME#07').update(createSign(flows, path)).digest("hex");
	return hmac
}