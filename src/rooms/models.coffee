"use strict"
log = require("../log")
underscore = require("underscore")
guid = require("../lib/utils").guid
createHash = require("../lib/utils").createHash
User = require("../users/models").User
hashIPAddress = require("../lib/utils").hashIPAddress
feedbackServer = require("../feedback/feedback_server").feedbackServer()
async = require("async")
EXPIRY_TIME = 60 * 1000
REQUESTED_PARTNER_TIMEOUT = 10 * 1000
mongoose = require("mongoose")
(->
  Schema = mongoose.Schema
  ConversationPartner =
    userId:
      type: String

    hashedIPAddress:
      type: String

    geoLocation: {}
    userAgent:
      type: String

  Message = new Schema(
    partner:
      type: String
      enum: [ "venter", "listener", "system" ]

    text:
      type: String

    time:
      type: Date
      default: Date.now
  )
  mongoose.model "Conversation", new Schema(
    serverSession:
      type: String

    status:
      type: String
      enum: [ "active", "complete" ]

    startTime:
      type: Date
      default: Date.now

    finishTime:
      type: Date
      default: "01/01/0001"

    finishReason:
      type: String
      enum: [ "venterDisconnect", "listenerDisconnect", "venterRequest", "listenerRequest", "venterReportedAbuse", "listenerReportedAbuse", "serverRestart", "unknown" ]
      default: "unknown"

    venter: ConversationPartner
    listener: ConversationPartner
    messages: [ Message ]
  )
)()
Conversation = exports.Conversation = mongoose.model("Conversation")
saveConversation = (conversation) ->
  if conversation.messages.length
    conversation.save (err) ->
      if err
        log.error
          event: "Cannot save Conversation"
          error: err.toString()

setTimeout (->
  serverSession = require("../app").sessionId
  Conversation.find
    serverSession:
      $ne: serverSession

    status: "active"
  , (err, conversations) ->
    if err
      log.error
        event: "Cannot retrieve inactive conversations"
        error: err.toString()
    else
      i = 0
      len = conversations.length

      while i < len
        conversation = conversations[i]
        conversation.status = "complete"
        conversation.finishTime = Date.now()
        conversation.finishReason = "serverRestart"
        saveConversation conversation
        i += 1
), 5000
rooms = createHash()
VALID_TYPES = createHash(
  venter: true
  listener: true
, true)
listenerQueue = []
venterQueue = []
queueRequestedPartners = createHash()
userIdToRoomId = createHash()
userInteractions = createHash()
DEVELOPMENT = (process.env.NODE_ENV or "development") is "development"
Room = exports.Room = (id, venterId, listenerId) ->
  return new Room(id, venterId, listenerId)  unless this instanceof Room
  id = String(id)
  @id = id
  @startTime = @lastAccessTime = Date.now()
  @users = createHash()
  @types = createHash(
    venter: 0
    listener: 0
  )
  @numMessages = 0
  rooms[id] = this
  log.info
    event: "New room"
    room: id

  @addUser venterId, "venter"
  @addUser listenerId, "listener"
  log.store "joinRoom", venterId
  log.store "joinRoom", listenerId
  venter = User.getById(venterId)
  venter.partner_list.push listenerId
  listener = User.getById(listenerId)
  listener.partner_list.push venterId
  venterIP = (if venter then venter.getIPAddress() or "" else "")
  listenerIP = (if listener then listener.getIPAddress() or "" else "")
  conversation = @conversation = new Conversation(
    serverSession: require("../app").sessionId
    status: "active"
    venter:
      userId: venterId
      hashedIPAddress: hashIPAddress(venterIP)
      geoLocation: {}
      userAgent: (if venter then venter.userAgent or "" else "")

    listener:
      userId: listenerId
      hashedIPAddress: hashIPAddress(listenerIP)
      geoLocation: {}
      userAgent: (if listener then listener.userAgent or "" else "")

    messages: []
  )
  saveConversation conversation
  if venterIP and venterIP isnt "127.0.0.1"
    require("../app").geoipCity.lookup venterIP, (err, data) ->
      if err
        log.error
          event: "GeoIP"
          error: String(err.message)
          stack: String(err.stack)
          ipAddress: venterIP

        return
      conversation.venter.geoLocation = data
      saveConversation conversation
  if listenerIP and listenerIP isnt "127.0.0.1"
    require("../app").geoipCity.lookup listenerIP, (err, data) ->
      if err
        log.error
          event: "GeoIP"
          error: String(err.message)
          stack: String(err.stack)
          ipAddress: listenerIP

        return
      conversation.listener.geoLocation = data
      saveConversation conversation

