var fu  = require("./fu");
var sys = require("sys");
var nowjs = require("now");

var PORT = 8000;

var Room = function(id) {
	var self = this;
	self.id = id;
	self.last_access_time = new Date().getTime();
	self.start_timer = 0;
	self.venter = 0;
	self.listener = 0;
        self.group = nowjs.getGroup(id);
        self.clients = [];

        self.group.on('connect', function (clientId) {
        	self.clients.push(clientId);
        });

        self.group.on('disconnect', function (clientId) {
	        self.clients.splice(self.clients.indexOf(clientId), 1);
        	if (self.clients.length < 1) {
        	    delete_room(self.id);
	        }
        });
	
	self.poke = function (type) {
		self.last_access_time = new Date().getTime();
		if (type) self[type] = new Date().getTime();
	}
	
	self.expired = function () {
		return self.last_access_time < (new Date().getTime() - (1000 * 30));
	}
	
        self.send = function (type, opposite, message, clientId, callback) {
		self.poke(type);

		if (message.action == "disconnect") {
		    self.removeUser(clientId);
		}else{
        	    self.group.now.receive([message]);
		}

	        callback(true);
        }

	self.start = function () {
	    self.venter = self.listener = new Date().getTime();

	    self.group.now.receive([{action: 'join'}]);
	}

    self.addUser = function (clientId, type) {
	self.group.addUser(clientId);
	self[type] = new Date().getTime();
    }

    self.removeUser = function (clientId) {
	self.group.removeUser(clientId);
	self.group.now.receive([{type: 'listener',
				 action: 'disconnect'}]);
    }
}

var rooms = {};
var client_rooms = {};

function delete_room(roomId) {
    console.log("Removing room", roomId);
    delete rooms[roomId];
}

fu.get("/counts", function (request, response) {
	var listeners = 0;
	var venters = 0;

    var room_ids = [];
	
	for (var id in rooms) {
		var room = rooms[id];
		if (room.listener) listeners += 1;
		if (room.venter) venters += 1;
	    room_ids.push(id);
	}
	
	response.simpleJSON(200, {
		listeners: listeners,
	    venters: venters,
	    rooms: room_ids,
	});
});
fu.get("/dump", function (request, response) {
	response.simpleText(200, sys.inspect(rooms));
})

// is there any particularly good reason for this to exist?
/*setInterval(function () {
	for (i in rooms) {
		var room = rooms[i];
		if (room.expired()) {
		    console.log("Removing room", i);
		    delete rooms[i];
		}
	}
}, 1000 * 10);
*/

fu.get("/", fu.staticHandler("static/index.html"));

fu.listen(PORT, null);

// production
//var options = {host: 'compassionpit.com',
//	       port: 80}

// testing
var options = {host: 'localhost',
	       port: 8080}
var everyone = nowjs.initialize(fu.server, options);

everyone.now.send = function (params, callback) {
    var callback = callback || function () {};

    var type = params.type;
    type = (type == "venter") ? "venter" : "listener";
    opposite = (type == "venter") ? "listener" : "venter";
    var room_id = params.rid;
    var message = {
	action: params.action,
	data: params.data,
	type: type
    };
	
    var room = rooms[room_id];
    if (!room) {
	callback(null);
	return;
    }

    room.send(type, opposite, message, this.user.clientId, callback);
};

everyone.now.join = function (type, callback) {
    type = (type == "venter") ? "venter" : "listener";
    opposite = (type == "venter") ? "listener" : "venter";

    var room = {};

    // disconnect from old room if rejoining
    var oldRoomId = client_rooms[this.user.clientId];
    if (rooms[oldRoomId]) {
	rooms[oldRoomId].removeUser(this.user.clientId);
    }

    // find new room
    for (var id in rooms) {
	room = rooms[id];
	if (!room[type]) {
	    try {
		client_rooms[this.user.clientId] = id;
		room.addUser(this.user.clientId, type)
		room.start();
		
		return callback({ id: id });
	    }catch (e) {
		console.log("Fail joining room", e);
		return callback({});
	    }
	}
    }
	
    var room_id = guid();
    var tmp_room = new Room(room_id);
    client_rooms[this.user.clientId] = room_id;
    rooms[room_id] = tmp_room;
    
    tmp_room.addUser(this.user.clientId, type);
	
    callback({ id: room_id });
};

everyone.disconnected(function () {
    var room = rooms[client_rooms[this.user.clientId]];
    if (room) {
	everyone.now.send.call(this, {rid: room.id,
				      action: 'disconnect',
				      type: 'listener'});
    }

    delete client_rooms[this.user.clientId];
});


function S4() {
   return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
}
function guid() {
   return (S4()+S4()+S4()+S4()+S4()+S4());
}

