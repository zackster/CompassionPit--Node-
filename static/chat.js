(function ($, undefined) {
    $(function () {
        if ($("#chatWindow").length === 0) {
            return;
        }

        var CLIENT_TYPE = window.CLIENT_TYPE;
        var OTHER_CLIENT_TYPE = (CLIENT_TYPE === 'listener') ? 'venter' : 'listener';
        var NEW_PARTNER_BUTTON_TIMEOUT = 10 * 1000;
        
        window.showBrowserCloseMessage = true;
        window.onbeforeunload = function(event) {
            if (window.showBrowserCloseMessage) {
                return hasPartner ? 'Did you really mean to leave? Your partner will be disconnected.' : 'Did you really mean to leave?';
            }
        };

        
        var comm = Comm.create();
        window.comm = comm;
        var hasPartner = false;
        var lastPartnerId = null;
        var currentPartnerId = null;
        var setHasPartner = function (value) {
            hasPartner = !!value;
            if (value) {
                setTimeout(function () {
                    if (hasPartner) {
                        $("#newPartner")
                            .removeClass("disabled");
                    }
                }, NEW_PARTNER_BUTTON_TIMEOUT);
                lastPartnerId = value;
                currentPartnerId = value;
            } else {
                $("#newPartner")
                    .addClass("disabled");
                currentPartnerId = null;
            }
        };
        setHasPartner(false);
        
        comm.on('connect', function (first) {
    	    addMessage('System', first ? 'Connected' : 'Reconnected');
    	    requestNewChatChannel(false);
        });
        comm.on('disconnect', function () {
    		addMessage('System', 'You have been disconnected. Trying to reconnect...');
    		info("Reconnecting...");
    		setHasPartner(false);
        });
        comm.on('reconnectFailed', function () {
            var $a = $("<a>")
                .attr("href", "")
                .text('Unable to reconnect. Click to reconnect.')
                .click(function () {
                    $a.replaceWith($("<span>")
                        .text('Unable to reconnect. Click to reconnect.'));
                    addMessage('System', "Reconnecting...");
                    comm.reconnect();
                    return false;
                });
            addMessage('System', $a);
            info('Connection error');
        });

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
            comm.request("queue", null, function (position) {
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
        	    $status
        	        .empty()        	        
        	        .append($("<form>")
        	            .append($("<input>")
        	                .attr("id", "inform")
        	                .attr("type", "text")
        	                .attr("autocomplete", "off")
        	                .attr("size", "90"))
        	            .append($("<input>")
        	                .attr("type", "submit")
        	                .attr("value", "Send Chat"))
        	            .submit(function () {
        	                sendMessage($("#inform").val());
        	                return false;
        	            }));
        	    $("#inform").focus();
        	} else {
            	$status.text(msg);
        	}

            queryQueuePosition();
        }

        function requestNewChatPartner() {
        	if (hasPartner) {
        		setHasPartner(false);
        		addMessage('System', 'Please wait while we find you a new chat partner.');
        		requestNewChatChannel(true);
        	}
        }

        var hasFocus = true;
        $(window).bind("blur", function() {
        	hasFocus = false;
        });
        $(window).bind("focus", function() {
        	hasFocus = true;
        	$("#inform").focus();
        	document.title = 'CompassionPit | Chat';
        });

		$('#enable_sound').attr('checked', true);
		info('Initializing');

		$('#audioPlayer')
    		.jPlayer({
    			ready: function() {
    				$('#audioPlayer').jPlayer('setMedia', {
    				    mp3: '/shortgong.mp3'
    				});
    			},
    			swfPath: '/',
    			reload: 'auto',
    			supplied: "mp3"
    		});

		$('#newPartner').click(function() {
	        requestNewChatPartner();
	        $("#inform").focus();
	        return false;
	    });

        function requestNewChatChannel(forceNewPartner) {
            setHasPartner(false);
            
            comm.request("join", {
                type: CLIENT_TYPE,
                partnerId: (!forceNewPartner && lastPartnerId) || undefined
            }, function () {
            	if (!hasPartner) {
                    infoWithQueue('Waiting for a chat partner... ');
                }
            });
            info('Waiting for a chat partner... ');
            addMessage("System", "Searching for a chat partner...");
        }

        function gong() {
        	try {
        		$('#audioPlayer')
        		    .jPlayer('playHead', 0)
        		    .jPlayer('play');
        	} catch(err) {
        	}
        }
        window.gong = gong;

        var count = 0;
        var i = 0;
        var titleCurrentlyChanging = false;
        function addMessage(from, msg) {
            var $td = $("<td>");
            if (msg instanceof $) {
                $td.append(msg);
            } else {
                $td.text(capitalize(from) + ": " + msg);
            }
        	var row = $('#chatWindow > tbody:last')
                .append($("<tr>")
            	    .addClass(from === 'Me' ? 'blue-row' : 'white-row')
            	    .append($td));
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

            comm.request("msg", msg, function (data) {
                if (data !== true) {
         		    addMessage('System', 'Failed to send message.')
                }
            });
        }

        comm.handler("sysmsg", function (message) {
            addMessage("System", message);
        });
        comm.handler("msg", function (type, message) {
            if (type != CLIENT_TYPE) {
                addMessage(type, message);
            }
        });
        comm.handler("join", function (otherUserId, type, geoInfo) {
    	    if (type !== CLIENT_TYPE) {
    	        var oldUserId = lastPartnerId;
    			setHasPartner(otherUserId);
    			try {
        			if (console && console.log) {
        			    console.log("join " + otherUserId);
    			    }
			    } catch (err) {}
    			info(false);
    			
    			var message;
    			if (otherUserId === oldUserId) {
    			    // we were properly reconnected!
    			    // don't need to show geoinfo, since it's the same partner as before.
    			    message = 'You were reconnected with your previous ' + OTHER_CLIENT_TYPE;
    			} else {
    			    // new partner
    			    if (geoInfo) {
    			        // we have geolocation info.
    			        message = 'A new ' + OTHER_CLIENT_TYPE + ' has entered your chat from ' + geoInfo;
    			    } else {
    			        message = 'A new ' + OTHER_CLIENT_TYPE + ' has entered your chat';
    			    }
    			}
    			addMessage('System', message);
    		}
		if(geoInfo) {
				// sets for slot 1, scope 2 - session scope
			_gaq.push(['_setCustomVar', 1, 'Show Partner Geo Information?', 'Yes', 2]);
		}

        });
        comm.handler("part", function (type) {
    		addMessage("System", "Your chat partner disconnected, please wait while we find you a new " + OTHER_CLIENT_TYPE + ".");
    		setHasPartner(false);
    		infoWithQueue('Waiting for a chat partner... ');
        });
        
        comm.start();

        function capitalize(text) {
            return text.charAt(0).toUpperCase() + text.substring(1);
        }
    });
}(jQuery));