Room.forEach = (callback) ->
  for key of rooms
    return  if callback(rooms[key], key) is false

Room.calculateCounts = ->
  numListeners = listenerQueue.length
  numVenters = venterQueue.length
  venterId = undefined
  listenerId = undefined
  listeners_here = undefined
  venters_here = undefined
  Room.forEach (room, id) ->
    venters_here = room.getNumUsersOfType("venter")
    listeners_here = room.getNumUsersOfType("listener")
    numListeners += listeners_here
    numVenters += venters_here
    if listeners_here >= 1 and venters_here >= 1 and (Date.now() - room.startTime) > 1000 * 60 * 10
      underscore.each room.users, (value, key, list) ->
        if value is "venter"
          venterId = key
        else listenerId = key  if value is "listener"

      feedbackServer.addFeedback
        venter: venterId
        listener: listenerId
        direction: "positive"

  [ numListeners, numVenters ]

Room.get = (id) ->
  rooms[id] or null

Room.addUserToQueue = (userId, type, requestedPartnerId, priority) ->
  unless userId
    throw new Error("Improper userId")
  else throw new Error("Unknown type: " + type)  unless VALID_TYPES[type]
  return  if userIdToRoomId[userId]
  return  if venterQueue.indexOf(userId) isnt -1 or listenerQueue.indexOf(userId) isnt -1
  user = User.getById(userId)
  user.setIPAddress (if type is "venter" then "123.123.123.123" else "1.2.3.4")  if DEVELOPMENT and (user.getIPAddress() is "" or user.getIPAddress() is "127.0.0.1")
  queue = (if type is "venter" then venterQueue else listenerQueue)
  if priority
    console.log "prioritizing user " + userId
    queue.unshift userId
  else
    queue.push userId
  if requestedPartnerId
    queueRequestedPartners[userId] =
      timeout: Date.now() + REQUESTED_PARTNER_TIMEOUT
      partnerId: requestedPartnerId
  Room.checkQueues()

Room.removeUserFromQueue = (userId) ->
  index = venterQueue.indexOf(userId)
  venterQueue.splice index, 1  if index isnt -1
  index = listenerQueue.indexOf(userId)
  listenerQueue.splice index, 1  if index isnt -1
  delete queueRequestedPartners[userId]

Room.checkQueues = ->
  return  if venterQueue.length is 0 or listenerQueue.length is 0
  now = Date.now()
  i = 0
  lenI = venterQueue.length

  while i < lenI
    venterId = venterQueue[i]
    venter = User.getById(venterId)
    if venter and venter.isClientConnected()
      venterRequestedPartner = queueRequestedPartners[venterId]
      if venterRequestedPartner
        if venterRequestedPartner.timeout < now
          delete queueRequestedPartners[venterId]

          venterRequestedPartner = `undefined`
      j = 0
      lenJ = listenerQueue.length

      while j < lenJ
        listenerId = listenerQueue[j]
        listener = User.getById(listenerId)
        if listener and listener.isClientConnected()
          listenerRequestedPartner = queueRequestedPartners[listenerId]
          if listenerRequestedPartner
            if listenerRequestedPartner.timeout < now
              delete queueRequestedPartners[listenerId]

              listenerRequestedPartner = `undefined`
          if not userInteractions[venterId] or userInteractions[venterId].indexOf(listenerId) is -1
            if venterRequestedPartner and User.getByPublicId(venterRequestedPartner.partnerId) isnt listener
              continue
            else continue  if listenerRequestedPartner and User.getByPublicId(listenerRequestedPartner.partnerId) isnt venter
            new Room(guid(), venterId, listenerId)
            setTimeout Room.checkQueues, 500
            return
        j += 1
    i += 1

