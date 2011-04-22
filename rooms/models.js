/*jshint devel: true */

(function () {
    "use strict";
    
    var nowjs = require("now");
    
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
        
        this.group.on('connect', this.onConnect.bind(this));

        this.group.on('disconnect', this.onDisconnect.bind(this));
    };
    
    Room.forEach = function (callback) {
        for (var key in rooms) {
            if (has.call(rooms, key)) {
                callback(rooms[key], key);
            }
        }
    };
    
    Room.get = function (id) {
        return rooms[id];
    };
    
    Room.prototype.delete = function () {
        console.log("Removing room", this.id);
        delete rooms[this.id];
    };
    
    Room.prototype.onConnect = function (clientId) {
        this.clients[clientId] = {
            type: 'unknown',
            accessTime: Date.now()
        };
    };
    
    Room.prototype.onDisconnect = function (clientId) {
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
    
    var VALID_TYPES = {
        venter: true,
        listener: true
    };
    Room.prototype.send = function (message, clientId, callback) {
        this.poke(clientId);
        
        var client = this.clients[clientId];
        if (!client || !has.call(VALID_TYPES, client.type)) {
            return;
        }
        message = {
            action: "message",
            type: client.type,
            data: message
        };

        this.group.now.receive([message]);
        
        callback(true);
    };

    Room.prototype.start = function () {
        this.group.now.receive([
            { action: 'join' }
        ]);
    };

    Room.prototype.addUser = function (clientId, type) {
        this.group.addUser(clientId);
        var client = this.clients[clientId] || (this.clients[clientId] = {});
        client.type = type;
        client.accessTime = Date.now();
    };

    Room.prototype.removeUser = function (clientId) {
        var client = this.clients[clientId];
        this.group.removeUser(clientId);
        if (client) {
            console.log(clientId + ": removed from room " + this.id);
            this.group.now.receive([
                {
                    type: client.type || 'unknown',
                    action: 'disconnect'
                }
            ]);
        }
    };
}());