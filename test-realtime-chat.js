const { io } = require('socket.io-client');

const SESSION_ID = `session_${Date.now()}_test123`;

const socket = io('http://localhost:3005/realtime', {
  transports: ['polling'],
  auth: { sessionId: SESSION_ID },
});

socket.on('connect', () => {
  console.log('✅ Connected to /realtime namespace! Socket ID:', socket.id);
  
  // Join support
  socket.emit('joinSupport', { userId: SESSION_ID }, (res) => {
    console.log('joinSupport response:', JSON.stringify(res));
  });
  
  // Send message
  setTimeout(() => {
    console.log('Sending chat:send-message with session_* senderId...');
    socket.emit('chat:send-message', {
      roomId: SESSION_ID,
      content: 'REAL TEST from student widget ' + new Date().toISOString(),
      senderType: 'customer',
      senderId: SESSION_ID,
      senderName: 'Test Student',
      messageType: 'text',
      roomType: 'support',
    }, (response) => {
      console.log('ACK:', JSON.stringify(response));
      setTimeout(() => {
        socket.disconnect();
        process.exit(response?.success ? 0 : 1);
      }, 2000);
    });
  }, 1000);
});

socket.on('chat:new-message', (msg) => {
  console.log('📬 Received broadcast:', msg.content || msg.message);
});

socket.on('connect_error', (err) => {
  console.error('❌ Connect error:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('⏰ Timeout');
  process.exit(1);
}, 15000);
