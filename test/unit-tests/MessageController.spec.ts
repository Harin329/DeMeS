import "jest";
import MessageModel from "../../src/server/models/message";
import MessageController from "../../src/server/controllers/messageController";

import { Request, Response } from "express";
import { ioSocket } from "../../src/server/server";

jest.mock("../../src/server/models/message");
jest.mock("../../src/server/server");

describe("MessageController", () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let messageController: MessageController;

    beforeEach(() => {
        const messageModel = new MessageModel();
        messageController = new MessageController(messageModel);
        mockReq = {
            body: {
                message: "",
            },
        };
        mockRes = {
            json: jest.fn(),
            sendStatus: jest.fn(),
        };
    });

    describe("isLeader", () => {
        test("should send a JSON response indicating whether the current instance is the leader", () => {
            messageController.isLeader(mockRes as Response);
            expect(mockRes.json).toHaveBeenCalledWith(true);
        });
    });

    describe("clientMessage", () => {
        beforeEach(() => {
            ioSocket.emit = jest.fn();
            messageController.clientMessage(
                mockReq as Request,
                mockRes as Response
            );
        });

        test("should send a 400 status code and not send a message if the chat has not been started yet", () => {
            expect(mockRes.sendStatus).toHaveBeenCalledWith(400);
            expect(ioSocket.emit).not.toHaveBeenCalled();
        });

        test("should send a message and emit an event if the current instance is the leader and the chat has started", () => {
            const messageText = "Hi friend";
            mockReq.body.message = messageText;
            messageController.model.chatStarted = true;
            messageController.clientMessage(
                mockReq as Request,
                mockRes as Response
            );
            expect(ioSocket.emit).toHaveBeenCalledWith("message", {
                sender: messageController.model.myPort,
                messageId: expect.any(String),
                messageText,
            });
        });

        test("should send a message and emit an event if if seq num is not equal to waitingForMessageSeqNum", () => {
            const messageText = "Hello world!";
            mockReq.body.message = messageText;
            messageController.model.leader = "8080";
            messageController.model.messageSeqNum = 1;
            messageController.model.waitingForMessageSeqNum = 0;
            messageController.clientMessage(
                mockReq as Request,
                mockRes as Response
            );
            expect(ioSocket.emit).toHaveBeenCalledWith("message", {
                sender: messageController.model.myPort,
                messageId: expect.any(String),
                messageText,
            });
        });

        test("should not send message if waiting for ack", () => {
            const messageText = "Hello world!";
            mockReq.body.message = messageText;
            messageController.model.leader = "8080";
            messageController.model.messageSeqNum = 1;
            messageController.model.waitingForMessageSeqNum = 1;
            messageController.clientMessage(
                mockReq as Request,
                mockRes as Response
            );
            expect(ioSocket.emit).not.toHaveBeenCalled();
        });
    });
});
