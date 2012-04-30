(->
  "use strict"
  config = require("./config")
  mongoose = require("mongoose")
  Schema = mongoose.Schema
  ObjectId = Schema.ObjectId
  mongoose.model "LogEntry", new Schema(
    userid:
      type: String

    action:
      type: String
      enum: [ "messageSent", "connect", "disconnect", "joinRoom", "leaveRoom" ]

    time:
      type: Date
      default: Date.now

    count:
      type: Number
      default: 1
  )
  LogEntry = exports.LogEntry = mongoose.model("LogEntry")
  mongoose.model "WaitTime", new Schema(
    userid:
      type: String

    userType:
      type: String

    queuePosition:
      type: Number

    joinTime:
      type: Number

    currentTime:
      type: Number
      default: new Date().getTime()
  )
  WaitTime = exports.WaitTime = mongoose.model("WaitTime")
  mongoose.model "ClientError", new Schema(
    message:
      type: String

    locationUrl:
      type: String

    userAgent:
      type: String

    errorUrl:
      type: String

    lineNumber:
      type: Number

    time:
      type: Date
      default: Date.now
  )
  ClientError = exports.ClientError = mongoose.model("ClientError")
  logEntries = {}
  logCounts = {}
  makeLogFunction = (severity) ->
    logEntriesForSeverity = logEntries[severity] = []
    logCountsForSeverity = logCounts[severity] = {}
    limit = config.logLimits[severity] or 100
    (message) ->
      message.time = Date.now()
      logEntriesForSeverity.push message
      event = message.event
      logCountsForSeverity[event] = (logCountsForSeverity[event] or 0) + 1
      logEntriesForSeverity.shift()  while logEntriesForSeverity.length > limit

  exports.info = makeLogFunction("info")
  exports.warn = makeLogFunction("warn")
  exports.error = makeLogFunction("error")
  exports.store = (action, userid) ->
    if userid
      entry = new LogEntry(
        action: action
        userid: userid
      )
    else
      entry = new LogEntry(action: action)
    entry.save (err) ->
      if err
        exports.error
          event: "Cannot save LogEntry"
          error: err.toString()

  exports.logWaitTime = (waiter_info) ->
    wait_time = new WaitTime(
      userId: waiter_info.userid
      userType: waiter_info.user_type
      queuePosition: waiter_info.queue_position
      joinTime: waiter_info.join_time
      currentTime: waiter_info.current_time
    )
    wait_time.save (err) ->
      if err
        exports.error
          event: "Cannot save WaitTime"
          error: err.toString()

  exports.addActions = (app) ->
    app.get "/logs", (req, res) ->
      res.render "logs",
        logTypes: Object.keys(logEntries)

    app.get "/logs.json", (req, res) ->
      roomData = require("./rooms/models").Room.dumpData()
      result =
        entries: logEntries
        counts: logCounts
        rooms: roomData.rooms
        listenerQueue: roomData.listenerQueue
        venterQueue: roomData.venterQueue

      ClientError.find {}, null,
        sort:
          time: -1

        limit: 1000
      , (err, errors) ->
        throw err  if err
        result.errors = errors
        res.writeHead 200,
          "Content-Type": "application/json"

        res.end JSON.stringify(result)

    app.post "/log-error", (req, res) ->
      error = new ClientError(
        message: req.body.errorMsg
        locationUrl: req.body.location
        userAgent: req.headers["user-agent"]
        errorUrl: req.body.url
        lineNumber: req.body.lineNumber
      )
      error.save (err) ->
        if err
          exports.error
            event: "Cannot save ClientError"
            error: err.toString()
            body: JSON.stringify(req.body)

      res.send ""

  exports.info event: "Server started"
)()
