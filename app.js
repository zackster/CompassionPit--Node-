/*jshint devel: true */

(function () {
    "use strict";
    
    var express = require("express");
    
    var app = module.exports = express.createServer(),
        sys = require("sys"),
        nowjs = require("now"),
        connect = require("connect"),
        Room = require("./rooms/models").Room,
        guid = require("./utils").guid,
        config = require("./config");
    
    app.dynamicHelpers({
        base: function () {
            // return the app's mount-point
            // so that urls can adjust. For example
            // if you run this example /post/add works
            // however if you run the mounting example
            // it adjusts to /blog/post/add
            return '/' === app.route ? '' : app.route;
        }
    });
    
    app.configure(function () {
        app.use(express.logger('\x1b[33m:method\x1b[0m \x1b[32m:url\x1b[0m :response-time'));
        app.use(express.favicon(__dirname + '/static/favicon.ico'));
        app.use(express.bodyParser());
        app.use(express.methodOverride());
        app.use(express.cookieParser());
        app.use(express.session({ secret: 'FRV28vqUlKTXOKxl7SsH3sgJCXNfWruOmi2AsuTMGpSHFY6efhcd2gQDwzSN' }));
        app.use(express.static(__dirname + '/static'));
        app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    });
    
    app.get("/", function (req, res, next) {
        connect.static.send(req, res, next, {
            path: "static/index.html"
        });
    });
    
    require("./rooms/actions")(app);
    
    if (!module.parent) {
        require('sys').puts("Server started on port " + config.port);
        app.listen(config.port);
    }

    var everyone = nowjs.initialize(app);

    everyone.now.sendMessage = function (params, callback) {
        var roomId = params.rid;

        var room = Room.get(roomId);
        if (!room) {
            if (callback) {
                callback(null);
            }
            return;
        }
        
        room.send(params.data, this.user.clientId, callback || function () {});
    };

    var clientIdToRoomId = {};

    everyone.now.join = function (type, callback) {
        var opposite;
        if (type === "venter") {
            opposite = "listener";
        } else {
            type = "listener";
            opposite = "venter";
        }

        var clientId = this.user.clientId;

        // disconnect from old room if rejoining
        var oldRoomId = clientIdToRoomId[clientId];
        var room;
        if (oldRoomId) {
            room = Room.get(oldRoomId);
            if (room) {
                room.removeUser(clientId);
            }
        }
        delete clientIdToRoomId[clientId];

        // find new room
        var found = false;
        Room.forEach(function (room, roomId) {
            if (oldRoomId && oldRoomId === roomId) {
                // we don't want to join the same room we just left.
                return;
            }
            if (!room.hasType(type)) {
                found = true;
                try {
                    clientIdToRoomId[clientId] = roomId;
                    room.addUser(clientId, type);
                    room.start();
                    
                    console.log(clientId + ": Joined existing room " + roomId);
                    return callback({ id: roomId });
                } catch (e) {
                    console.log(clientId + ": Fail joining room", e);
                    return callback({});
                }
            }
        });
        if (found) {
            return;
        }

        var roomId = guid();
        room = new Room(roomId);
        clientIdToRoomId[clientId] = roomId;

        room.addUser(clientId, type);
        
        console.log(clientId + ": Joined new room " + roomId);
        callback({ id: roomId });
    };
    
    everyone.now.ping = function (callback) {
        var clientId = this.user.clientId;

        // disconnect from old room if rejoining
        var roomId = clientIdToRoomId[clientId];
        var room;
        if (roomId) {
            room = Room.get(roomId);
            if (room) {
                room.poke(clientId);
            }
        }
        
        if (callback) {
            callback("pong");
        }
    };

    everyone.disconnected(function () {
        var clientId = this.user.clientId;
        var roomId = clientIdToRoomId[clientId];
        if (!roomId) {
            return;
        }

        delete clientIdToRoomId[clientId];
        
        var room = Room.get(roomId);
        if (room) {
            room.removeUser(clientId);
        }
    });
}());