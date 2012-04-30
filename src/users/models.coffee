"use strict"
log = require("../log")
createHash = require("../utils").createHash
guid = require("../utils").guid
config = require("../config")
forceLatency = require("../utils").forceLatency
userIdToUser = {}
userPublicIdToUserId = {}
userIdToSocketIOId = {}
socketIOIdToUserId = {}
userIdsWithoutSocketIOClient = {}

User = (socketIOId, id, publicId) ->
  @id = id = id or guid()
  @publicId = publicId = publicId or guid()
  @join_time = new Date().getTime()
  @partner_list = []
  @socket = require("../app").socket
  @messageBacklog = []
  @messageQueue = []
  @socketIOId = socketIOId
  userIdToSocketIOId[id] = socketIOId
  socketIOIdToUserId[socketIOId] = id
  userIdToUser[id] = this
  userPublicIdToUserId[publicId] = id
  @disconnectCallbacks = []
  @lastSentMessageIndex = 0
  @lastReceivedMessageIndex = 0
  @userAgent = ""

User::setSocketIOId = (newId, lastMessageClientReceived) ->
  oldId = @socketIOId
  return  if oldId is newId
  delete socketIOIdToUserId[oldId]

  if newId
    userIdToSocketIOId[@id] = @socketIOId = newId
    socketIOIdToUserId[newId] = @id
    delete userIdsWithoutSocketIOClient[@id]

    delete @disconnectTime

    @flushMessageQueue lastMessageClientReceived
  else
    @socketIOId = null
    delete userIdToSocketIOId[@id]

    userIdsWithoutSocketIOClient[@id] = true
    @disconnectTime = Date.now() + config.disconnectLeeway

User::isClientConnected = ->
  clientId = @socketIOId
  return false  unless clientId
  !!@socket.connected[clientId]

User::disconnect = (callback) ->
  @disconnectCallbacks.push callback

User::destroy = ->
  i = 0
  len = @disconnectCallbacks.length

  while i < len
    @disconnectCallbacks[i].call this
    i += 1
  id = @id
  delete userIdsWithoutSocketIOClient[id]

  delete userPublicIdToUserId[@publicId]  if userPublicIdToUserId[@publicId] is id
  socketIOId = userIdToSocketIOId[id]
  if socketIOId
    delete userIdToSocketIOId[id]

    delete socketIOIdToUserId[socketIOId]  if socketIOIdToUserId[socketIOId] is id
  delete userIdToUser[id]

User::getIPAddress = ->
  return @ipAddress  if @ipAddress
  socketIOId = userIdToSocketIOId[@id]
  return null  unless socketIOId
  return null  unless @socket.connected[socketIOId]
  client = @socket.of("").socket(socketIOId)
  return null  unless client
  @ipAddress = client.handshake.address.address

User::setIPAddress = (ipAddress) ->
  @ipAddress = ipAddress

configGeoParts = config.geoLocationParts or []
User::lookupGeoIP = (callback) ->
  ipAddress = @getIPAddress()
  if not ipAddress or ipAddress is "127.0.0.1"
    callback null
  else
    require("../app").geoipCity.lookup ipAddress, (err, data) ->
      if err
        log.error
          event: "GeoIP"
          error: String(err.message)
          stack: String(err.stack)
          ipAddress: ipAddress

        callback null
        return
      parts = []
      i = 0
      len = configGeoParts.length

      while i < len
        part = data[configGeoParts[i]]
        parts.push part  if part and isNaN(Number(part, 10))
        i += 1
      geoIp = parts.join(", ") or null
      if geoIp is null or not data.country_name
        callback null
      else
        callback geoIp

User::flushMessageQueue = (lastMessageClientReceived) ->
  clientId = @socketIOId
  return  unless clientId
  return  unless @socket.connected[clientId]
  client = @socket.of("").socket(clientId)
  backlog = @messageBacklog
  queue = @messageQueue
  forceLatency ->
    i = undefined
    len = undefined
    message = undefined
    wholeMessage = []
    if lastMessageClientReceived
      i = 0
      len = backlog.length

      while i < len
        message = backlog[i]
        wholeMessage.push message  if message.n > lastMessageClientReceived
        i += 1
    len = queue.length
    i = 0
    while i < len
      message = queue[i]
      wholeMessage.push message
      backlog.push message
      i += 1
    queue.length = 0
    backlog.splice 0, backlog.length - config.messageBacklogPerUser  if backlog.length > config.messageBacklogPerUser
    i = 0
    len = wholeMessage.length

    while i < len
      client.json.send wholeMessage[i]
      i += 1

User::send = (message) ->
  message.n = @lastSentMessageIndex = @lastSentMessageIndex + 1
  @messageQueue.push message
  @flushMessageQueue()

User.getById = (id) ->
  user = userIdToUser[id]
  user  if user

User.getByPublicId = (publicId) ->
  id = userPublicIdToUserId[publicId]
  User.getById id  if id

User.getBySocketIOId = (socketIOId) ->
  userId = socketIOIdToUserId[socketIOId]
  User.getById userId  if userId

User.cleanup = ->
  maxDisconnectTime = Date.now()
  ids = Object.keys(userIdsWithoutSocketIOClient)
  count = ids.length
  i = 0

  while i < count
    id = ids[i]
    user = userIdToUser[id]
    user.destroy()  if user.disconnectTime < maxDisconnectTime
    i += 1

module.exports.User = User