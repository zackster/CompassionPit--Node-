$.extend({
	getUrlVars: function(){
		var vars = [], hash;
		var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
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

function newPartner(cb, sync) {
	if(hasPartner) {
		var oldChatId = chatId;
		chatId = -1;
		hasPartner = false;
		$.getJSON(
			'/send', {
				rid: oldChatId,
				type: $.getUrlVar('type'),
				action: "disconnect"
			},
			cb
		);
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

$(document).ready(
	function() {
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
					newPartner(
							function(data) {
								addMessage('System', 'Please wait while we find you a new chat partner.');
								getPartner()
							}
						);
				}
			);

        window.onbeforeunload = function(event) {
            return hasPartner === true ? 'Did you really mean to leave? Your partner will be disconnected.' : 'Did you really mean to leave?';
        }

		$(window).unload(function () {
			$.ajax({
				url: "/send",
				async: false,
				data: {
					rid: chatId,
					type: $.getUrlVar('type'),
					action: "disconnect"
				}
			});
		})

		other = ($.getUrlVar('type') == 'listener') ? 'Venter' : 'Listener';

		getPartner();
	}
);


function getPartner() {
	hasPartner = false;
	$.getJSON(
			'/join?type=' + $.getUrlVar('type'),
			function(data) {
				initChat(data);
			}
		);
	info('Waiting for a chat partner... ');
}

function initChat(data) {
	if (!data) {
		getPartner();
		return;
	}
	// console.log("initChat", data);
	chatId = data.id;

	getMessages();
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
	var tr_class = from === 'Me' ? 'blue-row' : 'white-row';
	var row = $('#chatWindow > tbody:last').append('<tr class="' + tr_class + '"><td>' + from + ': ' + msg + '</td></tr>');
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
		setTimeout('changeTitle()',1000);
	}
	else {
		titleCurrentlyChanging = false;
		i=0;
		document.title = 'CompassionPit | Chat';
	}
}

function getMessages() {
	if (chatId == -1) return;
	var curChatId = chatId;
	$.getJSON(
			'/receive', {
				rid: chatId,
				type: $.getUrlVar('type')
			},
			function(data) {
				// console.log("getMessages", data);
				// if(data == false) {
				// 	addMessage('System', 'Your chat partner got disconnected. Please wait while we find you a new ' + other + '.');
				// 	return getPartner();
				// }
				// else if(data == true) {
				// 	info('');
				// 	addMessage('System', 'A new chat partner has entered your chat (#' + (chatId >> 1) + ').');
				// 	hasPartner = true;
				// }
				if(data.length)
					handleMessages(data);

				getMessages();
			}
		)
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
				addMessage(other, message.data);
				break;
			case "disconnect":
				addMessage("System", "Your chat partner disconnected, please wait while we find you a new " + other + ".");
				chatId = -1;
				getPartner();
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
	$.getJSON(
			'/send', {
				rid: chatId,
				type: $.getUrlVar('type'),
				action: "message",
				data: msg
			},
			function(data) {
				if(data == true) {
					addMessage('Me', msg);
					info('');
					$('#chatInput').val('')
				} else {
					error('Failed to send message.')
				}
			}
		);
}
