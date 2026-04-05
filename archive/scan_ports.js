
const net = require('net');

const ports = [5432, 5433, 54320, 54321, 54322, 6543];

ports.forEach(port => {
  const socket = new net.Socket();
  socket.setTimeout(2000);
  
  socket.on('connect', () => {
    console.log(`Port ${port} is OPEN on 127.0.0.1`);
    socket.destroy();
  });
  
  socket.on('timeout', () => {
    console.log(`Port ${port} TIMEOUT on 127.0.0.1`);
    socket.destroy();
  });
  
  socket.on('error', (err) => {
    console.log(`Port ${port} CLOSED on 127.0.0.1 (${err.message})`);
  });
  
  socket.connect(port, '127.0.0.1');
});
