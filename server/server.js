const WebSocket = require("ws");

const server = new WebSocket.Server({ host: "5.136.81.51", port: 3000 });

console.log("WebSocket сервер запущен на 5.136.81.51:3000 (доступен для локальной сети)");

let lobbies = {};

server.on("connection", (ws) => {
    console.log("Новый игрок подключился");

    ws.on("message", (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === "createLobby") {
                const lobbyCode = data.lobbyId.toUpperCase();
                if (!lobbies[lobbyCode]) {
                    lobbies[lobbyCode] = { players: {}, messages: [] };
                    addPlayerToLobby(ws, data.username, lobbyCode);
                    ws.send(JSON.stringify({ type: "lobbyCreated", lobbyId: lobbyCode }));
                }
            }

            if (data.type === "joinLobby") {
                const lobbyCode = data.lobbyId.toUpperCase();
                if (lobbies[lobbyCode]) {
                    addPlayerToLobby(ws, data.username, lobbyCode);
                    sendHistory(ws, lobbyCode);
                    ws.send(JSON.stringify({ type: "lobbyJoined", lobbyId: lobbyCode }));
                } else {
                    ws.send(JSON.stringify({ type: "error", message: "Лобби не найдено!" }));
                }
            }

            if (data.type === "message") {
                const lobby = lobbies[data.lobbyId.toUpperCase()];
                if (!lobby || !lobby.players[data.username]) return;

                lobby.players[data.username].score += 1;
                lobby.messages.push({ username: data.username, text: data.text });

                broadcastToLobby(data.lobbyId, {
                    type: "message",
                    username: data.username,
                    text: data.text
                });

                updatePlayerList(data.lobbyId);
            }
        } catch (error) {
            console.error("Ошибка обработки сообщения:", error);
        }
    });

    ws.on("close", () => {
        removePlayer(ws);
    });
});

function addPlayerToLobby(ws, username, lobbyId) {
    if (!lobbies[lobbyId]) return;

    if (!lobbies[lobbyId].players[username]) {
        lobbies[lobbyId].players[username] = { username, score: 0 };
    }

    ws.lobbyId = lobbyId;
    ws.username = username;

    updatePlayerList(lobbyId);
}

function removePlayer(ws) {
    if (!ws.lobbyId || !ws.username) return;

    const lobby = lobbies[ws.lobbyId];
    if (lobby) {
        delete lobby.players[ws.username];

        if (Object.keys(lobby.players).length === 0) {
            delete lobbies[ws.lobbyId];
        } else {
            updatePlayerList(ws.lobbyId);
        }
    }
}

function sendHistory(ws, lobbyId) {
    if (lobbies[lobbyId]) {
        ws.send(JSON.stringify({ type: "history", messages: lobbies[lobbyId].messages }));
    }
}

function updatePlayerList(lobbyId) {
    if (!lobbies[lobbyId]) return;
    broadcastToLobby(lobbyId, { type: "playerList", players: Object.values(lobbies[lobbyId].players) });
}

function broadcastToLobby(lobbyId, data) {
    server.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN && client.lobbyId === lobbyId) {
            client.send(JSON.stringify(data));
        }
    });
}

console.log("WebSocket сервер запущен на порту 3000");
