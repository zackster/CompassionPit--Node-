(function () {
    "use strict";
    
    var Room = require("./models").Room;
    
    module.exports = function (app) {
        app.get("/dump", function (req, res) {
            var rooms = [];
            Room.forEach(function (room) {
                rooms.push(room);
            });
            res.send(rooms);
        });
        
    };
}());
