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
VARAI.history = function() {
    var undo_history = [];
    
    return {
        //TODO: this function is a placeholder until there is a 'save' event that can be listened to
        markAllDirty: function() {
            for (var i in undo_history) {
                undo_history[i].dirty = true;
            }
        },
        depth: function() {
            return undo_history.length;
        },
        push: function(ev) {
            undo_history.push(ev);
        },
        pop: function() {
            var ev = undo_history.pop();
            if (ev) {
                if (ev.t == 'add') {
                    for (var i in ev.nodes) {
                        VARAI.nodes.remove(ev.nodes[i]);
                    }
                    for (var i in ev.links) {
                        VARAI.nodes.removeLink(ev.links[i]);
                    }
                    for (var i in ev.workspaces) {
                        VARAI.nodes.removeWorkspace(ev.workspaces[i].id);
                        VARAI.view.removeWorkspace(ev.workspaces[i]);
                    }
                } else if (ev.t == "delete") {
                    for (var i in ev.workspaces) {
                        VARAI.nodes.addWorkspace(ev.workspaces[i]);
                        VARAI.view.addWorkspace(ev.workspaces[i]);
                    }
                    for (var i in ev.nodes) {
                        VARAI.nodes.add(ev.nodes[i]);
                    }
                    for (var i in ev.links) {
                        VARAI.nodes.addLink(ev.links[i]);
                    }
                } else if (ev.t == "move") {
                    for (var i in ev.nodes) {
                        var n = ev.nodes[i];
                        n.n.x = n.ox;
                        n.n.y = n.oy;
                        n.n.dirty = true;
                    }
                } else if (ev.t == "edit") {
                    for (var i in ev.changes) {
                        ev.node[i] = ev.changes[i];
                    }
                    VARAI.editor.updateNodeProperties(ev.node);
                    for (var i in ev.links) {
                        VARAI.nodes.addLink(ev.links[i]);
                    }
                    VARAI.editor.validateNode(ev.node);
                    ev.node.dirty = true;
                    ev.node.changed = ev.changed;
                }
                VARAI.view.dirty(ev.dirty);
                VARAI.view.redraw();
            }
        }
    }

}();
