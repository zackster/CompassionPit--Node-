(function () {
    "use strict";
    
    var Room = require("./models").Room;
    
    module.exports = function (app) {
        app.get("/counts", function (req, res) {
            var numListeners = 0;
            var numVenters = 0;
            var roomIds = [];
    
            Room.forEach(function (room, id) {
                if (room.hasType("listener")) {
                    numListeners += 1;
                }
                if (room.hasType("venter")) {
                    numVenters += 1;
                }
                roomIds.push(id);
            });
    
            res.send({
                listeners: numListeners,
                venters: numVenters,
                rooms: roomIds,
            });
        });
    
        app.get("/dump", function (req, res) {
            var rooms = [];
            Room.forEach(function (room) {
                rooms.push(room);
            });
            res.send(rooms);
        });
    };
}());