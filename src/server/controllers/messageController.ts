import { Request, Response } from "express";
import MessageModel from "../models/message"
import { MessageType } from '../../shared/models/message';
import { ioSocket } from '../server';

/**
 * Message Controller for handling incoming messages
 */
export default class MessageController {
    private model: MessageModel;

    constructor(model: MessageModel) {
        this.model = model;
        if (this.model.myPort === this.model.leader) {
            // Pseudo-leader
        } else {
            // Join the group chat
            this.model.sendMessage(MessageType.JOIN_CHAT, [this.model.leader])
        }
    }

    public isLeader(res: Response): void {
        res.json(this.model.leader === this.model.myPort);
    }

    // Own client's message input request.
    public clientMessage(req: Request, res: Response) {
        const text: string = req.body.message;

        if (this.model.leader === this.model.myPort) {
            // Text Input Logic for Leader
            if (text.toString().trim() === MessageType.CREATE_CHAT) {
                // As psuedo-leader, send a list of participants to all other participants, they will ping and find average network delay
                this.model.sendMessage(`${MessageType.START_LEADERSHIP_SELECTION}-${this.model.audience.join(',') + "," + this.model.myPort}`, this.model.audience);
                this.model.participants = this.model.audience.concat([this.model.myPort]);
                this.model.checkLatency(this.model.participants);
            } else if (this.model.chatStarted) {
                console.log("chat started, msg recieved");
                this.model.sendMessage(this.model.addSequenceNumToMessage(text, this.model.messageSeqNum), this.model.audience, [this.model.leader]);
                this.model.messageSeqNum++;

                // Emit to frontend
                const sender = this.model.myPort;
                const messageId = `${sender}${Math.random()}`
                const messageText: string = text;
                ioSocket.emit('message', { sender, messageId, messageText });
                console.log(`I sent a message: ${text}`);
            } else {
                console.log("Chat has not been started yet! Type CREATE_CHAT to begin chatting!")
                res.sendStatus(400);
                return;
            }
        } else {
            // Text Input Logic for Non-Leader
            if (this.model.messageSeqNum == this.model.waitingForMessageSeqNum) {
                console.log("Waiting for previous message to be ACKed by leader")
            } else {
                this.model.waitingForMessageSeqNum = this.model.messageSeqNum;
                this.model.sendMessage(this.model.addSequenceNumToMessage(text, this.model.messageSeqNum), [this.model.leader]);

                // Emit to frontend
                const sender = this.model.myPort;
                const messageId = `${sender}${Math.random()}`
                const messageText: string = text;
                ioSocket.emit('message', { sender, messageId, messageText });
                console.log(`I sent a message: ${text}`);
            }
    
        }

        // Resolve client-server request
        res.sendStatus(200);
    }

    // Endpoint for other servers to send messages to.
    public serverMessage(req: Request, res: Response) {
        // Seperate data by first '-'
        const data = req.body;

        const sender: string = data.message.substring(0, data.message.toString().indexOf('-'));
        const message: string = data.message.substring(data.message.toString().indexOf('-') + 1);

        if (message === MessageType.JOIN_CHAT) {
            // Add new member to audience
            this.model.audience.push(sender);
            console.log(`New Member Joined: ${sender}`);
            console.log(`Audience: ${this.model.audience}`);
            if (this.model.chatStarted) {
                this.model.audience.push(this.model.myPort);
                const audienceWOLeader = this.model.audience;
                const audienceWOHost = this.model.audience;
                this.model.leader = this.model.myPort;
                this.model.sendMessage(`${MessageType.START_LEADERSHIP_SELECTION}-${audienceWOLeader.join(',')}`, audienceWOHost);
                this.model.chatStarted = false;
                ioSocket.emit('chatStarted', true); // emit to frontend
                this.model.resetTempVariables();
                this.model.participants = audienceWOLeader;
                this.model.audience = audienceWOHost;
                this.model.checkLatency(this.model.participants);
                clearInterval(this.model.awaitLeaderPingTimer);
            }

        } else if (message === MessageType.REQUEST_PING) {
            console.log("Latency Request Recieved");
            this.model.sendMessage(MessageType.REPLY_PING, [sender]);

        } else if (message === MessageType.REPLY_PING) {
            console.log("Latency Reply Recieved");
            const endTime: number[] = this.model.pingEndTime.get(sender) === undefined ? [Date.now()] : this.model.pingEndTime.get(sender)!.concat([Date.now()]);
            this.model.pingEndTime.set(sender, endTime);
            this.model.verifyLatencyCheckComplete(this.model.participants);

        } else if (message.startsWith(MessageType.LEADER_PING)) {
            this.model.handleLeaderPing(message);

        } else if (message.startsWith(MessageType.START_LEADERSHIP_SELECTION)) {
            // Lose leadership once receiving this message
            clearInterval(this.model.leadershipPingTimer);
            this.model.resetTempVariables();
            this.model.leader = sender
            this.model.chatStarted = false;
            ioSocket.emit('chatStarted', false); // Emit to frontend
            this.model.participants = message.substring(message.indexOf('-') + 1).split(',');
            // Send ping to all participants
            console.log(`Checking Latency of Participants...${this.model.participants.join(',')}`);
            this.model.checkLatency(this.model.participants);

        } else if (message.startsWith(MessageType.RETURN_VOTES)) {
            console.log("Return Votes Received");
            const votes = message.substring(message.indexOf('-') + 1).split(',');
            this.model.tallyVotes(votes, sender);

        } else if (message.startsWith(MessageType.CHAT_STARTED)) {
            this.model.leaderlife = -3;
            clearInterval(this.model.leadershipPingTimer);
            clearInterval(this.model.awaitLeaderPingTimer);
            const msg = message.split('-');
            this.model.leader = msg[1];
            this.model.chatStarted = true;
            if (this.model.leader == this.model.myPort) {
                this.model.audience = msg[2].split(',');
                this.model.participants = this.model.audience;
                this.model.audience = this.model.audience.filter((port) => port !== this.model.myPort);
                this.model.leadershipPing();
            } else {
                this.model.awaitLeaderPing();
            }
            console.log(`Chat has started with leader ${this.model.leader}! Message away!`);

            // Emit to frontend
            ioSocket.emit('chatStarted', true);
        } else if(message.startsWith(MessageType.MESSAGE_ACK)) {
            this.model.handleACK(message);

        } else {
            let messageText = this.model.getMessageFromTextWithSequenceNum(message);

            if (this.model.leader === this.model.myPort && sender !== this.model.leader) { 
                // I am leader, broadcast to all
                this.model.handleAckRequest(message, sender); // Broadcasts to audience 
            } 

            // Emit to frontend for display
            const messageId = `${sender}${Math.random()}`
            ioSocket.emit('message', { sender, messageId, messageText });
            console.log(`Incoming Message from ${sender}: ${messageText}`);
        }

        // Update frontend participant list
        const participants: string[] = this.model.participants;
        ioSocket.emit('participants', participants);

        // Resolve server-server request
        res.sendStatus(200);
    }
}