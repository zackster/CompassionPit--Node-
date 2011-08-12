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

        var log = function (data) {
            try {
                var console = window.console;
                if (console && console.log) {
                    console.log(data);
                }
            } catch (err) {
                // do nothing
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
            addMessage('System', 'You have been disconnected. Trying to reconnect...', 'yellow-row');
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
        
        var refocusInformInput = function () {
            setTimeout(function () {
                if ($("#inform").length > 0 && !$("#inform").is(":focus")) {
                    $("#inform").focus();
                }
            }, 0);
        };
        
        function status(msg, cssClass, checkQueue) {
            checkingQueue = checkQueue && msg;

            var msgform = (msg === false);

            var $status = $('#status');
            $status.removeClass('errorMessage infoMessage');
            $status.addClass(cssClass);
            if(msgform) {
                $status.text("connected");
            } else {
                $status.text(msg);
            }
            queryQueuePosition();
        }

        $('#chat_input').submit(function () {
            sendMessage($("#inform").val());
            refocusInformInput();
            return false;
        });

        function requestNewChatPartner( priority ) {
            if (hasPartner) {
                setHasPartner(false);
                addMessage('System', 'Please wait while we find you a new chat partner.');
                requestNewChatChannel(true, priority);
            }
        }

        function requestNewChatPartnerPriority() {
            requestNewChatPartner( true );
        }

        var hasFocus = true;
        $(window).bind("blur", function() {
            hasFocus = false;
        });
        $(window).bind("focus", function() {
            hasFocus = true;
            document.title = 'CompassionPit | Chat';
            refocusInformInput();
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

        $('#newPartner').live( 'click', function() {
            if ($(this).hasClass("disabled")) {
                return false;
            }
            requestNewChatPartner();
            refocusInformInput();
            return false;
        });

        function requestNewChatChannel(forceNewPartner, priority) {
            setHasPartner(false);
            
            comm.request("join", {
                type: CLIENT_TYPE,
                partnerId: (!forceNewPartner && lastPartnerId) || undefined,
        priority: priority,
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
        
        var scrollToBottomOfChat = function () {
            var scrollDiv = document.getElementById("column_left_chat"); //scroll to bottom of chat
            scrollDiv.scrollTop = scrollDiv.scrollHeight;
        }

        var count = 0;
        var i = 0;
        var titleCurrentlyChanging = false;
        function addMessage(from, msg, cssClass) {
            var $td = $("<td>");
            if (msg instanceof $) {
                $td.append(msg);
            } else {
                $td.text(capitalize(from) + ": " + msg);
            }
            var row = $('#chatWindow > tbody:last')
                .append($("<tr>")
                    .addClass(cssClass || (from === 'Me' ? 'blue-row' : from === 'System' ? 'off-white-row' : 'white-row'))
                    .append($td));
            scrollToBottomOfChat();
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


        $('#enable_typing').change(function(){
            if ($(this).is(':checked')){
               addMessage('System', 'Others can now see when you\'re typing');
               comm.request("typing", {state: 'on'});
            } else {
                addMessage('System', 'Others can no longer see when you\'re typing');
                comm.request("typing", {state: 'off'});
            }
        });
        
        var isTyping = false;
        $('#chat_input').bind('change keydown keyup',function (){
            if ($('#enable_typing').is(':checked')){
                if (!isTyping){
                    comm.request("typing", {state: 'start'});
                    isTyping = true;
                }

                window.clearTimeout(this.timeoutID);
                delete this.timeoutID;

                this.timeoutID = window.setTimeout(
                    function(){
                        comm.request("typing", {state: 'stop'});
                        isTyping = false;
                    },2000
                );
            }
        });


        function sendMessage(msg) {
            if (msg == '' || !hasPartner) {
                return;
            }

            addMessage('Me', msg);
            info(false);
            $('#inform').val('');

            comm.request("msg", msg, function (data) {
                if (data !== true) {
                    addMessage('System', 'Failed to send message.', 'yellow-row')
                }
            });
            comm.request("typing", {state: 'stop'});
        }

        comm.handler("sysmsg", function (message) {
            addMessage("System", message, 'yellow-row');
        });
        comm.handler("msg", function (type, message) {
            if (type != CLIENT_TYPE) {
                addMessage(type, message);
            }
        });
        comm.handler("typing", function (type, message) {
            if (type != CLIENT_TYPE) {
                switch (message.state){
                    case "on":
                        addMessage('System', 'You will now be able to see when '+type+' is typing');
                        break;

                    case "off":
                        addMessage('System', 'You will no longer be able to see when '+type+' is typing');
                        break;

                    case "start":
                        $("#typing_status").text(type + ' is typing')
                        break;

                    case "stop":
                        $("#typing_status").text('')
                        break;
                }
            }
        });
        comm.handler("join", function (otherUserId, type, geoInfo) {
            if (type !== CLIENT_TYPE) {
                var oldUserId = lastPartnerId;
                setHasPartner(otherUserId);
                log("join " + otherUserId);
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
        
        var includeWufooEmbedScript = function () {
            $('#chatWindow > tbody:last')
                .append($("<tr>")
                    .append($("<td>")
                        .append($("<iframe>", {
                            allowTransparency: "true",
                            frameborder: 0,
                            scrolling: "yes",
                            style: "width:100%;height:270px;border:none",
                            src: "http://awesomenessreminders.wufoo.com/embed/r7x3q1/"
                        }))));
            scrollToBottomOfChat();
        };
        comm.handler("partRequest", function (type) {
            // partner requested a new match, automatically reconnect
            addMessage( 'System', 'Your chat partner disconnected, please wait while we find you a new ' + OTHER_CLIENT_TYPE + '.' );
            setHasPartner( false );

            if ( CLIENT_TYPE === 'venter' ) {
                includeWufooEmbedScript();
            }

            infoWithQueue( 'Waiting for a new partner... ' );
        });
        comm.handler("partDisconnect", function (type) {
            var container = $( '<span></span>' );
        
            var button = $( '<a></a>', {
                'href'  : '#',
                'text'  : 'Click here'
            });

            button.click( function() {
                requestNewChatPartnerPriority();
                refocusInformInput();
        
                return false;
            });

            container
                .append( 'Your partner has left the chat. ' )
                .append( button )
                .append( ' to be connected to a new ' + OTHER_CLIENT_TYPE + '.' );

            addMessage( 'System', container );
            
            if (CLIENT_TYPE === "venter") {
                includeWufooEmbedScript();
            }
            
            info('Partner disconnected.');
        });
        
        comm.start();

        function capitalize(text) {
            return text.charAt(0).toUpperCase() + text.substring(1);
        }
    });
}(jQuery));
