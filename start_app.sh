#!/bin/bash

echo "$NODE_ENV"
(
NODE_ENV=staging;
echo "Set NODE_ENV to $NODE_ENV";
node leaderboard.js & node app.js;
echo "Started leaderboard.js";
echo "Started app.js";
)
echo "NODE_ENV is now $NODE_ENV"