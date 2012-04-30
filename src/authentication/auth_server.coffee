"use strict"

hashlib = require("hashlib2")
createHash = require("../lib/utils").createHash
mysql = require("mysql")
config = require("../config")

class Server
  constructor: ()->
    @logged_in_users = createHash()

  getMySQLClient: ->
    client = mysql.createClient(
      user: config.vBulletin.username
      password: config.vBulletin.password
    )
    client.query "USE " + config.vBulletin.database
    client

  userInfo: (id, callback) ->
    client = @getMySQLClient()
    client.query "SELECT * FROM user WHERE userid = ? LIMIT 1", [ id ], (err, results, fields) ->
      throw err  if err
      callback results[0]
      client.end()

  getEmailAddressFromUsername: (username, callback) ->
    client = @getMySQLClient()
    client.query "SELECT email FROM user WHERE username = ? LIMIT 1", [ username ], (err, results, fields) ->
      throw err  if err
      callback results[0].email
      client.end()

  markLoggedIn: (user, callback) ->
    self = this
    @userInfo user, (uinfo) ->
      client = self.getMySQLClient()
      epoch_in_seconds = Date.now() / 1000
      client.query "UPDATE user SET lastactivity = ? WHERE userid = ? LIMIT 1", [ epoch_in_seconds, user ], (err, results, fields) ->
        throw err  if err
        if (epoch_in_seconds - uinfo.lastactivity) > 604800
          client.query "UPDATE user SET lastvisit = ? WHERE userid = ? LIMIT 1", [ uinfo.lastactivity, user ], ->
            client.end()
        callback.call self, uinfo.username
        client.end()

  checkLogin: (req, callback) ->
    self = this
    @getCookie req.cookies.bb_userid, req.cookies.bb_password, (user) ->
      if user
        self.markLoggedIn req.cookies.bb_userid, (username) ->
          callback.call self, username
      else
        self.getSession req, req.cookies.bb_sessionhash, (user) ->
          if user
            self.markLoggedIn user, (username) ->
              callback.call self, username
          else
            callback.call self, false

  getCookie: (id, pass, callback) ->
    self = this
    client = @getMySQLClient()
    client.query "SELECT * FROM user WHERE userid = ? LIMIT 1", [ id ], (err, results, fields) ->
      throw err  if err
      if results.length > 0
        row = results[0]
        dbpass = row.password
        if hashlib.md5(dbpass + "CpnsPhJPwVeQgmKX5Wdz8JOz4TV") is pass
          callback.call self, id
          client.end()
          return
      callback.call self, false
      client.end()

  getSession: (req, hash, callback) ->
    ip_address = undefined

    if "development" is (process.env.NODE_ENV or "development")
      ip_address = "127.0.0.1"
    else
      ip_address = req.headers["x-forwarded-for"] or req.address.address

    user_agent = req.headers["user-agent"]
    self = this
    ip = ip_address.split(".").slice(0, 3).join(".")
    newidhash = hashlib.md5(user_agent + ip)
    client = @getMySQLClient()

    client.query "SELECT * FROM session WHERE sessionhash = ? LIMIT 1", [ hash ], (err, results, fields) ->
      throw err  if err
      if results.length > 0
        row = results[0]
        idhash = row.idhash
        userid = row.userid
        lastactive = row.lastactivity
        epoch_in_seconds = Date.now() / 1000
        callback.call self, (if (idhash is newidhash and (epoch_in_seconds - lastactive) < 604800) then userid else false)
        client.end()
        return
      callback.call self, false
      client.end()

  getUsernameFromListenerId: (listener_id) ->
    @logged_in_users[listener_id]

  login: (id, username, password, callback) ->
    client = @getMySQLClient()
    client.query "USE " + config.vBulletin.database
    self = this
    client.query "SELECT username, password, salt FROM user WHERE username=?", [ username ], (err, results, fields) ->
      client.end()
      throw err  if err
      callback false  unless results.length
      if results[0].password is hashlib.md5(hashlib.md5(password) + results[0].salt)
        self.logged_in_users[id] = username
        callback true
      else
        callback false
      client.end()

module.exports.authServer = -> new Server()