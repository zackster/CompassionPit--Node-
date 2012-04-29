config    = require(".././config")
mongoose  = require("mongoose")

mongoose.connect config.mongodb.uri, (err) ->
  throw err  if err
  console.log "Successfully Connected To Mongoose!"
  console.log "(" + config.mongodb.uri + ")"
