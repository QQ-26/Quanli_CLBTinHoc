require('dotenv').config();
const app = require('./src/app');
const connectDB = require('./src/config/db');

const PORT = process.env.PORT || 3000;

// Connect to Database and Start Server
connectDB()
    .then(() => {
        const server = app.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
        });

        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`❌ Error: Port ${PORT} is already in use.`);
            } else {
                console.error(`❌ Server Error: ${error.message}`);
            }
            process.exit(1);
        });
    })
    .catch((error) => {
        console.error(`❌ Startup Error: ${error.message}`);
        process.exit(1);
    });

