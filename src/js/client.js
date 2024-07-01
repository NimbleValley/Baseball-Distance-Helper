var socket = io();
socket.on('send-points', handleValues);
socket.on('image-error', handleImageError);

const imageUpload = document.getElementById('image-upload');
const imageUploadContainer = document.getElementById('image-upload-container');
const validateCanvas = document.getElementById('validate-canvas');

var uploadedImage;

imageUpload.addEventListener('change', function () {
    const reader = new FileReader();
    reader.onload = function () {
        uploadedImage = this.result;
        const base64 = this.result.replace(/.*base64,/, '');
        socket.emit('analyze_image', base64);
    };
    reader.readAsDataURL(this.files[0]);
}, false);

function handleImageError(error) {
    alert(`Error: ${error}`);
    imageUploadContainer.style.borderColor = 'rgb(221, 44, 44)';
}

async function handleValues(data) {
    console.log(data);
    imageUploadContainer.style.borderColor = 'rgb(109, 221, 44)';

    let ctx = validateCanvas.getContext('2d');

    validateCanvas.width = data.image.width;
    validateCanvas.height = data.image.height;

    await loadImage(uploadedImage).then(image =>
        ctx.drawImage(image, 0, 0)
    );

    const points = data.predictions[0].points;
    let hull = convexhull.makeHull(points);

    // Merge by distance
    let mergeDistance = validateCanvas.width / 65;
    for (let i = 0; i < hull.length; i++) {
        for (let p = i+1; p < hull.length; p++) {
            if (getDistance(hull[i], hull[p]) < mergeDistance) {
                hull[i].x = getMidpoint(hull[p].x, hull[i].x);
                hull[i].y = getMidpoint(hull[p].y, hull[i].y);
                hull.splice(p, 1);
                p--;
            }
        }
    }

    ctx.fillStyle = 'lime';
    console.log(hull)
    hull.forEach(element => {
        ctx.fillRect(element.x, element.y, 4, 4);
    });

    let fovLines = [
        [
            {
                x: 0,
                y: 0
            },
            {
                x: 0,
                y: 0
            }
        ],
        [
            {
                x: 0,
                y: 0
            },
            {
                x: 0,
                y: 0
            }
        ],
        [
            {
                x: 0,
                y: 0
            },
            {
                x: 0,
                y: 0
            }
        ],
        [
            {
                x: 0,
                y: 0
            },
            {
                x: 0,
                y: 0
            }
        ]
    ];

    ctx.strokeStyle = 'gold';
    ctx.lineWidth = 3;

    console.log(hull);
    console.log(newPoints);

    for (let i = 0; i < 8; i+=2) {
        ctx.beginPath();
        ctx.moveTo(newPoints[i].x, newPoints[i].y);
        ctx.lineTo(newPoints[i + 1].x, newPoints[i + 1].y);
        ctx.stroke();
    }
}

const loadImage = src =>
    new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });

function toRad(degrees) {
    return degrees * Math.PI / 180;
}

function getDistance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

function getMidpoint(v1, v2) {
    return (v1 + v2) / 2;
}