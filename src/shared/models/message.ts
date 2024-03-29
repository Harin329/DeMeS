export type Port = string;

export enum MessageType {
    CREATE_CHAT = "CREATE_CHAT",
    JOIN_CHAT = "JOIN_CHAT",
    START_LEADERSHIP_SELECTION = "START_LEADERSHIP_SELECTION",
    REQUEST_PING = "REQUEST_PING",
    REPLY_PING = "REPLY_PING",
    RETURN_VOTES = "RETURN_VOTES",
    CHAT_STARTED = "CHAT_STARTED",
    MESSAGE_ACK = "MESSAGE_ACK",
    LEADER_PING = "LEADER_PING",
}

export const SEQUENCE_STRING_START = "@#!$&(*#!$[";
export const SEQUENCE_STRING_END = "]@#!$&(*#!$";