config =
  development:
    port: 8000
    documentDomain: "localhost:8000"
    mongodb:
      uri: "mongodb://localhost:27017/log-d"
      logCollection: "logs"

    logLimits:
      info: 1000
      warn: 1000
      error: 1000

    forceLatency: 0
    systemPassword: "password"
    serveMerged: false
    disconnectLeeway: 10000
    messageBacklogPerUser: 100
    geoLocationParts: [ "region", "country_name" ]
    hashIPAddressSalt: "somethingunique"
    listenerAuthentication:
      username: "listener"
      password: "listener"
    vBulletin:
      database: "vbulletin"
      username: "vbulletin"
      password: "password"

  staging:
    port: 8001
    documentDomain: "staging.compassionpit.com"
    mongodb:
      uri: "mongodb://localhost:27017/log-d"
      logCollection: "logs"

    logLimits:
      info: 1000
      warn: 1000
      error: 1000

    forceLatency: 0
    systemPassword: "password"
    serveMerged: false
    disconnectLeeway: 10000
    messageBacklogPerUser: 100
    geoLocationParts: [ "region", "country_name" ]
    hashIPAddressSalt: "somethingunique"
    listenerAuthentication:
      username: "listener"
      password: "listener"

    vBulletin:
      database: "vbulletin"
      username: "vbulletin"
      password: "password"

  production:
    port: 8000
    documentDomain: "www.compassionpit.com"
    mongodb:
      uri: "mongodb://localhost:27017/log-p"
      logCollection: "logs"

    logLimits:
      info: 1000
      warn: 1000
      error: 1000

    forceLatency: 0
    systemPassword: "password"
    serveMerged: true
    disconnectLeeway: 10000
    messageBacklogPerUser: 100
    geoLocationParts: [ "region", "country_name" ]
    hashIPAddressSalt: "somethingunique"
    listenerAuthentication:
      username: "listener"
      password: "listener"

    vBulletin:
      database: "vbulletin"
      username: "vbulletin"
      password: "password"

module.exports = config[process.env.NODE_ENV or "development"]
require("./static-config")(module.exports)