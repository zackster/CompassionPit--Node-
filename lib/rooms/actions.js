(function() {
  "use strict";
  var Room;

  Room = require("./models").Room;

  module.exports = function(app) {
    return app.get("/dump", function(req, res) {
      var rooms;
      rooms = [];
      Room.forEach(function(room) {
        return rooms.push(room);
      });
      return res.send(rooms);
    });
  };

}).call(this);
