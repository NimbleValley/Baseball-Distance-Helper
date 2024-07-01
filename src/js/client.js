var socket = io();
socket.on('send-points', handleValues);
socket.on('image-error', handleImageError);

const imageUpload = document.getElementById('image-upload');
const imageUploadContainer = document.getElementById('image-upload-container');
const validateCanvas = document.getElementById('validate-canvas');
var ctx = validateCanvas.getContext('2d');

validateCanvas.addEventListener('mousemove', handleCanvasMouse);
validateCanvas.addEventListener('click', handleCanvasClick);

var uploadedImage;
var isFovCalculated = false;
var hull;
var closestPointToClick;
var fovLines = [new FOVLine(0, 0, true)];

var mousePos = {
    x: 0,
    y: 0
}

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

    validateCanvas.width = data.image.width;
    validateCanvas.height = data.image.height;

    await loadImage(uploadedImage).then(image =>
        ctx.drawImage(image, 0, 0)
    );

    const points = data.predictions[0].points;
    hull = convexhull.makeHull(points);

    // Merge by distance
    let mergeDistance = validateCanvas.width / 65;
    for (let i = 0; i < hull.length; i++) {
        for (let p = i + 1; p < hull.length; p++) {
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
        ctx.fillRect(element.x - 5, element.y - 5, 10, 10);
    });

    console.log(hull);
    console.log(fovLines);

    animateSelectPoints();
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

function animateSelectPoints() {
    ctx.fillStyle = 'lime';

    let closestDistance = 100000;
    closestPointToClick = 0;

    for (let i = 0; i < hull.length; i++) {
        ctx.fillRect(hull[i].x - 5, hull[i].y - 5, 10, 10);

        let tempDistance = getDistance(mousePos, hull[i]);
        if (tempDistance < closestDistance) {
            closestDistance = tempDistance;
            closestPointToClick = i;
        }
    }

    ctx.fillStyle = 'red';
    ctx.fillRect(hull[closestPointToClick].x - 5, hull[closestPointToClick].y - 5, 10, 10);

    ctx.strokeStyle = 'gold';
    ctx.lineWidth = 5;

    for (let i = 0; i < fovLines.length; i++) {
        if (!fovLines[i].isFull) {
            break;
        }

        ctx.beginPath();
        ctx.moveTo(fovLines[i].p1.x, fovLines[i].p1.y);
        ctx.lineTo(fovLines[i].p2.x, fovLines[i].p2.y);
        ctx.stroke();
    }

    window.requestAnimationFrame(animateSelectPoints);
}

function handleCanvasMouse(e) {
    let rect = e.target.getBoundingClientRect();

    mousePos = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    }
}

function handleCanvasClick() {
    if (!isFovCalculated) {
        if (fovLines[fovLines.length - 1].isFull) {
            fovLines.push(new FOVLine(hull[closestPointToClick].x, hull[closestPointToClick].y, false));
        } else {
            fovLines[fovLines.length - 1].addPoint(hull[closestPointToClick].x, hull[closestPointToClick].y);
        }
        if (fovLines.length >= 4 && fovLines[3].isFull) {
            runCalculations();
        }
    }
}

function runCalculations() {
    isFovCalculated = true;

    let slopes = [];

    for (let i = 0; i < fovLines.length; i++) {
        slopes.push((fovLines[i].p1.y - fovLines[i].p2.y) / (fovLines[i].p1.x - fovLines[i].p2.x));
    }

    let sortedSlopes = slopes.toSorted();
    let slopeIndicies = [];

    for(let i = 0; i < slopes.length; i ++) {
        for(let s = 0; s < slopes.length; s ++) {
            if(Math.round(sortedSlopes[i]*1000) == Math.round(slopes[s]*1000)) {
                slopeIndicies.push(s);
                continue;
            }
        }
    }

    let vanishingPoint1 = getIntersectionPoint(fovLines[slopeIndicies[0]].p1.x, fovLines[slopeIndicies[0]].p1.y, fovLines[slopeIndicies[0]].p2.x, fovLines[slopeIndicies[0]].p2.y, fovLines[slopeIndicies[1]].p1.x, fovLines[slopeIndicies[1]].p1.y, fovLines[slopeIndicies[1]].p2.x, fovLines[slopeIndicies[1]].p2.y);
    let vanishingPoint2 = getIntersectionPoint(fovLines[slopeIndicies[2]].p1.x, fovLines[slopeIndicies[2]].p1.y, fovLines[slopeIndicies[2]].p2.x, fovLines[slopeIndicies[2]].p2.y, fovLines[slopeIndicies[3]].p1.x, fovLines[slopeIndicies[3]].p1.y, fovLines[slopeIndicies[3]].p2.x, fovLines[slopeIndicies[3]].p2.y);
    console.log(vanishingPoint1);
}

function getIntersectionPoint(x1, y1, x2, y2, x3, y3, x4, y4) {
    var ua, ub, denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (denom == 0) {
        return null;
    }
    ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
    return {
        x: x1 + ua * (x2 - x1),
        y: y1 + ua * (y2 - y1),
    };
}