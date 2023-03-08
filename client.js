import { createServer, createConnection } from 'node:net';

// Accept init ports from CLI
const args = process.argv.slice(2);
const myPort = args[0];

const audience = [args[1]];

// Listen on a port for incoming messages
const server = createServer((socket) => {
    socket.on('data', (data) => {
        console.log(`Incoming Message: ${data.toString()}`);
    });
});

server.listen(myPort, () => {
    console.log(`Server listening on port ${myPort}`);
});

// Send new messages
process.stdin.resume();
process.stdin.setEncoding('utf8');
process.stdin.on('data', (text) => {
    for (const address of audience) {
        const client = createConnection({ port: address }, () => {
            client.write(text);
            client.end();
        });
    }
});