Room.getByUserId = (userId) ->
  roomId = userIdToRoomId[userId]
  return null  unless roomId
  Room.get roomId

Room.dumpData = ->
  result = []
  for roomId of rooms
    room = rooms[roomId]
    result.push
      id: roomId
      clients: room.users
      time: room.lastAccessTime
      startTime: room.startTime
      numMessages: room.numMessages
  rooms: result
  listenerQueue: listenerQueue
  venterQueue: venterQueue

Room.getQueuePosition = (userId) ->
  index = venterQueue.indexOf(userId)
  queue = undefined
  otherQueue = undefined
  user_type = undefined
  if index isnt -1
    user_type = "venter"
    queue = venterQueue
    otherQueue = listenerQueue
  else
    index = listenerQueue.indexOf(userId)
    return -1  if index is -1
    user_type = "listener"
    queue = listenerQueue
    otherQueue = venterQueue
  i = 0

  while i < index
    competitorId = queue[i]
    if queueRequestedPartners[competitorId]
      index -= 1
    else
      j = 0
      len = otherQueue.length

      while j < len
        otherId = otherQueue[j]
        if userInteractions[otherId] and userInteractions[otherId].indexOf(competitorId) isnt -1 and userInteractions[otherId].indexOf(userId) is -1
          index -= 1
          break
        j += 1
    i += 1
  index = 0  if index < 0
  queue_position: index
  user_type: user_type

Room::deleteRoom = (type, reason) ->
  log.info
    event: "Delete room"
    room: @id

  delete rooms[@id]

  users = @users
  for userId of users
    clientType = users[userId]
    delete userIdToRoomId[userId]  if userIdToRoomId[userId] is @id
    log.store "leaveRoom", userId
    Room.addUserToQueue userId, clientType
  conversation = @conversation
  conversation.status = "complete"
  conversation.finishTime = Date.now()
  if type is "venter" or type is "listener"
    if reason is "disconnect"
      conversation.finishReason = type + "Disconnect"
    else if reason is "request"
      conversation.finishReason = type + "Request"
    else if reason is "abuse"
      conversation.finishReason = type + "ReportedAbuse"
    else
      conversation.finishReason = "unknown"
  else
    conversation.finishReason = "unknown"
  saveConversation conversation

Room::poke = ->
  @lastAccessTime = Date.now()

Room::hasType = (type) ->
  !!@types[type]

Room::isFull = ->
  for type of VALID_TYPES
    return false  unless @hasType(type)
  true

Room::getNumUsersOfType = (type) ->
  @types[type] or 0

Room::hasAnyUsers = ->
  Object.keys(@users).length > 0

Room::getNumUsers = ->
  count = 0
  count = Object.keys(@users).length
  count

Room::isExpired = ->
  @lastAccessTime < Date.now() - EXPIRY_TIME

Room::sendToUser = (userId, type) ->
  user = User.getById(userId)
  return  unless user
  message = t: type
  if arguments.length > 2
    if arguments.length is 3
      message.d = arguments[2]
    else
      message.d = Array::slice.call(arguments, 2)

  user.send message

Room::receiveMessage = (userId, message, callback) ->
  @poke()
  clientType = @users[userId]
  if not clientType or not VALID_TYPES[clientType]
    callback false
    return
  log.info
    event: "Chat"
    user: userId
    room: @id
    type: clientType

  @numMessages += 1
  for otherUserId of @users
    @sendToUser otherUserId, "msg", clientType, message  if otherUserId isnt userId
  @conversation.messages.push
    partner: clientType
    text: message

  saveConversation @conversation
  callback true

