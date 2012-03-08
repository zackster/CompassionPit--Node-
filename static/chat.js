(function (exports, $, undefined) {

    $("div#main").hide();
    var progressBarPct = 0;

    exports.progressBar = function (pct) {
        if (pct === 'init') {
            $("#progressbar").progressbar({value: 5});
            return;
        }
        progressBarPct += 15;
        if (pct === 100) {
            progressBarPct = 100;
            $("#initializing").fadeOut(1000, function () {
                $("#main").fadeIn(1000);
            });
        }
        $("#progressbar").progressbar({
            value: progressBarPct
        });
        $("span#secondsTilAppLoad").html(Math.max(+$("span#secondsTilAppLoad").html() - 1, 2));
    };

    exports.create = function () {
      
        var self = this;
        self.progressBar('init');
        $("#initializing").append('<br>'+'Chat create');
        for(var i=1;i<9;i++) {
          setTimeout(function() { self.progressBar(); }, 1500*i);
        }
        
        if ($("#chatWindow").length === 0) {
            return;
        }


        $("button#login, button#register").click(function() {
           $("div.announce").hide();
        });
        $("button#login").click(function() {
          var credentials = {
            username: $("#loginUsername").val(),
            password: $("#loginPassword").val()
          };
          var callback = function(success) {
            log('callback called back with status: %s', success);
            hideSpinner();
            if(success) {
              $("div#reputationLogin").html("Login Successful!").fadeOut(4000, function() {
                  $("div#loggedInAs").show();
              });
            }
            else {
              $("div#form_errors").html("Incorrect username/password combination.");
            }
          };
          showSpinner('login');
          $("span#currentUser").html(credentials.username);
          comm.request("authenticateUser", credentials, callback);
        });
              
        var showSpinner = function(msg) {
          $("div#reputationLogin").hide();
          var $spinner = $("div#spinner");
          $spinner.show();
          if(msg==='registration') {
            $spinner.html("Submitting your registration");
          }
          else if(msg === 'login') {
            $spinner.html("Logging you in");
          }
          $spinner.append($('<br /><br /><img src="img/loadbar.gif" />'));
        };
        
        var hideSpinner = function() {
          $("div#spinner").hide();
          $("div#reputationLogin").show();
                    
        };
        
        
        $("a.registration_mistake").click(function() {
          $("a#meant_to_login").toggle();
          $("a#register_account").toggle();
          $(this).hide();
          $("button#login").toggle();
          $("button#register").toggle();
        });


        var CLIENT_TYPE = window.CLIENT_TYPE;
        var OTHER_CLIENT_TYPE = (CLIENT_TYPE === 'listener') ? 'venter' : 'listener';
        var NEW_PARTNER_BUTTON_TIMEOUT = 10 * 1000;

        if(CLIENT_TYPE == 'listener') {
          $("div#reputationLogin").show();
        }
        else {
          $("div#main").css('height','360px').css('overflow-y','hidden');
        }

        $("div#listenerFeedback button").click(function() {
          if(this.id=='helpful') {
            send_positive_feedback();
          }
          else {
            send_negative_feedback();
          }
          $("div#listenerFeedback").hide();
        });
        
        function send_positive_feedback() {
          comm.request("listenerFeedback", {direction:'positive'});
        }
        
        function send_negative_feedback() {
          comm.request("listenerFeedback", {direction:'negative'});
        }
        
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

        log('creating comm object');
        var comm = Comm.create();
        window.comm = comm;
        log('comm object creation successful');
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
                log('last partner id, ' + lastPartnerId);
                log('current partner id, ' + currentPartnerId);
            } else {
                $("#newPartner")
                    .addClass("disabled");
                $("#abuseButtonContainer")
                    .addClass("hidden");
                $("#typing_status").text('');
                currentPartnerId = null;
            }
        };
        setHasPartner(false);
        
        comm.on('connect', function () {
            // do nothing
        });
        comm.on('register', function (first, userId) {
            self.progressBar(100);
            log('registered with id, ' + userId);
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
                $status.text("Connected");
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
        
        $('#inform').keyup(function(e) {
          if((e.keyCode || e.which) == 13) { //Enter keycode
            $('#chat_input').trigger('submit');
          }
        });

        function requestNewChatPartner( priority, isAbuse ) {
            if (hasPartner) {
                setHasPartner(false);
                if (isAbuse) {
                    addMessage('System', 'This conversation has been reported as abuse. You are being connected to a new chat partner');
                } else {
                    addMessage('System', 'Please wait while we find you a new chat partner.');
                }
                requestNewChatChannel(true, priority, isAbuse);
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
        $('#enable_typing').attr('checked', true);
        info('Initializing');
        $("#main").hide();

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

        $('#reportAbuse').live( 'click', function() {
            if ($(this).hasClass("disabled")) {
                return false;
            }
            requestNewChatPartner(false, true);
            refocusInformInput();
            return false;
        });

        function requestNewChatChannel(forceNewPartner, priority, isAbuse) {
            setHasPartner(false);
            
            comm.request("join", {
                type: CLIENT_TYPE,
                partnerId: (!forceNewPartner && lastPartnerId) || undefined,
                priority: priority,
                isAbuse: isAbuse
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
        };

        var i = 0;
        var titleCurrentlyChanging = false;
        function addMessage(from, msg, cssClass) {
            var $td = $("<td>");
            if (msg instanceof $) {
                $td.append(msg);
            } else {
                $td.text(capitalize(from) + ": " + msg);
            }
            $('#chatWindow > tbody:last')
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
            if (msg === '' || !hasPartner) {
                return;
            }

            addMessage('Me', msg);
            info(false);
            $('#inform').val('');

            comm.request("msg", msg, function (data) {
                if (data !== true) {
                    addMessage('System', 'Failed to send message.', 'yellow-row');
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
                $("#abuseButtonContainer")
                    .removeClass("hidden");
            }
        });
        comm.handler("typing", function (type, message) {
            if (type != CLIENT_TYPE && hasPartner) {
                switch (message.state){
                    case "on":
                        addMessage('System', 'You will now be able to see when '+type+' is typing');
                        break;

                    case "off":
                        addMessage('System', 'You will no longer be able to see when '+type+' is typing');
                        break;

                    case "start":
                        $("#typing_status").text(type + ' is typing');
                        break;

                    case "stop":
                        $("#typing_status").text('');
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
                        addMessage('System', 'A new ' + OTHER_CLIENT_TYPE + ' has entered your chat from ' + geoInfo);
                        message = 'We are sharing the listener\'s location with you so you do not accidentally share vulnerable information with someone you know in real life. Your location has NOT been shared with the listener.';
                    } else {
                        message = 'A new ' + OTHER_CLIENT_TYPE + ' has entered your chat';
                    }
                    if(CLIENT_TYPE == 'venter') {
                      $("div#listenerFeedback").show();
                    }
                }
                addMessage('System', message);
            }


        });
        
        var includeLikeButtonScript = function () {
            $('#chatWindow > tbody:last')
                .append($('<tr class="off-white-row">')
                    .append($("<td>")
                        .append($("<iframe>", {
                            allowTransparency: "true",
                            frameborder: 0,
                            scrolling: "no",
                            style: "width:100%;height:24px;border:none;overflow:hidden;",
                            src: "http://www.facebook.com/plugins/like.php?href=http%3A%2F%2Fwww.compassionpit.com&amp;layout=standard&amp;show_faces=false&amp;width=450&amp;action=like&amp;colorscheme=light&amp;height=24"
                        }))));
                        
            $('#chatWindow > tbody:last')
                .append($('<tr class="off-white-row">')
                    .append($("<td>")
                        .append($('<a href="https://twitter.com/share" data-url="http://www.CompassionPit.com" data-text="CompassionPit: get it off your chest without it biting you in the ass" data-count="horizontal" data-via="CompassionPit" class="twitter-share-button">Tweet</a><script type="text/javascript" src="//platform.twitter.com/widgets.js"></script>'))));
            scrollToBottomOfChat();
        };
        
        comm.handler("partRequest", function (type) {
            // partner requested a new match, automatically reconnect
            addMessage( 'System', 'Your chat partner disconnected, please wait while we find you a new ' + OTHER_CLIENT_TYPE + '.' );
            setHasPartner( false );

            includeLikeButtonScript();

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
            
            includeLikeButtonScript();
            
            info('Partner disconnected.');
        });
        
        function capitalize(text) {
            return text.charAt(0).toUpperCase() + text.substring(1);
        }
        
        return {
            restart: function () {
                comm.register();
            }
        };
    };
    
}(window.Chat = {}, jQuery));