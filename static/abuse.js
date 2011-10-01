(function ($, undefined) {
    // var abusers is created

    $(function () {
        if ($("#chatWindow").length > 0) {
            return;
        }

        var comm = Comm.create();
        comm.register();

        var reloadConversations = function (abuserHashedIPAddress) {
            var container = getAbuseConversationsContainer(abuserHashedIPAddress);
            container.html('Loading .. ');
            comm.request("get_abuser_conversations", abuserHashedIPAddress, function (data) {
                container.html('');
                if (data.conversations.length) {
                    renderAbuseConversations(abuserHashedIPAddress, data);
                } else {
                    getAbuseRow(abuserHashedIPAddress).hide();
                }
                renderAbuseConversationsCount(abuserHashedIPAddress, data);
            });
        };

        $('tr[id]', '#abuselist').live("click", function () {
            var abuserHashedIPAddress = $(this).attr('id');
            // in abuse.jade
            var container = getAbuseConversationsContainer(abuserHashedIPAddress);
            if (container.is(":visible")) {
                container.hide();
            } else {
                container.show();
                reloadConversations(abuserHashedIPAddress);
            }
        });

        $('input.ignoreincident', '#abuselist').live("click", function () {
            var abuserHashedIPAddress = $(this).attr('abuserHashedIPAddress');
            var data = {
                abuserHashedIPAddress:  abuserHashedIPAddress,
                conversationId: $(this).attr('id')
            }
            comm.request("ignore_abuser_conversation", data, function () {
                reloadConversations(abuserHashedIPAddress);
            });
            return false;
        });

        $('input.banuser', '#abuselist').live("click", function () {
            var abuserHashedIPAddress = $(this).attr('abuserHashedIPAddress');
            comm.request("ban_abuser", abuserHashedIPAddress, function () {
                reloadConversations(abuserHashedIPAddress);
            });
            return false;
        });

    });
}(jQuery));
