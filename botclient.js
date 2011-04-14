
var http = require('http'),
    querystring = require('querystring');

var Client = function (type) {
    var self = this;
    self.type = type;
    self.options = { host: 'localhost',
		     port: 8080,
		   };
    self.room_id = -1;

    self.connect = function () {
	var options = self.options;
	options.path = '/join';

	self.get(options, function (data) {
	    data = JSON.parse(data);
	    self.room_id = data.id;
	    console.log(self.type, "Connected to '"+self.room_id+"'");
	});
    };

    self.receive = function () {
	console.log(self.type, "receiving ...");

	var options = self.options;
	options.path = '/receive?'+querystring.stringify({rid: self.room_id,
							  type: self.type});
	self.get(options, function (data) {
	    data = JSON.parse(data);
	    console.log(self.type, "Messages: ", data);

	    self.receive();
	});
    };

    self.send = function () {
	var options = self.options;
	options.path = '/send?'+querystring.stringify({rid: self.room_id,
						       type: self.type,
						       action: 'message',
						       data: "tiem: "+(new Date()).getTime()});
	self.get(options, function (data) {
	    console.log(self.type, "Said something");
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

var venter = new Client('venter');
venter.connect();
var listener = new Client('listener');
listener.connect();

setTimeout(function () {
    venter.receive();
    listener.receive();
    setInterval(function () {
	venter.send();
    }, 1000);
}, 1000);