CompassionPit is a chat application that pairs two people anonymously. There is always two people to a conversation, each with distinct roles. One is a "venter", this person is the one who is seeking help/compassion/someone to talk to. The other is a "listener", whose role is to listen, provide support, and just be someone to be talked to.

From a technical standpoint, the application works as such:

A person goes to the site, and they click on a link to either become a venter or a listener. For this example, let's assume that the person decided to be a venter.

They visit the "/vent" page, which will then form a connection with Socket.IO to the server, sending preliminary information in its first message, of type "register". The server will then assign the client a private and public user IDs.

Since internet connections can be shoddy, we want to support arbitrary disconnect/reconnect support with the server, as long as the client isn't disconnected for more than 10 seconds at a time, then they should be able to hold their user account. Assuming the client disconnects, if they reconnect, the server can't know that they are the same user as before, but they can send their "register" message and provide their private and public user IDs to the server to retain their user. As long as they do this within the disconnect leeway period (10 seconds), it'll act to the system and the client as if they had never disconnected. When reconnecting, the "register" message sent will include the index of the last message received, and the message sent back will include the server's last received message index. The client will then send any backlogged messages, and the server will do the same, so each can catch up to the exact point and no data is lost.

Once they are registered with the server, they then request to "join" a room, providing the information about what type of user they are, either "venter" or "listener". The server then receives this message and places them in the appropriate queue. If there is a free venter and listener available at this point, a room will be created for them and they can start chatting. While the user waits for a room, they can request what queue position they are in, which will calculate where they are in the queue and then show this information to the user. This updates every few seconds.

Once the "join" message is relayed to the user, this means that they have officially joined a room and are able to chat with their partner. The partner's public user ID is provided with this message and, if possible, the geo-location info will appear, providing each partner with information about where the other is so as to prevent any awkward tension or provide context.

When in a room, an input box will appear for each of them which they can type into. Once they hit enter, a message is sent to the server which is then relayed to their partner. Their message will immediately show in their log, without the server sending a confirm message back.

When a user receives a "msg" event, this means their partner has sent them a message, which will be displayed in their log.

When a user receives a "sysmsg" event, this means a system administrator has sent out a message, which will be shown in their log with the other messages.

A user can request a new chat partner at any point in time after 15 seconds of conversation with their partner (to prevent repeatedly requesting new partners). Once this occurs, the server will mark that the two users have had an interaction and will prevent them from interacting in the future. Each will re-enter their respective queues and the queue processor will try to match them up with someone else. Since they have had an interaction, the queue processor will explicitly prevent pairing those two up again.

If a user disconnects, either by having a shoddy internet connection, or closing their browser, after the 10-second disconnect leeway, it will inform the remaining user that their partner disconnected and re-queues them into the system, allowing the process to repeat.

If the server application were to be restarted, thus losing all its in-memory data, it appears to the users as though they disconnect, and try to re-register under their old user IDs. The server then accepts this data and creates this "new" user profile. They also provide the public user ID of their partner and are given 15 seconds to reconnect with their partner. Assuming both users provide this data, they will be automatically re-paired with each other, allowing them to continue their conversations.