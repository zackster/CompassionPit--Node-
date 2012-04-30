"use strict"

Room = require("./models").Room

module.exports = (app) ->
  app.get "/dump", (req, res) ->
    rooms = []
    Room.forEach (room) ->
      rooms.push room

    res.send rooms