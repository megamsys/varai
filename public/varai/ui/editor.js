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

VARAI.editor = function() {
    var editing_node = null;
    var cloudsettings = {};
    var domains = {};
    // TODO: should IMPORT/EXPORT get their own dialogs?

    function getCredentialsURL(nodeType, nodeID) {
        var dashedType = nodeType.replace(/\s+/g, '-');
        return  'credentials/' + dashedType + "/" + nodeID;
    }

    /**
     * Validate a node 
     * @param node - the node being validated
     * @returns {boolean} whether the node is valid. Sets node.dirty if needed
     */
    function validateNode(node) {
        var oldValue = node.valid;
        node.valid = validateNodeProperties(node, node._def.defaults, node);
        if (node._def._creds) {
            node.valid = node.valid && validateNodeProperties(node, node._def.credentials, node._def._creds);
        }
        if (oldValue != node.valid) {
            node.dirty = true;
        }
    }
    
    /**
     * Validate a node's properties for the given set of property definitions
     * @param node - the node being validated
     * @param definition - the node property definitions (either def.defaults or def.creds)
     * @param properties - the node property values to validate
     * @returns {boolean} whether the node's properties are valid
     */
    function validateNodeProperties(node, definition, properties) {
        var isValid = true;
        for (var prop in definition) {
            if (!validateNodeProperty(node, definition, prop, properties[prop])) {
                isValid = false;
            }
        }
        return isValid;
    }

    /**
     * Validate a individual node property
     * @param node - the node being validated
     * @param definition - the node property definitions (either def.defaults or def.creds)
     * @param property - the property name being validated
     * @param value - the property value being validated
     * @returns {boolean} whether the node proprty is valid
     */
    function validateNodeProperty(node,definition,property,value) {
        var valid = true;
        if ("required" in definition[property] && definition[property].required) {
            valid = value !== "";
        }
        if (valid && "validate" in definition[property]) {
            valid = definition[property].validate.call(node,value);
        }
        if (valid && definition[property].type && VARAI.nodes.getType(definition[property].type) && !("validate" in definition[property])) {
            if (!value || value == "_ADD_") {
                valid = false;
            } else {
                var v = VARAI.nodes.node(value).valid;
                valid = (v==null || v);
            }
        }
        return valid;
    }

    /**
     * Called when the node's properties have changed.
     * Marks the node as dirty and needing a size check.
     * Removes any links to non-existant outputs.
     * @param node - the node that has been updated
     * @returns {array} the links that were removed due to this update
     */
    function updateNodeProperties(node) {
        node.resize = true;
        node.dirty = true;
        var removedLinks = [];
        if (node.outputs < node.ports.length) {
            while (node.outputs < node.ports.length) {
                node.ports.pop();
            }
            var removedLinks = [];
            VARAI.nodes.eachLink(function(l) {
                    if (l.source === node && l.sourcePort >= node.outputs) {
                        removedLinks.push(l);
                    }
            });
            for (var l in removedLinks) {
                VARAI.nodes.removeLink(removedLinks[l]);
            }
        } else if (node.outputs > node.ports.length) {
            while (node.outputs > node.ports.length) {
                node.ports.push(node.ports.length);
            }
        }
        return removedLinks;
    }



    $( "#dialog" ).dialog({
            modal: true,
            autoOpen: false,
            closeOnEscape: false,
            width: 500,
            buttons: [
                {
                    text: "Ok",
                    click: function() {
                        if (editing_node) {
                            var changes = {};
                            var changed = false;
                            var wasDirty = VARAI.view.dirty();


                            if (editing_node._def.oneditsave) {
                                var oldValues = {};
                                for (var d in editing_node._def.defaults) {
                                    if (typeof editing_node[d] === "string" || typeof editing_node[d] === "number") {
                                        oldValues[d] = editing_node[d];
                                    } else {
                                        oldValues[d] = $.extend(true,{},{v:editing_node[d]}).v;
                                    }
                                }
                                var rc = editing_node._def.oneditsave.call(editing_node);
                                if (rc === true) {
                                    changed = true;
                                }

                                for (var d in editing_node._def.defaults) {
                                    if (oldValues[d] === null || typeof oldValues[d] === "string" || typeof oldValues[d] === "number") {
                                        if (oldValues[d] !== editing_node[d]) {
                                            changes[d] = oldValues[d];
                                            changed = true;
                                        }
                                    } else {
                                        if (JSON.stringify(oldValues[d]) !== JSON.stringify(editing_node[d])) {
                                            changes[d] = oldValues[d];
                                            changed = true;
                                        }
                                    }
                                }


                            }

                            if (editing_node._def.defaults) {
                                for (var d in editing_node._def.defaults) {
                                    var input = $("#node-input-"+d);
                                    var newValue;
                                    if (input.attr('type') === "checkbox") {
                                        newValue = input.prop('checked');
                                    } else {
                                        newValue = input.val();
                                    }
                                    if (newValue != null) {
                                        if (editing_node[d] != newValue) {
                                            if (editing_node._def.defaults[d].type) {
                                                if (newValue == "_ADD_") {
                                                    newValue = "";
                                                }
                                                // Change to a related config node
                                                var configNode = VARAI.nodes.node(editing_node[d]);
                                                if (configNode) {
                                                    var users = configNode.users;
                                                    users.splice(users.indexOf(editing_node),1);
                                                }
                                                var configNode = VARAI.nodes.node(newValue);
                                                if (configNode) {
                                                    configNode.users.push(editing_node);
                                                }
                                            }

                                            changes[d] = editing_node[d];
                                            editing_node[d] = newValue;
                                            changed = true;
                                        }
                                    }
                                }
                            }
                            if (editing_node._def.credentials) {
                                var prefix = 'node-input';
                                var credDefinition = editing_node._def.credentials;
                                var credsChanged = updateNodeCredentials(editing_node,credDefinition,prefix);
                                changed = changed || credsChanged;
                            }


                            var removedLinks = updateNodeProperties(editing_node);
                            if (changed) {
                                var wasChanged = editing_node.changed;
                                editing_node.changed = true;
                                VARAI.view.dirty(true);
                                VARAI.history.push({t:'edit',node:editing_node,changes:changes,links:removedLinks,dirty:wasDirty,changed:wasChanged});
                            }
                            editing_node.dirty = true;
                            validateNode(editing_node);
                            VARAI.view.redraw();
                        } else if (VARAI.view.state() == VARAI.state.EXPORT) {
                            if (/library/.test($( "#dialog" ).dialog("option","title"))) {
                                //TODO: move this to VARAI.library
                                var flowName = $("#node-input-filename").val();
                                if (!/^\s*$/.test(flowName)) {
                                    $.post('library/flows/'+flowName,$("#node-input-filename").attr('nodes'),function() {
                                            VARAI.library.loadFlowLibrary();
                                            VARAI.notify("Saved nodes","success");
                                    });
                                }
                            };
                        } else if (VARAI.view.state() == VARAI.state.IMPORT) {
                            VARAI.view.importNodes($("#node-input-import").val());
                        }
                        $( this ).dialog( "close" );
                    }
                },
                {
                    text: "Cancel",
                    click: function() {
                        $( this ).dialog( "close" );
                    }
                }
            ],
            resize: function(e,ui) {
                if (editing_node) {
                    $(this).dialog('option',"sizeCache-"+editing_node.type,ui.size);
                }
            },
            open: function(e) {
                VARAI.keyboard.disable();
                if (editing_node) {
                    var size = $(this).dialog('option','sizeCache-'+editing_node.type);
                    if (size) {
                        $(this).dialog('option','width',size.width);
                        $(this).dialog('option','height',size.height);
                    }
                }
            },
            close: function(e) {
                VARAI.keyboard.enable();

                if (VARAI.view.state() != VARAI.state.IMPORT_DRAGGING) {
                    VARAI.view.state(VARAI.state.DEFAULT);
                }
                $( this ).dialog('option','height','auto');
                $( this ).dialog('option','width','500');
                if (editing_node) {
                    VARAI.sidebar.info.refresh(editing_node);
                }
                VARAI.sidebar.config.refresh();
                editing_node = null;
            }
    });

    /**
     * Create a config-node select box for this property
     * @param node - the node being edited
     * @param property - the name of the field
     * @param type - the type of the config-node
     */
    function prepareConfigNodeSelect(node,property,type) {
        var input = $("#node-input-"+property);
        var node_def = VARAI.nodes.getType(type);

        input.replaceWith('<select style="width: 60%;" id="node-input-'+property+'"></select>');
        updateConfigNodeSelect(property,type,node[property]);
        var select = $("#node-input-"+property);
        select.after(' <a id="node-input-lookup-'+property+'" class="btn"><i class="icon icon-pencil"></i></a>');
        $('#node-input-lookup-'+property).click(function(e) {
            showEditConfigNodeDialog(property,type,select.find(":selected").val());
            e.preventDefault();
        });
        var label = "";
        var configNode = VARAI.nodes.node(node[property]);
        if (configNode && node_def.label) {
            if (typeof node_def.label == "function") {
                label = node_def.label.call(configNode);
            } else {
                label = node_def.label;
            }
        }
        input.val(label);
    }

    /**
     * Populate the editor dialog input field for this property
     * @param node - the node being edited
     * @param property - the name of the field
     * @param prefix - the prefix to use in the input element ids (node-input|node-config-input)
     */
    function preparePropertyEditor(node,property,prefix) {
        var input = $("#"+prefix+"-"+property);
        if (input.attr('type') === "checkbox") {
            input.prop('checked',node[property]);
        } else {
            var val = node[property];
            if (val == null) {
                val = "";
            }
            input.val(val);
        }
    }

    /**
     * Add an on-change handler to revalidate a node field
     * @param node - the node being edited
     * @param definition - the definition of the node
     * @param property - the name of the field
     * @param prefix - the prefix to use in the input element ids (node-input|node-config-input)
     */
    function attachPropertyChangeHandler(node,definition,property,prefix) {
        $("#"+prefix+"-"+property).change(function() {
            if (!validateNodeProperty(node, definition, property,this.value)) {
                $(this).addClass("input-error");
            } else {
                $(this).removeClass("input-error");
            }
        });
    }

    /**
     * Assign the value to each credential field
     * @param node
     * @param credDef
     * @param credData
     * @param prefix
     */
    function populateCredentialsInputs(node, credDef, credData, prefix) {
        for (var cred in credDef) {
            if (credDef.hasOwnProperty(cred)) {
                if (credDef[cred].type == 'password') {
                    if (credData[cred]) {
                        $('#' + prefix + '-' + cred).val(credData[cred]);
                    } else if (credData['has_' + cred]) {
                        $('#' + prefix + '-' + cred).val('__PWRD__');
                    }
                    else {
                        $('#' + prefix + '-' + cred).val('');
                    }
                } else {
                    preparePropertyEditor(credData, cred, prefix);
                }
                attachPropertyChangeHandler(node, credDef, cred, prefix);
            }
        }
        for (var cred in credDef) {
            if (credDef.hasOwnProperty(cred)) {
                $("#" + prefix + "-" + cred).change();
            }
        }
    }
    
    /**
     * Update the node credentials from the edit form
     * @param node - the node containing the credentials
     * @param credDefinition - definition of the credentials
     * @param prefix - prefix of the input fields
     * @return {boolean} whether anything has changed
     */
    function updateNodeCredentials(node, credDefinition, prefix) {
        var changed = false;
        if(!node.credentials) {
            node.credentials = {_:{}};
        }

        for (var cred in credDefinition) {
            if (credDefinition.hasOwnProperty(cred)) {
                var input = $("#" + prefix + '-' + cred);
                var value = input.val();
                if (credDefinition[cred].type == 'password') {
                    node.credentials['has_' + cred] = (value != "");
                    if (value == '__PWRD__') {
                        continue;
                    }
                    changed = true;
                    
                }
                if (value != node.credentials._[cred]) {
                    node.credentials[cred] = value;
                    changed = true;
                }
            }
        }
        return changed;
    }

    /**
     * Prepare all of the editor dialog fields
     * @param node - the node being edited
     * @param definition - the node definition
     * @param prefix - the prefix to use in the input element ids (node-input|node-config-input)
     */
    function prepareEditDialog(node,definition,prefix) {
        for (var d in definition.defaults) {
            if (definition.defaults[d].type) {
                prepareConfigNodeSelect(node,d,definition.defaults[d].type);
            } else {
                preparePropertyEditor(node,d,prefix);
            }
            attachPropertyChangeHandler(node,definition.defaults,d,prefix);
        }
        var completePrepare = function() {
            if (definition.oneditprepare) {
                definition.oneditprepare.call(node);
            }
            for (var d in definition.defaults) {
                $("#"+prefix+"-"+d).change();
            }
        }
        
        if (definition.credentials) {
            if (node.credentials) {
                populateCredentialsInputs(node, definition.credentials, node.credentials, prefix);
                completePrepare();
            } else {
                $.getJSON(getCredentialsURL(node.type, node.id), function (data) {
                    node.credentials = data;
                    node.credentials._ = $.extend(true,{},data);
                    populateCredentialsInputs(node, definition.credentials, node.credentials, prefix);
                    completePrepare();
                });
            }
        } else {
            completePrepare();
        }
    }

    function updateCloudSettings(cs) {
    	cloudsettings = cs;
    }
    
    function updateDomains(domain) {
    	domains = domain;
    }
    
    function parseCloudSettings(cs) {
    	var cs_response = JSON.parse(cs);
    	return cs_response.results;
    }
    
    function parseDomains(domain) {
    	var domain_response = JSON.parse(domain);
    	return domain_response.results;
    }
    
    function showEditDialog(node) {
        editing_node = node;
        VARAI.view.state(VARAI.state.EDITING);           
        $("#dialog-form").html($("script[data-template-name='"+node.type+"']").html());
        
        prepareEditDialog(node,node._def,"node-input");
        $( "#dialog" ).dialog("option","title","Edit "+node.type+" node").dialog( "open" );
        if (node.type == "cloudsettings") {
        	var css = parseCloudSettings(cloudsettings);
        	$.each(css, function (i, item) {
        	  if (item.spec["type_name"] != "docker") {
        	    $('#node-input-cloudsettings').append($('<option>', { 
        	        value: item.name,
        	        text : item.name 
        	      }));
        	    }
        	});
        } else {
           if (node.type == "docker") {
              var css = parseCloudSettings(cloudsettings);
        	  $.each(css, function (i, item) {
        	   if (item.spec["type_name"] == "docker") {
        	       $('#node-input-docker').append($('<option>', { 
        	          value: item.name,
        	          text : item.name 
        	       }));
        	    }
        	});
           } else {
           $("#node-input-name").val(chance.first()+chance.last());
           $("#node-input-app").val(chance.first()+chance.last()); 
           var dd = parseDomains(domains);
           $("#node-input-domain").val(dd[0].name);
         }
        }
    }

    function showEditConfigNodeDialog(name,type,id) {
        var adding = (id == "_ADD_");
        var node_def = VARAI.nodes.getType(type);
          
        var configNode = VARAI.nodes.node(id);
        if (configNode == null) {
            configNode = {
                id: (1+Math.random()*4294967295).toString(16),
                _def: node_def,
                type: type
            };
            for (var d in node_def.defaults) {
                if (node_def.defaults[d].value) {
                    configNode[d] = node_def.defaults[d].value;
                }
            }
        }

        $("#dialog-config-form").html($("script[data-template-name='"+type+"']").html());
        prepareEditDialog(configNode,node_def,"node-config-input");

        var buttons = $( "#node-config-dialog" ).dialog("option","buttons");
        if (adding) {
            if (buttons.length == 3) {
                buttons = buttons.splice(1);
            }
            buttons[0].text = "Add";
            $("#node-config-dialog-user-count").html("").hide();
        } else {
            if (buttons.length == 2) {
                buttons.unshift({
                        class: 'leftButton',
                        text: "Delete",
                        click: function() {
                            var configProperty = $(this).dialog('option','node-property');
                            var configId = $(this).dialog('option','node-id');
                            var configType = $(this).dialog('option','node-type');
                            var configNode = VARAI.nodes.node(configId);
                            var configTypeDef = VARAI.nodes.getType(configType);

                            if (configTypeDef.ondelete) {
                                configTypeDef.ondelete.call(VARAI.nodes.node(configId));
                            }
                            VARAI.nodes.remove(configId);
                            for (var i in configNode.users) {
                                var user = configNode.users[i];
                                for (var d in user._def.defaults) {
                                    if (user[d] == configId) {
                                        user[d] = "";
                                    }
                                }
                                validateNode(user);
                            }
                            updateConfigNodeSelect(configProperty,configType,"");
                            VARAI.view.dirty(true);
                            $( this ).dialog( "close" );
                            VARAI.view.redraw();
                        }
                });
            }
            buttons[1].text = "Update";
            $("#node-config-dialog-user-count").html(configNode.users.length+" node"+(configNode.users.length==1?" uses":"s use")+" this config").show();
        }
        $( "#node-config-dialog" ).dialog("option","buttons",buttons);

        $( "#node-config-dialog" )
            .dialog("option","node-adding",adding)
            .dialog("option","node-property",name)
            .dialog("option","node-id",configNode.id)
            .dialog("option","node-type",type)
            .dialog("option","title",(adding?"Add new ":"Edit ")+type+" config node")
            .dialog( "open" );
    }

    function updateConfigNodeSelect(name,type,value) {
        var select = $("#node-input-"+name);
        var node_def = VARAI.nodes.getType(type);
        select.children().remove();
        VARAI.nodes.eachConfig(function(config) {
            if (config.type == type) {
                var label = "";
                if (typeof node_def.label == "function") {
                    label = node_def.label.call(config);
                } else {
                    label = node_def.label;
                }
                select.append('<option value="'+config.id+'"'+(value==config.id?" selected":"")+'>'+label+'</option>');
            }
        });

        select.append('<option value="_ADD_"'+(value==""?" selected":"")+'>Add new '+type+'...</option>');
        window.setTimeout(function() { select.change();},50);
    }

    $( "#node-config-dialog" ).dialog({
            modal: true,
            autoOpen: false,
            width: 500,
            closeOnEscape: false,
            buttons: [
                {
                    text: "Ok",
                    click: function() {
                        var configProperty = $(this).dialog('option','node-property');
                        var configId = $(this).dialog('option','node-id');
                        var configType = $(this).dialog('option','node-type');
                        var configAdding = $(this).dialog('option','node-adding');
                        var configTypeDef = VARAI.nodes.getType(configType);
                        var configNode;

                        if (configAdding) {
                            configNode = {type:configType,id:configId,users:[]};
                            for (var d in configTypeDef.defaults) {
                                var input = $("#node-config-input-"+d);
                                configNode[d] = input.val();
                            }
                            configNode.label = configTypeDef.label;
                            configNode._def = configTypeDef;
                            VARAI.nodes.add(configNode);
                            updateConfigNodeSelect(configProperty,configType,configNode.id);
                        } else {
                            configNode = VARAI.nodes.node(configId);
                            for (var d in configTypeDef.defaults) {
                                var input = $("#node-config-input-"+d);
                                configNode[d] = input.val();
                            }
                            updateConfigNodeSelect(configProperty,configType,configId);
                        }
                        if (configTypeDef.credentials) {
                            updateNodeCredentials(configNode,configTypeDef.credentials,"node-config-input");
                        }
                        if (configTypeDef.oneditsave) {
                            configTypeDef.oneditsave.call(VARAI.nodes.node(configId));
                        }
                        validateNode(configNode);

                        VARAI.view.dirty(true);
                        $(this).dialog("close");

                    }
                },
                {
                    text: "Cancel",
                    click: function() {
                        var configType = $(this).dialog('option','node-type');
                        var configId = $(this).dialog('option','node-id');
                        var configAdding = $(this).dialog('option','node-adding');
                        var configTypeDef = VARAI.nodes.getType(configType);

                        if (configTypeDef.oneditcancel) {
                            // TODO: what to pass as this to call
                            if (configTypeDef.oneditcancel) {
                                var cn = VARAI.nodes.node(configId);
                                if (cn) {
                                    configTypeDef.oneditcancel.call(cn,false);
                                } else {
                                    configTypeDef.oneditcancel.call({id:configId},true);
                                }
                            }
                        }
                        $( this ).dialog( "close" );
                    }
                }
            ],
            resize: function(e,ui) {
            },
            open: function(e) {
                if (VARAI.view.state() != VARAI.state.EDITING) {
                    VARAI.keyboard.disable();
                }
            },
            close: function(e) {
                $("#dialog-config-form").html("");
                if (VARAI.view.state() != VARAI.state.EDITING) {
                    VARAI.keyboard.enable();
                }
                VARAI.sidebar.config.refresh();
            }
    });


    return {
        edit: showEditDialog,
        editConfig: showEditConfigNodeDialog,
        update: updateCloudSettings,
        updateDomains: updateDomains,
        validateNode: validateNode,
        updateNodeProperties: updateNodeProperties // TODO: only exposed for edit-undo
    }
}();
