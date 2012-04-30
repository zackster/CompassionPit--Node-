"use strict"
hashlib = require("hashlib2")

S4 = ->
  (((1 + Math.random()) * 0x10000) | 0).toString(16).substring 1

guid = ->
  S4() + S4() + S4() + S4() + S4() + S4()

email_regex = new RegExp("[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?")

Regexp = ->
  email: email_regex

exports.regexp = ->
  new Regexp()

module.exports.S4 = S4
module.exports.guid = guid

module.exports.createHash = (data, freeze) ->
  hash = {}
  return hash unless data?

  for key of data
    hash[key] = data[key] if data.hasOwnProperty(key)

  Object.freeze hash  if freeze

  hash

exports.forceLatency = do ->
  LATENCY_TIME = require("./config").forceLatency
  if LATENCY_TIME <= 0
    return (callback) -> callback()
  else
    return (callback) -> setTimeout callback, LATENCY_TIME

exports.latencyWrap = do ->
  LATENCY_TIME = require("./config").forceLatency
  if LATENCY_TIME <= 0
    (callback) ->
      callback
  else
    (callback) ->
      ->
        args = Array::slice.call(arguments, 0)
        setTimeout (->
          callback.apply `undefined`, args
        ), LATENCY_TIME

hashSalt = require("./config").hashIPAddressSalt or ""

exports.hashIPAddress = (address) ->
  return ""  if not address or address is "127.0.0.1"
  hashlib.sha512 "CompassionPit$" + hashSalt + "$" + address

exports.sendEmailToUser = (email_address, template_name, username, score, rank, diff) ->
  # IMPLMENT ME