import { Request, Response } from "express";
import MessageModel from "../models/message"
import { MessageType } from '../../shared/models/message';
import { ioSocket } from '../server';


/**
 * Dataset Controller for handling dataset requests
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

    public message(req: Request, _: Response) {
        // Seperate data by first -
        const sender: string = req.body.message.toString().substring(0, req.body.message.toString().indexOf('-'));
        const message: string = req.body.message.body.toString().substring(req.body.message.toString().indexOf('-') + 1);

        if (message === MessageType.JOIN_CHAT) {
            // Add new member to audience
            this.model.audience.push(sender);
            console.log(`New Member Joined: ${sender}`);
            console.log(`Audience: ${this.model.audience}`);

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

        } else if(message.startsWith(MessageType.MESSAGE_ACK)) {
            this.model.handleACK(message);

        } else {
            let messageText = this.model.getMessageFromTextWithSequenceNum(message)

            if (this.model.leader === this.model.myPort && sender !== this.model.leader) {
                this.model.handleAckRequest(message, sender)
            }

            ioSocket.emit('message', { messageText });

            console.log(`Incoming Message from ${sender}: ${messageText}`);
        }
    }
}