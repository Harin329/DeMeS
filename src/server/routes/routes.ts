import * as express from 'express';
import MessageController from '../controllers/messageController';
import MessageModel from '../models/message';

const router = express.Router();
const model = new MessageModel();
const messageController = new MessageController(model);

router.post('/api/message', (req, res) => {
    try {
        messageController.message(req, res);
        res.status(200);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
      }
});

export default router;