/*jshint devel: true */

(function () {
    "use strict";
    
    var nowjs = require("now"),
        log = require("../log"),
        guid = require("../utils").guid;
    
    var has = Object.prototype.hasOwnProperty;
    
    var EXPIRY_TIME = 60 * 1000; // 60 secs
    
    var rooms = Object.create(null);

    var VALID_TYPES = Object.create(null);
    VALID_TYPES.venter = true;
    VALID_TYPES.listener = true;
    
    var listenerRoomQueue = [];
    var venterRoomQueue = [];
    
    var Room = exports.Room = function (id) {
        if (!(this instanceof Room)) {
            return new Room(id);
        }
        id = String(id);
        this.id = id;
        this.sessionTime = this.lastAccessTime = Date.now();
        this.group = nowjs.getGroup(id);
        this.clients = Object.create(null);
        this.types = Object.create(null);
        this.types.venter = 0;
        this.types.listener = 0;
        
        rooms[id] = this;
        listenerRoomQueue.push(this);
        venterRoomQueue.push(this);
        
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
            if (callback(rooms[key], key) === false) {
                return;
            }
        }
    };
    
    Room.get = function (id) {
        return rooms[id];
    };
    
    Room.findOrCreate = function (type, oldRoomId) {
        if (!VALID_TYPES[type]) {
            throw new Error("Unknown type: " + type);
        }
        
        var queue = type === "venter" ? venterRoomQueue : listenerRoomQueue;
        
        for (var i = 0, len = queue.length; i < len; i += 1) {
            var room = queue[i];
            if (oldRoomId && room.id === oldRoomId) {
                continue;
            }
            return room;
        }
        
        return new Room(guid());
    };
    
    Room.dumpData = function () {
        var result = [];
        for (var roomId in rooms) {
            var room = rooms[roomId];
            result.push({
                id: roomId,
                clients: room.clients,
                time: room.lastAccessTime
            });
        }
        return result;
    };
    
    Room.prototype.getQueuePosition = function (clientId) {
        var type = this.clients[clientId];
        if (!VALID_TYPES[type]) {
            return -1;
        }
        
        var queue = type !== "venter" ? venterRoomQueue : listenerRoomQueue;
        return queue.indexOf(this);
    };
    
    Room.prototype.delete = function () {
        log.info({
            event: "Delete room",
            room: this.id
        });
        delete rooms[this.id];
        var index = venterRoomQueue.indexOf(this);
        if (index !== -1) {
            venterRoomQueue.splice(index, 1);
        }
        index = listenerRoomQueue.indexOf(this);
        if (index !== -1) {
            listenerRoomQueue.splice(index, 1);
        }
    };
    
    Room.prototype.onConnect = function (client, clientId) {
        if (!this.clients[clientId]) {
            this.clients[clientId] = 'unknown';
        }
        
        // let the new client know about the other clients in the room.
        for (var otherClientId in this.clients) {
            if (otherClientId !== clientId) {
                var otherClientType = this.clients[otherClientId];
                if (VALID_TYPES[otherClientType]) {
                    client.now.receive([
                        {
                            action: 'join',
                            type: otherClientType
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
            // have at least one still in.
            return;
        }
        // didn't find any clients
        this.delete();
    };
    
    Room.prototype.poke = function (clientId) {
        this.lastAccessTime = Date.now();
    };
    
    Room.prototype.hasType = function (type) {
        return !!this.types[type];
    };
    
    Room.prototype.isFull = function () {
        for (var type in VALID_TYPES) {
            if (!this.hasType(type)) {
                return false;
            }
        }
        return true;
    };
    
    Room.prototype.getNumClientsOfType = function (type) {
        return this.types[type];
    };
    
    Room.prototype.hasAnyClients = function () {
        for (var clientId in this.clients) {
            return true;
        }
        return false;
    };
    
    Room.prototype.getNumClients = function () {
        var count = 0;
        for (var clientId in this.clients) {
            count += 1;
        }
        return count;
    };
    
    Room.prototype.isExpired = function () {
        return this.lastAccessTime < Date.now() - EXPIRY_TIME;
    };
    
    Room.prototype.send = function (message, clientId, callback) {
        this.poke(clientId);
        
        var clientType = this.clients[clientId];
        if (!clientType || !VALID_TYPES[clientType]) {
            return;
        }
        
        log.info({
            event: "Chat",
            client: clientId,
            room: this.id,
            type: clientType
        });
        this.group.now.receive([{
            action: "message",
            type: clientType,
            data: message
        }]);
        
        callback(true);
    };
    
    Room.prototype.addUser = function (clientId, type) {
        if (!VALID_TYPES[type]) {
            throw new Error("Unknown type: " + type);
        }
        
        log.info({
            event: "Add user",
            client: clientId,
            room: this.id,
            type: type
        });
        if (this.hasAnyClients()) {
            this.group.now.receive([
                {
                    action: 'join',
                    type: type
                }
            ]);
        }
        this.sessionTime = Date.now();
        this.clients[clientId] = type;
        this.types[type] += 1;
        this.group.addUser(clientId);
        
        var queue = type === "venter" ? venterRoomQueue : listenerRoomQueue;
        
        var index = queue.indexOf(this);
        if (index !== -1) {
            queue.splice(index, 1);
        }
    };

    Room.prototype.removeUser = function (clientId) {
        var clientType = this.clients[clientId];
        if (clientType) {
            log.info({
                event: "Remove user",
                client: clientId,
                room: this.id,
                type: clientType || 'unknown'
            });
            if (clientType in this.types) {
                this.types[clientType] -= 1;
            }
        }
        
        this.sessionTime = Date.now();
        this.group.removeUser(clientId);
        if (this.hasAnyClients()) {
            this.group.now.receive([
                {
                    type: clientType || 'unknown',
                    action: 'disconnect'
                }
            ]);
            var queue = clientType === "venter" ? venterRoomQueue : listenerRoomQueue;
            if (queue.indexOf(this) === -1) {
                queue.push(this);
            }
        }
    };
}());
