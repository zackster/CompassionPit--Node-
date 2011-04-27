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
        config = require("./config"),
        log = require("./log");
    
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
        app.use(express.static(__dirname + '/static'));
        app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
    });
    
    app.set('views', __dirname + '/views');
    app.set('view engine', 'jade');
    
    app.get("/", function (req, res, next) {
        connect.static.send(req, res, next, {
            path: "static/index.html"
        });
    });
    
    require("./rooms/actions")(app);
    log.addActions(app);
    
    if (!module.parent) {
        require('sys').puts("Server started on port " + config.port);
        app.listen(config.port);
    }

    var everyone = nowjs.initialize(app, {
        port: config.nowjsPort,
        host: config.nowjsHost
    });

    var clientIdToRoomId = Object.create(null);

    everyone.now.sendMessage = function (message, callback) {
        var clientId = this.user.clientId;
        var roomId = clientIdToRoomId[clientId];
        
        var room = roomId && Room.get(roomId);
        if (!room) {
            if (callback) {
                callback(null);
            }
            return;
        }
        
        room.send(message, clientId, callback || function () {});
    };

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

        room = Room.findOrCreate(type, oldRoomId);
        
        clientIdToRoomId[clientId] = room.id;
        room.addUser(clientId, type);
        callback(true);
    };
    
    everyone.now.ping = function (callback) {
        var clientId = this.user.clientId;

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
    
    everyone.now.getQueuePosition = function (callback) {
        var clientId = this.user.clientId;

        var roomId = clientIdToRoomId[clientId];
        var room;
        if (roomId) {
            room = Room.get(roomId);
            if (room) {
                room.poke(clientId);
            }
        }
        
        callback(room.getQueuePosition(clientId));
    };

    everyone.disconnected(function () {
        var clientId = this.user.clientId;
        var roomId = clientIdToRoomId[clientId];
        if (roomId) {
            delete clientIdToRoomId[clientId];
        
            var room = Room.get(roomId);
            if (room) {
                room.removeUser(clientId);
            }
        }

        log.info({
            event: "Disconnected",
            client: clientId,
            room: roomId || null
        });
    });
    
    process.on('uncaughtException', function (err) {
        log.error({
            event: "Uncaught exception",
            error: String(err.message),
            stack: String(err.stack)
        });
    });
}());