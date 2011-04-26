/*jshint devel: true */

(function () {
    "use strict";
    
    var nowjs = require("now"),
        log = require("../log");
    
    var has = Object.prototype.hasOwnProperty;
    
    var EXPIRY_TIME = 60 * 1000; // 60 secs
    
    var rooms = {};
    
    var Room = exports.Room = function (id) {
        if (!(this instanceof Room)) {
            return new Room(id);
        }
        id = String(id);
        this.id = id;
        this.lastAccessTime = Date.now();
        this.group = nowjs.getGroup(id);
        this.clients = {};
        
        rooms[id] = this;
        
        log.info({
            event: "New room",
            room: id
        });
        
        var room = this;
        this.group.on('connect', function (clientId) {
            room.onConnect(this, clientId);
        });

        this.group.on('disconnect', function (clientId) {
            room.onDisconnect(this, clientId);
        });
    };
    
    Room.forEach = function (callback) {
        for (var key in rooms) {
            if (has.call(rooms, key)) {
                if (callback(rooms[key], key) === false) {
                    return;
                }
            }
        }
    };
    
    Room.get = function (id) {
        return rooms[id];
    };
    
    Room.prototype.delete = function () {
        log.info({
            event: "Delete room",
            room: this.id
        });
        delete rooms[this.id];
    };
    
    var VALID_TYPES = Object.create(null);
    VALID_TYPES.venter = true;
    VALID_TYPES.listener = true;
    Room.prototype.onConnect = function (client, clientId) {
        this.clients[clientId] = {
            type: 'unknown',
            accessTime: Date.now()
        };
        
        // let the new client know about the other clients in the room.
        for (var otherClientId in this.clients) {
            if (otherClientId !== clientId && has.call(this.clients, otherClientId)) {
                var otherClient = this.clients[otherClientId];
                if (VALID_TYPES[otherClient.type]) {
                    client.now.receive([
                        {
                            action: 'join',
                            type: otherClient.type
                        }
                    ]);
                }
            }
        }
    };
    
    Room.prototype.onDisconnect = function (client, clientId) {
        var clients = this.clients;
        delete clients[clientId];
        for (var key in clients) {
            if (has.call(clients, key)) {
                // have at least one still in.
                return;
            }
        }
        // didn't find any clients
        this.delete();
    };
    
    Room.prototype.poke = function (clientId) {
        this.lastAccessTime = Date.now();
        
        var client = this.clients[clientId];
        if (client) {
            client.accessTime = this.lastAccessTime;
        }
    };
    
    Room.prototype.hasType = function (type) {
        var clients = this.clients;
        for (var clientId in clients) {
            if (has.call(clients, clientId)) {
                var client = clients[clientId];
                if (client.type === type) {
                    return true;
                }
            }
        }
        return false;
    };
    
    Room.prototype.expired = function () {
        return this.lastAccessTime < Date.now() - EXPIRY_TIME;
    };
    
    Room.prototype.send = function (message, clientId, callback) {
        this.poke(clientId);
        
        var client = this.clients[clientId];
        if (!client || !VALID_TYPES[client.type]) {
            return;
        }
        message = {
            action: "message",
            type: client.type,
            data: message
        };
        
        log.info({
            event: "Chat",
            client: clientId,
            room: this.id,
            type: client.type || 'unknown'
        });
        this.group.now.receive([message]);
        
        callback(true);
    };
    
    Room.prototype.addUser = function (clientId, type) {
        this.group.addUser(clientId);
        var client = this.clients[clientId] || (this.clients[clientId] = {});
        client.type = type;
        client.accessTime = Date.now();
        log.info({
            event: "Add user",
            client: clientId,
            room: this.id,
            type: type
        });
        this.group.now.receive([
            {
                action: 'join',
                type: type
            }
        ]);
    };

    Room.prototype.removeUser = function (clientId) {
        var client = this.clients[clientId];
        this.group.removeUser(clientId);
        if (client) {
            log.info({
                event: "Remove user",
                client: clientId,
                room: this.id,
                type: client.type || 'unknown'
            });
            this.group.now.receive([
                {
                    type: client.type || 'unknown',
                    action: 'disconnect'
                }
            ]);
        }
    };
}());