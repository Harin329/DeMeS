import * as express from 'express';
import { Request, Response } from "express";
import MessageController from '../controllers/messageController';
import MessageModel from '../models/message';

const router: express.Router = express.Router();
const model: MessageModel = new MessageModel();
const messageController: MessageController = new MessageController(model);

router.post('/api/message', (req: Request, res: Response) => {
    try {
        messageController.message(req, res);
        res.status(200);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
});

export default router;