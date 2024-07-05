import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import axios from 'axios';

const KEY = "1234";

const app = express();
app.use(express.static('./src'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const PORT = 8080;

const server = createServer(app);
server.listen(PORT, function () {
    console.log(`Server running on port ${PORT}`);
});

const socketio = new Server(server);

socketio.on('connection', (socket) => {
    socket.on('analyze_infield', analyzeInfield);
    socket.on('analyze_walls', analyzeWall);
});

function analyzeInfield(image) {
    console.log('Imaged recieved by local server.');

    axios({
        method: "POST",
        url: "https://detect.roboflow.com/baseballcamerafov/2",
        params: {
            api_key: KEY
        },
        data: image,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        }
    })
    .then(function(response) {
        console.log(response.data);
        socketio.emit('send-infield-points', response.data);
    })
    .catch(function(error) {
        console.log(error.message);
        socketio.emit('image-error', error.message);
    });
}

function analyzeWall(image) {
    console.log('Imaged recieved by local server.');

    axios({
        method: "POST",
        url: "https://detect.roboflow.com/baseballwalls/2",
        params: {
            api_key: KEY
        },
        data: image,
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        }
    })
    .then(function(response) {
        console.log(response.data);
        socketio.emit('send-wall-points', response.data);
    })
    .catch(function(error) {
        console.log(error.message);
        socketio.emit('image-error', error.message);
    });
}

