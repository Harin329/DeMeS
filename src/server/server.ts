import * as express from 'express';
import apiRouter from './routes/routes';
import { Server } from 'http';
import { Server as SocketIOServer } from 'socket.io';

const app = express();
app.use(express.json());
const server = new Server(app);
export const ioSocket = new SocketIOServer(server);

app.use(express.static('public'));
app.use(apiRouter);

const port = process.env.PORT || 3000;
const env = process.env.NODE_ENV || 'development';
server.listen(port, () => console.log(`Http (express) server listening on port ${port}, env: ${env}`));

export default app; // For integration testing