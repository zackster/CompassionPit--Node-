"use strict"
mysql = require("mysql")
config = require("../config")
getMySQLClient = ->
  client = mysql.createClient(
    user: config.vBulletin.username
    password: config.vBulletin.password
  )
  client.query "USE " + config.vBulletin.database
  client

exports.getEmailAndJoindateForUser = (username, callback) ->
  client = getMySQLClient()
  client.query "SELECT email, joindate as created_at FROM user WHERE username = ?", [ username ], selectCb = (err, results, fields) ->
    if err
      throw err
    else
      callback results[0]
      client.end()
