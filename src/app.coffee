util = require "util"
_    = require "underscore"

process.on "uncaughtException", (err) ->
  util.puts "We found an uncaught exception."
  util.puts err
  util.puts err.stack

do ->
  registerSocketIO = (app) ->
    socket = undefined
    socket = app.socket = socketIO.listen(app)
    socket.set "log level", 1
    socketHandlers = {}

    socket.configure ->
      socket.set "authorization", (handshakeData, callback) ->
        headers = handshakeData.headers
        if headers
          ipAddress = headers["x-forwarded-for"]
          handshakeData.address.address = ipAddress  if ipAddress
        callback null, true

      socket.sockets.on "connection", (client) ->
        client.on "message", latencyWrap((data) ->
          type = data.t
          if type
            handler = socketHandlers[type]
            if handler
              user = User.getBySocketIOId(client.id)
              if type isnt "register" and not user
                console.log "Received message from unregistered user: " + client.id + ": " + JSON.stringify(data)
              else
                user.lastReceivedMessageIndex = data.i  if user and data.i and user.lastReceivedMessageIndex < data.i
                handler client, user, data.d, (result) ->
                  message = undefined
                  if type is "register"
                    message = t: "register"
                  else
                    message = i: data.i
                  message.d = result  if result isnt null and result isnt `undefined`
                  if type isnt "register"
                    user.send message
                  else
                    forceLatency ->
                      client.json.send message
            else
              throw new Error("Received message with unknown handler: " + data.t)
          else
            throw new Error("Received improper message", JSON.stringify(data))
        )
        client.on "disconnect", latencyWrap(->
          clientId = client.id
          user = User.getBySocketIOId(clientId)
          uid = (if user then user.id else null)
          log.store "disconnect", client.id
          log.info
            event: "Disconnected"
            client: clientId
            user: uid

          user.setSocketIOId null  if user
          Room.checkQueues()
        )
        log.info
          event: "Connected"
          client: client.id

        log.store "connect", client.id

      setInterval (->
        User.cleanup()
        Room.checkQueues()
      ), 5000

    _.extend socketHandlers,
      register: (client, _, data, callback) ->
        data = {}  unless data
        userId = data.u or null
        publicUserId = data.p or null
        lastMessageReceived = data.n or 0
        userAgent = data.a or null
        referrer = data.r or null
        clientId = client.id
        user = userId and User.getById(userId)
        isNewUser = not user
        if isNewUser
          if userId and publicUserId
            user = new User(clientId, userId, publicUserId)
          else
            user = new User(clientId, null, null)
          user.getIPAddress()
          user.referrer = referrer or ""
          user.userAgent = userAgent or ""
          user.disconnect ->
            room = Room.getByUserId(user.id)
            if room
              room.removeUser user.id, "disconnect"
            else
              Room.removeUserFromQueue user.id
            log.info
              event: "Delete user"
              user: user.id

          user.setSocketIOId client.id, lastMessageReceived
        else
          user.setSocketIOId client.id, lastMessageReceived
          log.info
            event: "Reconnected"
            client: clientId
            user: user.id
        if (process.env.NODE_ENV or "development") is "development"
          callback [ config.version, isNewUser, user.id, user.publicId, user.lastReceivedMessageIndex, "Zachary Burt" ]
        else
          req = client.manager.handshaken[clientId.toString()]
          if req.headers and req.headers.cookie
            req.cookies = require("connect").utils.parseCookie(req.headers.cookie)
            authServer.checkLogin req, (username) ->
              if username isnt false
                authServer.logged_in_users[user.id] = username
                callback [ config.version, isNewUser, user.id, user.publicId, user.lastReceivedMessageIndex, username ]
              else
                callback [ config.version, isNewUser, user.id, user.publicId, user.lastReceivedMessageIndex, false ]
          else
            callback [ config.version, isNewUser, user.id, user.publicId, user.lastReceivedMessageIndex, false ]
        Room.checkQueues()

      queue: (client, user, _, callback) ->
        queue_info = Room.getQueuePosition(user.id)
        log.logWaitTime
          userid: user.id
          user_type: queue_info.user_type
          queuePosition: queue_info.queue_position
          join_time: user.join_time
          current_time: new Date().getTime()

        callback queue_info.queue_position

      authenticateUser: (client, user, data, callback) ->
        authServer.login user.id, data.username, data.password, (success) ->
          if success
            feedbackServer.creditFeedback
              id: user.id
              username: data.username

            callback true
          else
            callback false

      updateHUD: (client, user, data, callback) ->
        listenerId = user.id
        feedbackServer.getLeaderboardForUser listenerId, (info) ->
          callback info

        return

      listenerFeedback: (client, user, data, callback) ->
        venterId = user.id
        room = Room.getByUserId(venterId)
        return  unless room
        listenerId = room.conversation.listener.userId
        console.log "Adding feedback..."
        feedbackServer.addFeedback
          venter: venterId
          listener: listenerId
          direction: data.direction

        console.log "Sending acknowledgement...."
        console.log "sending to: ", listenerId
        room.sendToUser listenerId, "received-feedback", data.direction

      getPreviousPartner: (client, user, data, callback) ->
        previous_partners = User.getById(user.id).partner_list
        callback authServer.getUsernameFromListenerId(previous_partners[previous_partners.length() - 2])

      join: (client, user, data, callback) ->
        type = data.type
        type = "listener"  if type isnt "venter"
        userId = user.id
        room = Room.getByUserId(userId)
        room.removeUser userId, "request"  if room
        Room.addUserToQueue userId, data.type, data.partnerId, data.priority
        callback true

      msg: (client, user, message, callback) ->
        userId = user.id
        room = Room.getByUserId(userId)
        unless room
          callback false
          return
        log.store "messageSent"
        room.receiveMessage userId, message, callback

      typing: (client, user, message, callback) ->
        userId = user.id
        room = Room.getByUserId(userId)
        unless room
          callback false
          return
        room.sendTypeStatus userId, message, callback

      ping: (client, user, _, callback) ->
        userId = user.id
        room = Room.getByUserId(userId)
        room.poke userId  if room
        callback "pong"  if callback

      counts: (client, user, _, callback) ->
        callback getRoomCounts()

  "use strict"
  require "./database/singleton"

  express         = require("express")
  app             = module.exports = express.createServer()
  util            = require("util")
  socketIO        = require("socket.io")
  Room            = require("./rooms/models").Room
  User            = require("./users/models").User
  guid            = require("./utils").guid
  forceLatency    = require("./utils").forceLatency
  latencyWrap     = require("./utils").latencyWrap
  config          = require("./config")
  log             = require("./log")
  mergeStatic     = require("./mergeStatic")
  geoip           = require("geoip")
  vB_dao          = require("./vBDao")
  authServer      = require("./authentication/auth-server").authServer()
  feedbackServer  = require("./feedback/feedback-server").feedbackServer()

  getRoomCounts = ->
    result = Room.calculateCounts()

    counts =
      l: result[0]
      v: result[1]

  registerAppRoutes = (app) ->
    app.sessionId = guid()
    app.geoipCity = new geoip.City(__dirname + "/GeoLiteCity.dat")
    app.dynamicHelpers base: ->
      (if "/" is app.route then "" else app.route)

    app.helpers config: config
    app.configure ->
      app.use express["static"](__dirname + "/static")
      app.use express.bodyParser()
      app.use express.cookieParser()
      app.use express.errorHandler(
        dumpExceptions: true
        showStack: true
      )

    app.set "views", __dirname + "/views"
    app.set "view engine", "jade"
    app.get "/", (req, res, next) ->
      opts =
        loggedOut: false
        roomCounts: getRoomCounts()

      opts.loggedOut = true  if req.query and req.query.logout is "true"
      res.render "index", opts

    app.get "/counts", (req, res) ->
      res.setHeader "content-type", "application/json"
      res.end JSON.stringify(getRoomCounts())

    app.get "/index.html", (req, res) ->
      res.redirect "/", 301

    app.get "/about-us", (req, res) ->
      res.render "about-us"

    app.get "/about-us.html", (req, res) ->
      res.redirect "/about-us", 301

    app.get "/contact", (req, res) ->
      res.render "contact"

    app.get "/faq", (req, res) ->
      res.render "faq"

    app.get "/privacy-policy", (req, res) ->
      res.render "privacy-policy"

    app.get "/privacypolicy.html", (req, res) ->
      res.redirect "/privacy-policy", 301

    app.get "/terms-of-service", (req, res) ->
      res.render "terms-of-service"

    app.get "/tos.html", (req, res) ->
      res.redirect "/terms-of-service", 301

    app.get "/vent", (req, res) ->
      res.render "chat",
        type: "venter"
        layout: "minimal-layout"

    app.get "/listen", (req, res) ->
      if (process.env.NODE_ENV or "development") is "development"
        res.render "chat",
          type: "listener"
          layout: "minimal-layout"
      else
        authServer.checkLogin req, (username) ->
          if username
            vB_dao.getEmailAndJoindateForUser username, (vB_info) ->
              res.render "chat",
                type: "listener"
                layout: "minimal-layout"
                email: vB_info.email
                created_at: vB_info.created_at
                show_intercom: true
          else
            feedbackServer.ipAddressHasNeverReceivedNegativeFeedback req.headers["x-forwarded-for"] or req.address.address, (clean_record) ->
              if clean_record
                res.render "chat",
                  layout: "minimal-layout"
                  type: "listener"
                  show_intercom: false
              else
                res.render "listener-registration"

    app.get "/chat.html", (req, res) ->
      if req.query
        switch req.query.type
          when "venter"
            res.redirect "/vent", 301
            return
          when "listener"
            res.redirect "/listen", 301
            return
      res.redirect "/", 301

    app.get "/system", (req, res) ->
      res.render "system"

    app.post "/system", (req, res) ->
      if req.body.password isnt config.systemPassword
        res.send "Wrong password"
      else if !req.body.message
        res.send "No message provided"
      else if req.body.restart and isNaN(parseInt(req.body.restartTime, 10))
        res.send "Bad restart time specified"
      else
        message = req.body.message
        forceLatency ->
          socketIO.sockets.json.send
            t: "sysmsg"
            d: message

        if req.body.restart
          setTimeout (->
            require("child_process").spawn "forever", [ "restart", "app.js" ]
          ), parseInt(req.body.restartTime, 10) * 1000
        res.send "Successfully sent " + JSON.stringify(message)

    app.get "/leaderboard", (req, res) ->
      authServer.checkLogin req, (username) ->
        feedbackServer.getLeaderboard true, (top15) ->
          if username
            feedbackServer.getLeaderboardForUser username, (userStats) ->
              res.render "leaderboard",
                scores: top15
                username: username
                userLeaderboard: userStats
          else
            res.render "leaderboard",
              scores: top15
              username: username

    require("./rooms/actions")(app)
    log.addActions app

  unless config.serveMerged
    mergeStatic = (callback) ->
      callback "", ""

  mergeStatic (jsHash, cssHash) ->
    app.helpers
      jsHash: jsHash
      cssHash: cssHash

    util.puts "Registering app routes"
    registerAppRoutes app
    util.puts "Registering Socket.IO"
    registerSocketIO app
    app.listen config.port
    util.puts "Server started on port " + config.port
