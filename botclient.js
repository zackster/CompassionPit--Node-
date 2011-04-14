
var http = require('http'),
    querystring = require('querystring');

var Client = function (type) {
    var self = this;
    self.type = type;
    self.options = { host: 'localhost',
		     port: 8080,
		   };
    self.room_id = -1;

    self.connect = function (callback) {
	var callback = callback || function () {};
	var options = self.options;
	options.path = '/join?'+querystring.stringify({type: self.type});

	self.get(options, function (data) {
	    data = JSON.parse(data);
	    self.room_id = data.id;
	    console.log(self.type, "Connected to '"+self.room_id+"'");

	    callback();
	});
    };

    self.receive = function (callback) {
	var callback = callback || function () {};
	console.log(self.type, "receiving ...");

	var options = self.options;
	options.path = '/receive?'+querystring.stringify({rid: self.room_id,
							  type: self.type});
	self.get(options, function (data) {
	    data = JSON.parse(data);
	    console.log(self.type, "Messages: ", data);
	    
	    process.nextTick(function () {
		self.receive(callback);
	    });
	    callback();
	});
    };

    self.send = function (callback) {
	var callback = callback || function () {};
	var options = self.options;
	options.path = '/send?'+querystring.stringify({rid: self.room_id,
						       type: self.type,
						       action: 'message',
						       data: "tiem: "+(new Date()).getTime()});
	self.get(options, function (data) {
	    console.log(self.type, "Said something");
	    callback();
	});
    };

    self.get = function (options, callback) {
	http.get(options, function (res) {
	    var data = '';
	    res.on('data', function (chunk) { data += chunk });
	    res.on('end', function () {
		callback(data);
	    });
	}).on('error', function (e) {
	    console.log(self.type, 'Error: ', e);
	});

    };
};

var chatter = function (venter, listener) {
    var talk = function (client) {
	client.send(function () {
	    setTimeout(function () {chatter(venter, listener)}, 
		       Math.floor(Math.random()*2000));
	});
    }

    if (Math.floor(Math.random()*11) > 5) {
	talk(listener);
    }else{
	talk(venter);
    }
}

var venter = new Client('venter');
venter.connect(function () {
    var listener = new Client('listener');
    listener.connect(function () {
	venter.receive();
	listener.receive();

	chatter(venter, listener);
    });
});