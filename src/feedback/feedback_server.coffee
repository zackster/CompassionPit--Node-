"use strict"
mongoose    = require("mongoose")
_           = require("underscore")
regexp      = require("../lib/utils").regexp
User        = require("../users/models").User
authServer  = require("../authentication/auth_server").authServer()
Schema      = mongoose.Schema

Feedback = mongoose.model "Feedback", new Schema
  listener:
    type: String
    validate: [ (str) ->
      str.length > 0
     ]

  venter:
    type: String
    validate: [ (str) ->
      str.length > 0
     ]

  direction:
    type: String
    validate: [ (str) ->
      str is "positive" or str is "negative"
     ]

  ipAddress:
    type: String

class Server
  listenerScores: {}

  addFeedback : (feedback) ->
    console.log "Adding feedback"
    console.log feedback
    instance = new Feedback()
    instance.venter = feedback.venter
    listener_account = authServer.getUsernameFromListenerId(feedback.listener)
    instance.listener = (if listener_account then listener_account else feedback.listener)
    instance.direction = feedback.direction
    venter_ip = User.getById(feedback.venter).getIPAddress()
    listener_ip = User.getById(feedback.listener).getIPAddress()
    instance.ipAddress = listener_ip
    if venter_ip is listener_ip
      console.log "We aren't adding feedback since both listener and venter share an IP address."
      return
    instance.save (err) ->
      if err and err.errors
        badFields = []
        for badField of err.errors
          badFields.push badField  if err.errors.hasOwnProperty(badField)
        console.log "ERROR!"
        console.log badFields
      else if err
        console.log "ERROR! duplicate"
      else
        console.log "successfully added feedback"

  creditFeedback : (user) ->
    console.log "About to credit feedback"
    console.log "user id:", user.id
    console.log "user username:", user.username
    conditions = listener: user.id
    update = listener: user.username
    options = multi: true
    console.log "Calling the Feedback.update function...."
    Feedback.update conditions, update, options, (err, numAffected) ->
      console.log "Credit feedback - callback invoked! w00t"
      console.log "error: ", err
      console.log "numAffected: ", numAffected

  calculateLeaderboard: ->
    console.log "We are calculating the leaderboard."
    server_object_context = this
    self = @

    Feedback.distinct "listener",
      listener:
        $exists: true
    , (err, listeners) ->
      if err
        console.log "Error! " + err
        return
      for i of listeners
        if listeners.hasOwnProperty(i)
          ((thisListener) ->
            Feedback.count
              listener: thisListener
              direction: "positive"
            , (err, docs) ->
              if err
                console.log "error! " + err
                return

              self.listenerScores[thisListener] = (self.listenerScores[thisListener] || 0) + (5 * docs)

            Feedback.count
              listener: thisListener
              direction: "negative"
            , (err, docs) ->
              if err
                console.log "error! " + err
                return
              self.listenerScores[thisListener] = (self.listenerScores[thisListener] or 0) + (-3 * docs)
          )(listeners[i])

      setTimeout (->
        server_object_context.calculateLeaderboard()
      ), 5000 * 1000

  getLeaderboardForUser : (loggedInUser, cb) ->
    scores = @listenerScores
    user_scores = []
    _.each scores, (score, username, list) ->
      if username.length isnt 24 and not regexp().email.test(username)
        valid_user =
          username: username
          score: score

        user_scores.push valid_user

    user_scores_sorted = _.sortBy(user_scores, (user_to_sort, position, list) ->
      -user_to_sort.score
    )
    user_position = -1
    _.each user_scores_sorted, (user, position, list) ->
      user_position = position + 1  if user.username is loggedInUser

    diff_needed_to_move_up = "N/A :)"
    if user_position isnt -1
      logged_in_user_score = user_scores_sorted[user_position - 1].score
      i = user_position - 2

      while i >= 0
        if user_scores_sorted[i].score > logged_in_user_score
          diff_needed_to_move_up = user_scores_sorted[i].score - logged_in_user_score
          break
        i--
      cb.call null,
        rank: user_position
        score: logged_in_user_score
        diff: diff_needed_to_move_up

      return
    else
      cb.call null,
        rank: "Not On Leaderboard"
        score: "No Score"
        diff: "N/A"

  getLeaderboard : (top15Only, cb) ->
    scores = @listenerScores
    user_scores = []
    _.each scores, (score, username, list) ->
      if username.length isnt 24 and not regexp().email.test(username)
        user =
          username: username
          score: score

        user_scores.push user

    user_scores = _.sortBy(user_scores, (user, position, list) ->
      -user.score
    )
    top15 = top15Only or false
    if top15
      cb.call null, user_scores.slice(0, 15)
    else
      cb.call null, user_scores

  ipAddressHasNeverReceivedNegativeFeedback: (ip_address, callback) ->
    Feedback.count
      ipAddress: ip_address
      direction: "negative"
    , (err, docs) ->
      if err
        console.log "error! " + err
        return
      if docs is 0
        callback true
      else
        callback false

exports.feedbackServer = ->
  server = new Server()
  server.calculateLeaderboard()
  server