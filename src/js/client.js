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
var isCalculated = false;
var hull;
var closestPointToClick;
var infieldLines = [new InfieldLine(0, 0, true)];
var grid = [];
var squareLength;

var mousePos = new Point(0, 0);

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
    console.log(infieldLines);

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

    for (let i = 0; i < infieldLines.length; i++) {
        if (!infieldLines[i].isFull) {
            break;
        }

        ctx.beginPath();
        ctx.moveTo(infieldLines[i].p1.x, infieldLines[i].p1.y);
        ctx.lineTo(infieldLines[i].p2.x, infieldLines[i].p2.y);
        ctx.stroke();
    }

    window.requestAnimationFrame(animateSelectPoints);
}

function handleCanvasMouse(e) {
    let rect = e.target.getBoundingClientRect();

    mousePos.x = e.clientX - rect.left;
    mousePos.y = e.clientY - rect.top;
}

function handleCanvasClick() {
    if (!isCalculated) {
        if (infieldLines[infieldLines.length - 1].isFull) {
            infieldLines.push(new InfieldLine(hull[closestPointToClick].x, hull[closestPointToClick].y, false));
        } else {
            infieldLines[infieldLines.length - 1].addPoint(hull[closestPointToClick].x, hull[closestPointToClick].y);
        }
        if (infieldLines.length >= 4 && infieldLines[3].isFull) {
            runCalculations();
        }
    }
}

function runCalculations() {
    isCalculated = true;

    let slopes = [];

    for (let i = 0; i < infieldLines.length; i++) {
        slopes.push((infieldLines[i].p1.y - infieldLines[i].p2.y) / (infieldLines[i].p1.x - infieldLines[i].p2.x));
    }

    let sortedSlopes = slopes.toSorted();
    let slopeIndicies = [];

    // Sort slopes and find their set of points. User could select lines in different orders, this ensures calculations always work
    for (let i = 0; i < slopes.length; i++) {
        for (let s = 0; s < slopes.length; s++) {
            if (Math.round(sortedSlopes[i] * 1000) == Math.round(slopes[s] * 1000)) {
                slopeIndicies.push(s);
                continue;
            }
        }
    }

    // Now find vanishing points, intersection of each set of 'parallel' lines
    let vanishingPoint1 = getIntersectionPoint(infieldLines[slopeIndicies[0]].p1, infieldLines[slopeIndicies[0]].p2, infieldLines[slopeIndicies[1]].p1, infieldLines[slopeIndicies[1]].p2);
    let vanishingPoint2 = getIntersectionPoint(infieldLines[slopeIndicies[2]].p1, infieldLines[slopeIndicies[2]].p2, infieldLines[slopeIndicies[3]].p1, infieldLines[slopeIndicies[3]].p2);
    
    // Find the corner of the first quadrilateral, we'll assume it is a perfect square as most infields are
    grid.push(
        new GridSquare(
            new GridPoint(getIntersectionPoint(infieldLines[slopeIndicies[0]].p1, infieldLines[slopeIndicies[0]].p2, infieldLines[slopeIndicies[2]].p1, infieldLines[slopeIndicies[2]].p2), new Point(0, 0)),
            new GridPoint(getIntersectionPoint(infieldLines[slopeIndicies[2]].p1, infieldLines[slopeIndicies[2]].p2, infieldLines[slopeIndicies[1]].p1, infieldLines[slopeIndicies[1]].p2), new Point(0, 0)),
            new GridPoint(getIntersectionPoint(infieldLines[slopeIndicies[1]].p1, infieldLines[slopeIndicies[1]].p2, infieldLines[slopeIndicies[3]].p1, infieldLines[slopeIndicies[3]].p2), new Point(0, 0)),
            new GridPoint(getIntersectionPoint(infieldLines[slopeIndicies[0]].p1, infieldLines[slopeIndicies[0]].p2, infieldLines[slopeIndicies[3]].p1, infieldLines[slopeIndicies[3]].p2), new Point(0, 0))
        )
    );

    // Update initial lengths, for testing purposes we will use 90 feet
    // Left field line will be x while right field line will be y
    // TODO change for more accurate results
    squareLength = 90;
    grid[0].points[0].worldPoint = new Point(0, 0);
    grid[0].points[1].worldPoint = new Point(squareLength, 0);
    grid[0].points[2].worldPoint = new Point(squareLength, squareLength);
    grid[0].points[3].worldPoint = new Point(0, squareLength);

    let middleVanishingPoint = getIntersectionPoint(vanishingPoint1, vanishingPoint2, grid[0].points[0].screenPoint, grid[0].points[2].screenPoint);
    console.log(vanishingPoint1);
    console.log(vanishingPoint2);
    console.log(middleVanishingPoint);

    ctx.fillRect(middleVanishingPoint.x, middleVanishingPoint.y, 20, 20);

    branchFromSquare(grid[0], vanishingPoint1, vanishingPoint2, middleVanishingPoint);

    showGrid();
}

function branchFromSquare(square, vp1, vp2, vpMid) {
    grid.push(
        new GridSquare(
            new GridPoint(getIntersectionPoint(infieldLines[slopeIndicies[0]].p1, infieldLines[slopeIndicies[0]].p2, infieldLines[slopeIndicies[2]].p1, infieldLines[slopeIndicies[2]].p2), square.points[2].worldPoint),
            new GridPoint(getIntersectionPoint(infieldLines[slopeIndicies[2]].p1, infieldLines[slopeIndicies[2]].p2, infieldLines[slopeIndicies[1]].p1, infieldLines[slopeIndicies[1]].p2), new Point(0, 0)),
            new GridPoint(getIntersectionPoint(infieldLines[slopeIndicies[1]].p1, infieldLines[slopeIndicies[1]].p2, infieldLines[slopeIndicies[3]].p1, infieldLines[slopeIndicies[3]].p2), new Point(0, 0)),
            new GridPoint(getIntersectionPoint(infieldLines[slopeIndicies[0]].p1, infieldLines[slopeIndicies[0]].p2, infieldLines[slopeIndicies[3]].p1, infieldLines[slopeIndicies[3]].p2), new Point(0, 0))
        )
    );
}

function showGrid() {
    ctx.fillStyle = 'cyan';
    ctx.font = '12px serif';
    for(let i = 0; i < grid.length; i ++) {
        for(let p = 0; p < 4; p ++) {
            let tempSquare = grid[i];
            ctx.fillRect(tempSquare.points[p].screenPoint.x, tempSquare.points[p].screenPoint.y, 5, 5);
            ctx.fillText(`(${tempSquare.points[p].worldPoint.x}, ${tempSquare.points[p].worldPoint.y})`, tempSquare.points[p].screenPoint.x, tempSquare.points[p].screenPoint.y+10);
        }
    }
}

function getIntersectionPoint(p1, p2, p3, p4) {
    var ua, ub, denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (denom == 0) {
        return null;
    }
    ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
    ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;
    return new Point( p1.x + ua * (p2.x - p1.x), p1.y + ua * (p2.y - p1.y));
}