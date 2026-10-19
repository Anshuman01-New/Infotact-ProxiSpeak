
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const httpServer = http.createServer(app);

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Create the Socket.IO server
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Store connected users and their positions in memory
const avatars = new Map();

// Home route
app.get("/", (req, res) => {
    res.send("Welcome to ProxiSpeak Backend!");
});

// Health check route
app.get("/health", (req, res) => {
    res.json({
        success: true,
        message: "ProxiSpeak backend is running!"
    });
});

// Real-time communication
io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // Give the new user the current avatars
    socket.emit("existing-avatars", Array.from(avatars.values()));

    // Register this user's initial position
    const avatar = {
        id: socket.id,
        x: 100,
        y: 100
    };

    avatars.set(socket.id, avatar);

    // Notify other users
    socket.broadcast.emit("avatar-joined", avatar);

    // Receive and broadcast movement
    socket.on("move-avatar", (position) => {
        if (!position) return;

        const { x, y } = position;

        if (
            typeof x !== "number" ||
            typeof y !== "number" ||
            !Number.isFinite(x) ||
            !Number.isFinite(y)
        ) {
            return;
        }

        // Keep coordinates within a basic virtual-office boundary
        const updatedAvatar = {
            id: socket.id,
            x: Math.max(0, Math.min(1000, x)),
            y: Math.max(0, Math.min(1000, y))
        };

        avatars.set(socket.id, updatedAvatar);

        io.emit("avatar-moved", updatedAvatar);
    });

    // Remove disconnected users
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);

        avatars.delete(socket.id);
        io.emit("avatar-left", socket.id);
    });
});

// Start the HTTP and Socket.IO server
httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`ProxiSpeak server running on port ${PORT}`);
});
