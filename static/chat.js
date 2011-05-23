(function ($, undefined) {
    var log = function (data) {
        try {
            if (console && console.log) {
                console.log(data);
            }
        } catch (err) {
            // do nothing
        }
    };
    
    var CLIENT_TYPE = window.CLIENT_TYPE;
    var OTHER_CLIENT_TYPE = (CLIENT_TYPE == 'listener') ? 'venter' : 'listener';
    
    var isArray = Array.isArray || function (item) {
        return Object.prototype.toString.call(item) === "[object Array]";
    };

    var socket = new io.Socket();
    var firstConnect = true;
    var hasPartner = false;
    socket.on('connect', function () {
        log("connect");
        if (firstConnect) {
            firstConnect = false;
        	addMessage('System', 'Connected');
        } else {
    		addMessage('System', 'Reconnected');
        }
        requestNewChatChannel();
    });
    socket.on('disconnect', function () {
        log("disconnect");
		addMessage('System', 'You have been disconnected. Trying to reconnect...');
		info("Reconnecting...");
		hasPartner = false;
    });
    var requests = {};
    var socketHandlers = {};
    var arrayify = function (item) {
        if (item == null) { // undefined or null
            return [];
        } else if (isArray(item)) {
            return item;
        } else {
            return [item];
        }
    }
    socket.on('message', function (data) {
        if (data.i) {
            var request = Object.prototype.hasOwnProperty.call(requests, data.i) && requests[data.i];
            if (request) {
                delete requests[data.i];
                request.apply(undefined, arrayify(data.d));
            }
        } else if (data.t) {
            var handler = Object.prototype.hasOwnProperty.call(socketHandlers, data.t) && socketHandlers[data.t];
            if (handler) {
                handler.apply(undefined, arrayify(data.d));
            } else {
                log("Unhandled message: " + data.t);
            }
        } else {
            log("Unknown message");
        }
    });
    socket.connect();
    
    var makeId = (function () {
        var i = 0;
        return function () {
            i += 1;
            return i;
        };
    }());
    var socketRequest = function (type, data, callback) {
        var id = makeId();
        var chunk = {t: type, i: id};
        if (data != null) { // null or undefined
            chunk.d = data;
        }
        requests[id] = callback;
        socket.send(chunk);
    };

    function info(msg) {
    	status(msg, 'infoMessage');
    }
    
    function infoWithQueue(msg) {
    	status(msg, 'infoMessage', true);
    }

    function error(msg) {
    	status(msg, 'errorMessage');
    }
    
    var checkingQueue = false;
    var queryQueuePosition = function () {
        if (!checkingQueue) {
            return;
        }
        socketRequest("queue", null, function (position) {
            if (checkingQueue) {
                if (position < 0) {
                    $('#status').text(checkingQueue);
                    return;
                } else {
                    $('#status').text(checkingQueue + " Queue #" + (position + 1));
                    setTimeout(queryQueuePosition, 5000);
                }
            }
        });
    };
    function status(msg, cssClass, checkQueue) {
        checkingQueue = checkQueue && msg;
        
        var msgform = (msg === false);

    	var $status = $('#status');
    	$status.removeClass('errorMessage infoMessage');
    	$status.addClass(cssClass);
    	if(msgform) {
    	    var $chatInput;
    	    $status
    	        .empty()
    	        .append($("<form>")
    	            .append($chatInput = $("<input>")
    	                .attr("type", "text")
    	                .attr("autocomplete", "off")
    	                .attr("size", "90"))
    	            .append($("<input>")
    	                .attr("type", "submit")
    	                .attr("value", "Send Chat"))
    	            .submit(function () {
    	                sendMessage($chatInput.val());
    	                return false;
    	            }));
    	    $chatInput.focus();
    	} else {
        	$status.text(msg);
    	}
        
        queryQueuePosition();
    }

    function requestNewChatPartner() {
    	if (hasPartner) {
    		hasPartner = false;
    		addMessage('System', 'Please wait while we find you a new chat partner.');
    		requestNewChatChannel();
    	}
    }

    var hasFocus = true;
    $(window).bind("blur", function() {
    	hasFocus = false;
    });
    $(window).bind("focus", function() {
    	hasFocus = true;
    	document.title = 'CompassionPit | Chat';
    });

    $(document).ready(function() {
		$('#enable_sound').attr('checked', true);
		info('Initializing');

		try {
			function audioReady() {
				this.element.jPlayer('setFile', '/shortgong.mp3');
			}
			$('#audioPlayer').jPlayer({
				ready: audioReady,
				swfPath: '/',
				reload: 'auto'
			});
		} catch(e) {
		}
		
		$('#newPartner').click(function() {
	        requestNewChatPartner();
	        return false;
	    });
	    
        window.onbeforeunload = function(event) {
            return hasPartner ? 'Did you really mean to leave? Your partner will be disconnected.' : 'Did you really mean to leave?';
        };
    });

    function requestNewChatChannel() {
        hasPartner = false;
        
        socketRequest("join", CLIENT_TYPE, function () {
        	if (!hasPartner) {
                infoWithQueue('Waiting for a chat partner... ');
            }
        });
        info('Waiting for a chat partner... ');
        addMessage("System", "Searching for a chat partner...");
    }

    function gong() {
    	try {
    		$('#audioPlayer').jPlayer('playHead', 0);
    		$('#audioPlayer').jPlayer('play');
    	} catch(err) {
    	}
    }

    var count = 0;
    var i = 0;
    var titleCurrentlyChanging = false;
    function addMessage(from, msg) {
    	var row = $('#chatWindow > tbody:last')
            .append($("<tr>")
        	    .addClass(from === 'Me' ? 'blue-row' : 'white-row')
        	    .append($("<td>")
        	        .text(capitalize(from) + ": " + msg)));
    	var scrollDiv = document.getElementById("column_left_chat"); //scroll to bottom of chat
    	scrollDiv.scrollTop = scrollDiv.scrollHeight;
    	if(!hasFocus && !titleCurrentlyChanging) {
    		changeTitle();
    		if($("#enable_sound").is(':checked')) {
    			gong();
    		}
    	}
    }

    function changeTitle() {
    	i++;
    	if(i%2) {
    		document.title = 'New message on CompassionPit!';
    	}
    	else {
    		document.title = 'CompassionPit | Chat';
    	}
    	if(!hasFocus) {
    		titleCurrentlyChanging = true;
    		setTimeout(changeTitle,1000);
    	}
    	else {
    		titleCurrentlyChanging = false;
    		i=0;
    		document.title = 'CompassionPit | Chat';
    	}
    }
    
    function sendMessage(msg) {
        if (msg == '' || !hasPartner) {
    	    return;
	    }
	    
        addMessage('Me', msg);
		info(false);
	    $('#chatInput').val('');
        
        socketRequest("msg", msg, function (data) {
            if (data !== true) {
     		    addMessage('System', 'Failed to send message.')
            }
        });
    }
    
    socketHandlers.sysmsg = function (message) {
        addMessage("System", message);
    };
    socketHandlers.msg = function (type, message) {
        if (type != CLIENT_TYPE) {
            addMessage(type, message);
        }
    };
    socketHandlers.join = function (type) {
	    if (type !== CLIENT_TYPE) {
			hasPartner = true;
			info(false);
			addMessage('System', 'A new chat partner has entered your chat');
		}
    };
    socketHandlers.part = function (type) {
        var other = (CLIENT_TYPE == 'listener') ? 'Venter' : 'Listener';
		addMessage("System", "Your chat partner disconnected, please wait while we find you a new " + other + ".");
		hasPartner = false;
		infoWithQueue('Waiting for a chat partner... ');
    };

    function capitalize(text) {
        return text.charAt(0).toUpperCase() + text.substring(1);
    }
}(jQuery));
