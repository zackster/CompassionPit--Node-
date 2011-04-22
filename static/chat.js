(function ($, undefined) {
    $.extend({
    	getUrlVars: function(){
    		var vars = [], hash;
    		var hashes = window.location.href.split('#')[0].slice(window.location.href.indexOf('?') + 1).split('&');
    		for(var i = 0; i < hashes.length; i++)
    		{
    			hash = hashes[i].split('=');
    			vars.push(hash[0]);
    			vars[hash[0]] = hash[1];
    		}
    		return vars;
    	},
    	getUrlVar: function(name){
    		return $.getUrlVars()[name];
    	}
    });
    
    var CLIENT_TYPE = $.getUrlVar('type') === 'listener' ? 'listener' : 'venter';

    function info(msg) {
    	status(msg, 'infoMessage');
    }

    function error(msg) {
    	status(msg, 'errorMessage');
    }

    function status(msg, cssClass) {


    	if(msg == '') {
    		msg = '<form id="msgForm"><input id="chatInput" type="text" size=90 /><input type="submit" value="Send Chat"  /></form>';
    		msgform = true;
    	}
    	else {
    		msgform = false;
    	}

    	var status = $('#status');
    	status.removeClass('errorMessage infoMessage');
    	status.addClass(cssClass);
    	status.html(msg);
    	if(msgform) {
    		$('#chatInput').focus();
    		$('#msgForm').submit(
    				function() {
    					sendMessage();
    					return false;
    				}
    			);
    	}

    }

    var chatId = -1;
    var other;
    var hasPartner = false;

    function newPartner() {
    	if(hasPartner) {
    		hasPartner = false;
    		addMessage('System', 'Please wait while we find you a new chat partner.');
    		getPartner();
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
        now.ready(function () {
    		$('#enable_sound').attr('checked', true);
    		info('Initializing');

    		try {
    			function audioReady() {
    				this.element.jPlayer('setFile', '/gong.mp3');
    			}
    			$('#audioPlayer').jPlayer({
    				ready: audioReady,
    				swfPath: '/',
    				reload: 'auto'
    			});
    		} catch(e) {
    		}

    		$('#msgForm').submit(
    				function() {
    					sendMessage();
    					return false;
    				}
    			);

    		$('#newPartner').click(
    				function() {
    					newPartner();
    				}
    			);

            window.onbeforeunload = function(event) {
                return hasPartner ? 'Did you really mean to leave? Your partner will be disconnected.' : 'Did you really mean to leave?';
            }

    		other = (CLIENT_TYPE == 'listener') ? 'Venter' : 'Listener';

    		getPartner();
        })});


    function getPartner() {
        hasPartner = false;

        now.join(CLIENT_TYPE, function(data) {
    	console.log('joined?');
    	initChat(data);
        });
        info('Waiting for a chat partner... ');
    }

    function initChat(data) {
    	if (!data) {
    		getPartner();
    		return;
    	}
    	chatId = data.id;
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

    function handleMessages(messages) {
    	messages.forEach(function (message) {
    		switch (message.action) {
    			case "join":
    				info('');
    				addMessage('System', 'A new chat partner has entered your chat');
    				hasPartner = true;
    				break;
    			case "message":
    		                if (message.type != CLIENT_TYPE) {
            			        addMessage(message.type, message.data);
    	                        }
    		    		break;
    			case "disconnect":
    				addMessage("System", "Your chat partner disconnected, please wait while we find you a new " + other + ".");
    				hasPartner = false;
    				info('Waiting for a chat partner... ');
    				break;
    			default:
    				console.log("Unhandled message", message);
    		}
    	})
    }

    function sendMessage() {
        var msg = $('#chatInput').val();
        if(msg == '' || chatId == -1)
    	    return;
        info('Sending message...')
    
        now.sendMessage({rid: chatId,
    	      data: msg
    	     }, 
    	     function (data) {
    		 if(data == true) {
    		     addMessage('Me', msg);
    		     info('');
    		     $('#chatInput').val('')
    		 } else {
    		     error('Failed to send message.')
    		 }
    	     });
    }

    // this function gets called by the server
    now.receive = function (data, callback) {
        var callback = callback || function () {};
        handleMessages(data);
        callback();
    }

    function capitalize(text) {
        return text.charAt(0).toUpperCase() + text.substring(1);
    }
    
    setInterval(function () {
        now.ping();
    }, 30000);
}(jQuery));