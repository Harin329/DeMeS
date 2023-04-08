import * as express from 'express';
import { Request, Response } from "express";
import MessageController from '../controllers/messageController';
import MessageModel from '../models/message';

const router: express.Router = express.Router();
const model: MessageModel = new MessageModel();
const messageController: MessageController = new MessageController(model);

router.post('/api/clientMessage', (req: Request, res: Response) => {
    try {
        messageController.clientMessage(req, res);
        // message controller will resolve requests
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.post('/api/serverMessage', (req: Request, res: Response) => {
    try {
        messageController.serverMessage(req, res);
        // message controller will resolve requests
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
});

router.get('/api/port', (_, res) => {
    res.json(process.env.PORT);
});

router.get('/api/isLeader', (_, res) => {
    try {
        messageController.isLeader(res);
        // message controller will resolve requests
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;