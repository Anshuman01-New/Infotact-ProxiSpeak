export const CLIENT_TO_SERVER_EVENTS = {
    PLAYER_JOIN: "join-room",
    PLAYER_MOVE: "player-move",

    AUDIO_STATE: "update-audio-state",

    WEBRTC_OFFER: "webrtc-offer",
    WEBRTC_ANSWER: "webrtc-answer",
    WEBRTC_ICE_CANDIDATE: "webrtc-ice-candidate",
    WEBRTC_CLOSE_PEER: "webrtc-close-peer",
};

export const SERVER_TO_CLIENT_EVENTS = {
    ROOM_STATE: "room-state",
    USER_JOINED: "user-joined",
    USER_LEFT: "user-left",

    PLAYER_MOVED: "player-moved",
    PEER_ENTERED_EARSHOT: "peer-entered-earshot",
    PEER_LEFT_EARSHOT: "peer-left-earshot",
    PROXIMITY_UPDATE: "proximity-update",
    SIGNALING_ERROR: "signaling-error"    
};