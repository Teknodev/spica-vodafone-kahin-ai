const WebSocket = require('ws');

export async function setReward(req, res) {
    // createConnection();
    // sendMessageToServer();
    return "ok"
}

function createConnection() {
    const socket = new WebSocket('wss://vodafone-sayi-krali-a4d57.hq.spicaengine.com/api/bucket/605ca275e9960e002c2781a4/data?Authorization=IDENTITY+eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImlkZW50aWZpZXIiOiJzcGljYSIsInBvbGljaWVzIjpbIkFwaUtleUZ1bGxBY2Nlc3MiLCJJZGVudGl0eUZ1bGxBY2Nlc3MiLCJQb2xpY3lGdWxsQWNjZXNzIiwiU3RyYXRlZ3lGdWxsQWNjZXNzIiwiUGFzc3BvcnRGdWxsQWNjZXNzIiwiQWN0aXZpdHlGdWxsQWNjZXNzIiwiU3RvcmFnZUZ1bGxBY2Nlc3MiLCJXZWJob29rRnVsbEFjY2VzcyIsIkZ1bmN0aW9uRnVsbEFjY2VzcyIsIkRhc2hib2FyZEZ1bGxBY2Nlc3MiLCJCdWNrZXRGdWxsQWNjZXNzIiwiUHJlZmVyZW5jZUZ1bGxBY2Nlc3MiLCJTdGF0dXNGdWxsQWNjZXNzIiwiQXNzZXRGdWxsQWNjZXNzIiwiVmVyc2lvbkNvbnRyb2xGdWxsQWNjZXNzIiwiNjU1YzhjNmJjMjUwZWEwMDJjNzgzYWY0Il19.eyJfaWQiOiI2NTVjOGY1YWMyNTBlYTAwMmM3ODNjM2IiLCJpZGVudGlmaWVyIjoic3BpY2EiLCJhdHRyaWJ1dGVzIjp7Im1zaXNkbiI6IjAwMDAiLCJyb2xlIjoiYWRtaW4ifSwicG9saWNpZXMiOlsiQXBpS2V5RnVsbEFjY2VzcyIsIklkZW50aXR5RnVsbEFjY2VzcyIsIlBvbGljeUZ1bGxBY2Nlc3MiLCJTdHJhdGVneUZ1bGxBY2Nlc3MiLCJQYXNzcG9ydEZ1bGxBY2Nlc3MiLCJBY3Rpdml0eUZ1bGxBY2Nlc3MiLCJTdG9yYWdlRnVsbEFjY2VzcyIsIldlYmhvb2tGdWxsQWNjZXNzIiwiRnVuY3Rpb25GdWxsQWNjZXNzIiwiRGFzaGJvYXJkRnVsbEFjY2VzcyIsIkJ1Y2tldEZ1bGxBY2Nlc3MiLCJQcmVmZXJlbmNlRnVsbEFjY2VzcyIsIlN0YXR1c0Z1bGxBY2Nlc3MiLCJBc3NldEZ1bGxBY2Nlc3MiLCJWZXJzaW9uQ29udHJvbEZ1bGxBY2Nlc3MiLCI2NTVjOGM2YmMyNTBlYTAwMmM3ODNhZjQiXSwiaWF0IjoxNzAwNTY0ODg5LCJleHAiOjE3MzIxMjE4MTUsImF1ZCI6InNwaWNhLmlvIiwiaXNzIjoiaHR0cHM6Ly92b2RhZm9uZS1zYXlpLWtyYWxpLWE0ZDU3LmhxLnNwaWNhZW5naW5lLmNvbS9hcGkifQ.aMVAS_n__ABjqK63tgthO9zCfClYoSxCTzMKIGN1JeY');

    // Connection event
    socket.on('open', () => {
        console.log('Connected to remote server');
    });

    // Message event
    socket.on('message', (message) => {
        console.log(`Received message from server: ${message}`);
    });

    // Close event
    socket.on('close', () => {
        console.log('Connection closed');
    });

}

function sendMessageToServer(message) {
    if (socket.readyState === WebSocket.OPEN) {
        // Check if the connection is open before sending the message
        socket.send(message);
    } else {
        console.log('Connection is not open. Cannot send message.');
    }
}