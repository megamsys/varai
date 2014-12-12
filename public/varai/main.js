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

var VARAI = function() {

    $('#btn-keyboard-shortcuts').click(function(){showHelp();});

    function hideDropTarget() {
        $("#dropTarget").hide();
        VARAI.keyboard.remove(/* ESCAPE */ 27);
    }

    $('#chart').on("dragenter",function(event) {
        if ($.inArray("text/plain",event.originalEvent.dataTransfer.types) != -1) {
            $("#dropTarget").css({display:'table'});
            VARAI.keyboard.add(/* ESCAPE */ 27,hideDropTarget);
        }
    });

    $('#dropTarget').on("dragover",function(event) {
        if ($.inArray("text/plain",event.originalEvent.dataTransfer.types) != -1) {
            event.preventDefault();
        }
    })
    .on("dragleave",function(event) {
        hideDropTarget();
    })
    .on("drop",function(event) {
        var data = event.originalEvent.dataTransfer.getData("text/plain");
        hideDropTarget();
        VARAI.view.importNodes(data);
        event.preventDefault();
    });


    function save(force) {
        if (VARAI.view.dirty()) {

            if (!force) {
                var invalid = false;
                var unknownNodes = [];
                VARAI.nodes.eachNode(function(node) {
                    invalid = invalid || !node.valid;
                    if (node.type === "unknown") {
                        if (unknownNodes.indexOf(node.name) == -1) {
                            unknownNodes.push(node.name);
                        }
                        invalid = true;
                    }
                });
                if (invalid) {
                    if (unknownNodes.length > 0) {
                        $( "#node-dialog-confirm-deploy-config" ).hide();
                        $( "#node-dialog-confirm-deploy-unknown" ).show();
                        var list = "<li>"+unknownNodes.join("</li><li>")+"</li>";
                        $( "#node-dialog-confirm-deploy-unknown-list" ).html(list);
                    } else {
                        $( "#node-dialog-confirm-deploy-config" ).show();
                        $( "#node-dialog-confirm-deploy-unknown" ).hide();
                    }
                    $( "#node-dialog-confirm-deploy" ).dialog( "open" );
                    return;
                }
            }
            
            var nns = VARAI.nodes.createCompleteNodeSet();
            var dataLength = nns.length;
            var totalCS = 0;
            var totalCSLength = 0;
            
            for(i=0;i<dataLength; i++) {
            	if(nns[i].type == "cloudsettings" || nns[i].type == "docker") {            	
            		totalCS = totalCS + 1;
            		totalCSLength = totalCSLength + nns[i].wires[0].length;
            	  } 
            	}            
            
            if ((dataLength-totalCS) != totalCSLength) {
            	VARAI.notify("<strong>Error</strong>: Apps or Services are not properly configured. Please re-configure the apps or services.","error");
            	return;
            } 
            
            $("#btn-icn-deploy").removeClass('icon-upload');
            $("#btn-icn-deploy").addClass('spinner');
            VARAI.view.dirty(false);            
         
            //assemblies JSON creation 
            console.log(JSON.stringify(nns));
            var json = VARAI.nodes.assemblyJson(nns);
            console.log(JSON.stringify(json));
                       
           $.ajax({
                url:"flows",
                type: "POST",
                data: JSON.stringify(json),
                contentType: "application/json; charset=utf-8"
            }).done(function(data,textStatus,xhr) {            	
                VARAI.notify("Successfully deployed","success");
                VARAI.nodes.eachNode(function(node) {
                    if (node.changed) {
                        node.dirty = true;
                        node.changed = false;
                    }
                    if(node.credentials) {
                        delete node.credentials;
                    }
                });
                VARAI.nodes.eachConfig(function (confNode) {
                    if (confNode.credentials) {
                        delete confNode.credentials;
                    }
                });
                // Once deployed, cannot undo back to a clean state
                VARAI.history.markAllDirty();
                VARAI.view.redraw();
            }).fail(function(xhr,textStatus,err) {
                VARAI.view.dirty(true);
                if (xhr.responseText) {
                    VARAI.notify("<strong>Error</strong>: "+xhr.responseText,"error");
                } else {
                    VARAI.notify("<strong>Error</strong>: no response from server","error");
                }
            }).always(function() {
                $("#btn-icn-deploy").removeClass('spinner');
                $("#btn-icn-deploy").addClass('icon-upload');
            });
        }
    }

    $('#btn-deploy').click(function() { save(); });

    $( "#node-dialog-confirm-deploy" ).dialog({
            title: "Confirm deploy",
            modal: true,
            autoOpen: false,
            width: 530,
            height: 230,
            buttons: [
                {
                    text: "Confirm deploy",
                    click: function() {
                        save(true);
                        $( this ).dialog( "close" );
                    }
                },
                {
                    text: "Cancel",
                    click: function() {
                        $( this ).dialog( "close" );
                    }
                }
            ]
    });
    
    var workspaceIndex = 0;
    
    function setWorkSpace() {
    	 var tabId = VARAI.nodes.id();
         do {
             workspaceIndex += 1;
         } while($("#workspace-tabs a[title='Sheet "+workspaceIndex+"']").size() != 0);

         var ws = {type:"tab",id:tabId,label:"Sheet "+workspaceIndex};
    	VARAI.view.addWorkspace(ws);
    	//VARAI.view.loadWorkspace();
    }
    
     //add route for /:id
    function loadSettings() {
        $.get('settings', function(data) {
            VARAI.settings = data;
            console.log("varai: "+data.version);
            loadNodes();
        });
    }
    
    function loadDomains() {
    	$.getJSON("domains",function(domain) {         
        	try {        		
        	    var jsonResult = JSON.parse(domain);
        	    VARAI.editor.updateDomains(domain);
        	  }
        	  catch (e) {
        		  console.log(e);
        	    VARAI.notify("<strong>Error</strong>: no response from server, Domain is not loaded from server","error");
        	  };      
        });   	
    }
    
    function loadNodes() {
        $.get('nodes', function(data) {
            $("body").append(data);
            $(".palette-spinner").hide();
            $(".palette-scroll").show();
            $("#palette-search").show();
            //loadFlows();
            loadCloudSettings();
            loadDomains();
        });
    }

    function loadCloudSettings() {
       $.getJSON("cloudsettings",function(cs) {         
        	try {
        	    jsonResult = JSON.parse(cs);
        	    VARAI.editor.update(cs);
        	  }
        	  catch (e) {
        	    VARAI.notify("<strong>Error</strong>: no response from server, Clouds are not loaded from server","error");
        	  };      
        });   	
    	
    }
    
    function loadFlows() {
        $.getJSON("flows",function(nodes) {
        	console.log(nodes);
        	
            VARAI.nodes.import(nodes);
            VARAI.view.dirty(false);
            VARAI.view.redraw();           
        });
    }

    $('#btn-node-status').click(function() {toggleStatus();});

    var statusEnabled = false;
    function toggleStatus() {
        var btnStatus = $("#btn-node-status");
        statusEnabled = btnStatus.toggleClass("active").hasClass("active");
        VARAI.view.status(statusEnabled);
    }
    
    function showHelp() {

        var dialog = $('#node-help');

        //$("#node-help").draggable({
        //        handle: ".modal-header"
        //});

        dialog.on('show',function() {
            VARAI.keyboard.disable();
        });
        dialog.on('hidden',function() {
            VARAI.keyboard.enable();
        });

        dialog.modal();
    }

    $(function() {
        VARAI.keyboard.add(/* ? */ 191,{shift:true},function(){showHelp();d3.event.preventDefault();});
        $("#btn-deploy").addClass("disabled");
        setWorkSpace();
        loadFlows(); 
        loadSettings();     
        console.log("-----------------------------------entry");       
    }); 

    return {
    };
}();
