const { Server } = require('ssh2');
const crypto = require('crypto');
const { spawn } = require('child_process');

// Generate an RSA host key dynamically on startup
const { privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
});

const server = new Server({
  hostKeys: [privateKey]
}, (client) => {
  console.log('Client connected!');

  client.on('authentication', (ctx) => {
    // Accept authentication (customize/restrict credentials here if needed)
    ctx.accept();
  }).on('ready', () => {
    console.log('Client authenticated successfully');

    client.on('session', (accept) => {
      const session = accept();

      // Handle single command execution (e.g., ssh user@host "uname -a && free -m")
      session.on('exec', (accept, reject, info) => {
        const stream = accept();
        console.log(`Executing command via bash -c: ${info.command}`);

        const child = spawn('bash', ['-c', info.command], {
          env: { ...process.env, TERM: 'xterm-256color', PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' }
        });

        child.stdout.on('data', (data) => {
          stream.write(data);
        });

        child.stderr.on('data', (data) => {
          stream.stderr.write(data);
        });

        child.on('close', (code) => {
          stream.exit(code);
          stream.end();
        });
      });

      // Handle interactive shell sessions (e.g., plain "ssh user@host")
      session.on('shell', (accept) => {
        const stream = accept();
        console.log('Opening interactive bash shell');

        const child = spawn('bash', [], {
          env: { ...process.env, TERM: 'xterm-256color', PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' }
        });

        child.stdout.on('data', (data) => {
          stream.write(data);
        });

        child.stderr.on('data', (data) => {
          stream.stderr.write(data);
        });

        stream.on('data', (data) => {
          child.stdin.write(data);
        });

        child.on('close', (code) => {
          stream.exit(code);
          stream.end();
        });
      });
    });
  }).on('end', () => {
    console.log('Client disconnected');
  });
});

// Bind to Runsite's dynamic environment PORT on 0.0.0.0
const PORT = process.env.PORT || 2222;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`SSH2 xterm shell server listening on port ${PORT}`);
});
