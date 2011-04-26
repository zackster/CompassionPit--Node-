(function () {
    "use strict";
    
    var Room = require("./models").Room;
    
    module.exports = function (app) {
        app.get("/counts", function (req, res) {
            var numListeners = 0;
            var numVenters = 0;
    
            Room.forEach(function (room, id) {
                numListeners += room.getNumClientsOfType("listener");
                numVenters += room.getNumClientsOfType("venter");
            });
    
            res.send({
                listeners: numListeners,
                venters: numVenters
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