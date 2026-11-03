const { Server } = require('ssh2');
const fs = require('fs');
const crypto = require('crypto');

const SSH_PORT = process.env.SSH_PORT || 2222;
const hostKeyPath = './host_key.pem';

// Automatically generate an RSA host key if it doesn't exist
if (!fs.existsSync(hostKeyPath)) {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  fs.writeFileSync(hostKeyPath, privateKey.export({ type: 'pkcs1', format: 'pem' }));
}

// Start the SSH2 server
new Server({
  hostKeys: [fs.readFileSync(hostKeyPath)]
}, (client) => {
  console.log('SSH client connected');

  client.on('authentication', (ctx) => {
    // Accept authentication for internal private service usage
    ctx.accept();
  }).on('ready', () => {
    console.log('SSH client authenticated successfully');

    client.on('session', (accept) => {
      const session = accept();

      session.on('exec', (accept, reject, info) => {
        const stream = accept();
        const cmd = info.command.trim();
        console.log(`Received SSH command: ${cmd}`);

        // Handle the /api/get-ram command request via SSH
        if (cmd === '/api/get-ram' || cmd.includes('get-ram')) {
          stream.write(JSON.stringify({ ram_mb: 1024 }, null, 2) + '\n');
          stream.exit(0);
        } else {
          stream.write(`Unknown command: ${cmd}\n`);
          stream.exit(1);
        }
        
        stream.end();
      });
    });
  }).on('close', () => {
    console.log('SSH client disconnected');
  });

}).listen(SSH_PORT, '0.0.0.0', () => {
  console.log(`SSH2 server listening on internal port ${SSH_PORT}`);
});
