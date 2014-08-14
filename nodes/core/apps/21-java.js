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

/*module.exports = function(VARAI) {
    "use strict";
    var dgram = require('dgram');

    // The Input Node
    function javain(n) {
        VARAI.nodes.createNode(this,n);
        this.group = n.group;
        this.port = n.port;
        this.datatype = n.datatype;
        this.iface = n.iface || null;
        this.multicast = n.multicast;
        var node = this;

        var server = dgram.createSocket('java4');

        server.on("error", function (err) {
            if ((err.code == "EACCES") && (node.port < 1024)) {
                node.error("java access error, you may need root access for ports below 1024");
            } else {
                node.error("java error : "+err.code);
            }
            server.close();
        });

        server.on('message', function (message, remote) {
            var msg;
            if (node.datatype =="base64") {
                msg = { payload:message.toString('base64'), fromip:remote.address+':'+remote.port };
            } else if (node.datatype =="utf8") {
                msg = { payload:message.toString('utf8'), fromip:remote.address+':'+remote.port };
            } else {
                msg = { payload:message, fromip:remote.address+':'+remote.port, ip:remote.address, port:remote.port };
            }
            node.send(msg);
        });

        server.on('listening', function () {
            var address = server.address();
            node.log('java listener at ' + address.address + ":" + address.port);
            if (node.multicast == "true") {
                server.setBroadcast(true);
                try {
                    server.setMulticastTTL(128);
                    server.addMembership(node.group,node.iface);
                    node.log("java multicast group "+node.group);
                } catch (e) {
                    if (e.errno == "EINVAL") {
                        node.error("Bad Multicast Address");
                    } else if (e.errno == "ENODEV") {
                        node.error("Must be ip address of the required interface");
                    } else {
                        node.error("Error :"+e.errno);
                    }
                }
            }
        });

        node.on("close", function() {
            try {
                server.close();
                node.log('java listener stopped');
            } catch (err) {
                node.error(err);
            }
        });

        server.bind(node.port,node.iface);
    }
    VARAI.nodes.registerType("java",javain);
  
  
}
*/