Room::sendTypeStatus = (userId, message, callback) ->
  @poke()
  clientType = @users[userId]
  if not clientType or not VALID_TYPES[clientType]
    callback false
    return
  log.info
    event: "Typing"
    user: userId
    room: @id
    type: clientType

  for otherUserId of @users
    @sendToUser otherUserId, "typing", clientType, message  if otherUserId isnt userId
  callback true

Room::lookupUserGeoIP = (userId, callback) ->
  user = User.getById(userId)
  unless user
    callback null
  else
    user.lookupGeoIP callback

Room::areUsersFromSameCountry = (userId, otherUserId, callback) ->
  self = this
  self.lookupUserGeoIP userId, (geoInfo) ->
    if geoInfo and geoInfo.data and geoInfo.data.country_name
      self.lookupUserGeoIP otherUserId, (geoInfo2) ->
        if geoInfo2 and geoInfo2.data and geoInfo2.data.country_name and geoInfo2.data.country_name is geoInfo.data.country_name
          console.log "They are from Same country.!!"
          callback geoInfo
          return
    console.log "They are NOT from same country."
    callback null
    return

Room::addUser = (userId, type) ->
  throw new Error("Unknown type: " + type)  unless VALID_TYPES[type]
  oldRoomId = userIdToRoomId[userId]
  if oldRoomId
    return  if oldRoomId is @id
    delete userIdToRoomId[userId]

    oldRoom = Room.get(oldRoomId)
    oldRoom.removeUser userId  if oldRoom
  log.info
    event: "Add user"
    user: userId
    room: @id
    type: type

  userIdToRoomId[userId] = @id
  @users[userId] = type
  @types[type] += 1
  throw new Error("Expected this.types[" + JSON.stringify(type) + "] == 1, got " + @types[type])  if @types[type] isnt 1
  self = this
  Object.keys(@users).forEach (otherUserId) ->
    if otherUserId isnt userId
      self.areUsersFromSameCountry userId, otherUserId, (geoInfo) ->
        user = User.getById(userId)
        self.sendToUser otherUserId, "join", user and user.publicId, type, geoInfo
        otherClientType = self.users[otherUserId]
        if VALID_TYPES[otherClientType]
          otherUser = User.getById(otherUserId)
          if otherClientType is "venter"
            self.sendToUser userId, "join", otherUser and otherUser.publicId, otherClientType, null
          else
            self.lookupUserGeoIP otherUserId, (geoInfo) ->
              self.sendToUser userId, "join", otherUser and otherUser.publicId, otherClientType, geoInfo
          console.log "other client type", otherClientType
        (userInteractions[userId] or (userInteractions[userId] = [])).push otherUserId
        (userInteractions[otherUserId] or (userInteractions[otherUserId] = [])).push userId

  Room.removeUserFromQueue userId

Room::removeUser = (userId, reason) ->
  self = this
  clientType = @users[userId]
  if clientType
    log.info
      event: "Remove user"
      user: userId
      room: @id
      type: clientType or "unknown"

    if clientType of @types
      @types[clientType] -= 1
      throw new Error("Expected this.types[" + JSON.stringify(clientType) + "] == 0, got " + @types[clientType])  if @types[clientType] isnt 0
  users = @users
  delete users[userId]

  delete userIdToRoomId[userId]

  if @hasAnyUsers()
    console.log "trashing room %s due to user disconnect", @id
    userIds = Object.keys(users)
    async.forEach userIds, ((user, callback) ->
      if reason is "disconnect"
        console.log "dropping user %s from room", user
        delete users[user]

        delete userIdToRoomId[user]

        console.log "sending partDisconnect message to %s", user
        self.sendToUser user, "partDisconnect", clientType or "unknown"
      else
        console.log "sending partRequest message to %s", user
        self.sendToUser user, "partRequest", clientType or "unknown"
      callback()
    ), (err) ->
      remaining = Object.keys(users)
      console.log "%s room deconstruction complete, users remaining: %s", reason, remaining.join(", ")
      self.deleteRoom clientType or "unknown", reason
  else
    @deleteRoom clientType or "unknown", reason
