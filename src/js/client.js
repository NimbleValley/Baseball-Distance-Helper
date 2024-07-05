var socket = io();
socket.on('send-infield-points', handleValues);
socket.on('send-wall-points', handleWallPoints);
socket.on('image-error', handleImageError);

const imageUpload = document.getElementById('image-upload');
const imageUploadContainer = document.getElementById('image-upload-container');
const canvas = document.getElementById('validate-canvas');
var ctx = canvas.getContext('2d');

canvas.addEventListener('mousemove', handleCanvasMouse);
canvas.addEventListener('mousedown', () => { mouseDown = true });
canvas.addEventListener('mouseup', () => { mouseDown = false });
canvas.addEventListener('mouseleave', () => { mouseDown = false });
canvas.addEventListener('click', handleCanvasClick);

var mouseDown = false;
var isCalculated = false;

var uploadedImage;
var hull;
var closestPointToClick;

var infieldLines = [new InfieldLine(0, 0, true)];
var grid = [];

var squareLength;
var canvasImage;
var wallData;

var utilPoints = {
    vanishingPoint1: new Point(0, 0),
    vanishingPoint2: new Point(0, 0),
    middleVanishingPoint: new Point(0, 0)
}

var markerPos = new Point(-5, -5);

var mousePos = new Point(0, 0);

imageUpload.addEventListener('change', function () {
    const reader = new FileReader();
    reader.onload = function () {
        uploadedImage = this.result;
        const base64 = this.result.replace(/.*base64,/, '');
        socket.emit('analyze_infield', base64);
        socket.emit('analyze_walls', base64);
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

    canvas.width = data.image.width;
    canvas.height = data.image.height;

    await loadImage(uploadedImage).then(image =>
        canvasImage = image
    );
    ctx.drawImage(canvasImage, 0, 0);

    const points = data.predictions[0].points;
    hull = convexhull.makeHull(points);

    // Merge by distance
    let mergeDistance = canvas.width / 65;
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

    animateFrame();
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

function animateFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(canvasImage, 0, 0);

    if (isCalculated) {
        ctx.fillStyle = 'white';
        ctx.font = `${canvas.width / 75}px serif`;
        ctx.fillText('Click anywhere in field of play to see estimated distance from home plate.', 10, 25);

        ctx.font = `${canvas.width / 100}px serif`;
        ctx.fillText(`${getWorldCoordinates(markerPos)} feet`, markerPos.x + 10, markerPos.y);

        ctx.fillStyle = 'red';
        ctx.fillRect(markerPos.x - 3, markerPos.y - 3, 6, 6);

        if (mouseDown) {
            markerPos.x = mousePos.x;
            markerPos.y = mousePos.y;
        }

        for (let i = 0; i < wallData.length; i++) {
            ctx.fillStyle = 'lime';
            if (Math.sqrt(Math.pow(mousePos.x - wallData[i].x, 2) + Math.pow(mousePos.y - wallData[i].y, 2)) <= canvas.width / 140) {
                ctx.fillStyle = 'red';
                if (mouseDown) {
                    markerPos.x = wallData[i].x;
                    markerPos.y = wallData[i].y;
                }
            }
            ctx.fillRect(wallData[i].x - 2, wallData[i].y - 2, 4, 4);
        }

    } else {

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
        ctx.fillRect(hull[closestPointToClick].x - 8, hull[closestPointToClick].y - 8, 16, 16);

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
    }

    window.requestAnimationFrame(animateFrame);
}

function handleCanvasMouse(e) {
    let rect = e.target.getBoundingClientRect();

    mousePos.x = e.clientX - rect.left;
    mousePos.y = e.clientY - rect.top;
}

// User clicks on canvas
function handleCanvasClick() {
    // If not calculated add line/point to infield lines
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

// Initial calculations, runs once
async function runCalculations() {
    ctx.fillStyle = 'white';
    ctx.font = `${canvas.width / 5}px serif`;
    ctx.fillText(`Loading...`, 10, canvas.height / 2);

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
    let vanishingPoint1 = getIntersectionPoint(infieldLines[slopeIndicies[2]].p1, infieldLines[slopeIndicies[2]].p2, infieldLines[slopeIndicies[3]].p1, infieldLines[slopeIndicies[3]].p2);
    let vanishingPoint2 = getIntersectionPoint(infieldLines[slopeIndicies[0]].p1, infieldLines[slopeIndicies[0]].p2, infieldLines[slopeIndicies[1]].p1, infieldLines[slopeIndicies[1]].p2);

    utilPoints.vanishingPoint1 = vanishingPoint1;
    utilPoints.vanishingPoint2 = vanishingPoint2;

    // Find the corner of the first quadrilateral, we'll assume it is a perfect square as most infields are
    grid.push(
        new GridSquare(
            new GridPoint(getIntersectionPoint(infieldLines[slopeIndicies[0]].p1, infieldLines[slopeIndicies[0]].p2, infieldLines[slopeIndicies[2]].p1, infieldLines[slopeIndicies[2]].p2), new Point(0, 0)),
            new GridPoint(getIntersectionPoint(infieldLines[slopeIndicies[2]].p1, infieldLines[slopeIndicies[2]].p2, infieldLines[slopeIndicies[1]].p1, infieldLines[slopeIndicies[1]].p2), new Point(0, 0)),
            new GridPoint(getIntersectionPoint(infieldLines[slopeIndicies[1]].p1, infieldLines[slopeIndicies[1]].p2, infieldLines[slopeIndicies[3]].p1, infieldLines[slopeIndicies[3]].p2), new Point(0, 0)),
            new GridPoint(getIntersectionPoint(infieldLines[slopeIndicies[0]].p1, infieldLines[slopeIndicies[0]].p2, infieldLines[slopeIndicies[3]].p1, infieldLines[slopeIndicies[3]].p2), new Point(0, 0))
        )
    );

    // Update initial lengths, for testing purposes we will use 85 feet
    // This will change based on the field, will be updated soon based on pitcher's mound position
    // Left field line will be x while right field line will be y
    // TODO change for more accurate results
    squareLength = 86;
    grid[0].points[0].worldPoint = new Point(0, 0);
    grid[0].points[1].worldPoint = new Point(squareLength, 0);
    grid[0].points[2].worldPoint = new Point(squareLength, squareLength);
    grid[0].points[3].worldPoint = new Point(0, squareLength);
    grid[0].updatePoints();

    let middleVanishingPoint = getIntersectionPoint(vanishingPoint1, vanishingPoint2, grid[0].points[0].screenPoint, grid[0].points[2].screenPoint);
    utilPoints.middleVanishingPoint = middleVanishingPoint;

    // For debugging
    ctx.fillRect(middleVanishingPoint.x, middleVanishingPoint.y, 20, 20);

    // Branch to approximately 450 feet down the left field line
    for (let t = 0; t < 4; t++) {
        branchFromSquare(grid[grid.length - 1], 1, vanishingPoint1, vanishingPoint2, middleVanishingPoint);
    }

    // Now branch right from the left field line in order to form a large square
    for (let r = 0; r < 4; r++) {
        let startingLength = grid.length;
        for (let s = 0; s < 5; s++) {
            branchFromSquare(grid[startingLength - s - 1], 3, vanishingPoint1, vanishingPoint2, middleVanishingPoint);
        }
    }

    // Might as well show the grid because it looks cool
    //showGrid();
}

// Branches from square, rooted at index point of bottomPointIndex
function branchFromSquare(square, bottomPointIndex, vpL, vpR, vpMid) {
    // Where the next top point of the square will be, index 2
    let newTopPoint;

    // Check if it is branching left or right (1 or 3 respectively)
    switch (bottomPointIndex) {
        case 1:
            newTopPoint = getIntersectionPoint(vpMid, square.points[bottomPointIndex].screenPoint, square.points[2].screenPoint, square.points[3].screenPoint);
            grid.push(
                new GridSquare(
                    new GridPoint(square.points[bottomPointIndex].screenPoint, square.points[bottomPointIndex].worldPoint),
                    new GridPoint(getIntersectionPoint(vpR, newTopPoint, square.points[0].screenPoint, square.points[1].screenPoint), new Point(square.points[bottomPointIndex].worldPoint.x + squareLength, square.points[bottomPointIndex].worldPoint.y)),
                    new GridPoint(newTopPoint, new Point(square.points[bottomPointIndex].worldPoint.x + squareLength, square.points[bottomPointIndex].worldPoint.y + squareLength)),
                    new GridPoint(square.points[2].screenPoint, new Point(square.points[bottomPointIndex].worldPoint.x, square.points[bottomPointIndex].worldPoint.y + squareLength))
                )
            );
            break;
        case 3:
            newTopPoint = getIntersectionPoint(vpMid, square.points[bottomPointIndex].screenPoint, square.points[1].screenPoint, square.points[2].screenPoint);
            grid.push(
                new GridSquare(
                    new GridPoint(square.points[bottomPointIndex].screenPoint, square.points[bottomPointIndex].worldPoint),
                    new GridPoint(square.points[2].screenPoint, square.points[2].worldPoint),
                    new GridPoint(newTopPoint, new Point(square.points[bottomPointIndex].worldPoint.x + squareLength, square.points[bottomPointIndex].worldPoint.y + squareLength)),
                    new GridPoint(getIntersectionPoint(vpL, newTopPoint, square.points[0].screenPoint, square.points[3].screenPoint), new Point(square.points[bottomPointIndex].worldPoint.x, square.points[bottomPointIndex].worldPoint.y + squareLength))
                )
            );
            break;
        default:
            // If it's not 1 or 3 that doesn't make sense
            console.error("Invalid bottom point index.");
            break;
    }
}

// Converts screen coordinates to world coordinates
function getWorldCoordinates(point) {
    // First, find which of the initial 25 squares, if any, the point falls inside
    let boundingSquareIndex = -1;
    for (let i = 0; i < grid.length; i++) {
        if (pointInPolygon(point, grid[i].screenPoints)) {
            boundingSquareIndex = i;
            break;
        }
    }
    //console.log(boundingSquareIndex);

    // If it isn't within the grid then don't calculate it
    if (boundingSquareIndex == -1) {
        //alert("Point could not be calculated from grid, make sure point is within stadium walls and in fair territory.");
        return '?';
    }

    let closestPoint = new Point(0, 0);

    // Subdivide the bounding square
    let newGrids = grid[boundingSquareIndex];

    // Keeps subdividing grid 10 times until square is so small point should be accurate
    for (let sub = 0; sub < 10; sub++) {
        newGrids = subdivideSquare(newGrids);
        for (let i = 0; i < newGrids.length; i++) {
            if (pointInPolygon(point, newGrids[i].screenPoints)) {
                boundingSquareIndex = i;
                closestPoint = newGrids[i].worldPoints[0];
                newGrids = newGrids[i];
                break;
            }
        }
    }

    return Math.round(Math.sqrt(Math.pow(closestPoint.x, 2) + Math.pow(closestPoint.y, 2)));
}

// Subdivides given square
function subdivideSquare(square) {
    let screenPoints = square.screenPoints;
    let worldPoints = square.worldPoints;
    console.log(worldPoints);
    console.log(square);
    let newSquares = [];

    // Find the center of the square
    let centerPoint = getIntersectionPoint(screenPoints[0], screenPoints[2], screenPoints[1], screenPoints[3]);
    let centerPointWorld = new Point(getMiddlePoint(worldPoints[0], worldPoints[1]).x, getMiddlePoint(worldPoints[0], worldPoints[3]).y);

    // Bottom square
    newSquares.push(
        new GridSquare(
            new GridPoint(screenPoints[0], worldPoints[0]),
            new GridPoint(getIntersectionPoint(screenPoints[0], utilPoints.vanishingPoint1, centerPoint, utilPoints.vanishingPoint2), getMiddlePoint(worldPoints[0], worldPoints[1])),
            new GridPoint(centerPoint, centerPointWorld),
            new GridPoint(getIntersectionPoint(screenPoints[0], utilPoints.vanishingPoint2, centerPoint, utilPoints.vanishingPoint1), getMiddlePoint(worldPoints[0], worldPoints[3]))
        )
    );

    // Left square
    newSquares.push(
        new GridSquare(
            newSquares[0].points[1],
            new GridPoint(screenPoints[1], worldPoints[1]),
            new GridPoint(getIntersectionPoint(screenPoints[1], utilPoints.vanishingPoint2, centerPoint, utilPoints.vanishingPoint1), getMiddlePoint(worldPoints[1], worldPoints[2])),
            new GridPoint(centerPoint, centerPointWorld)
        )
    );

    // Top square
    newSquares.push(
        new GridSquare(
            new GridPoint(centerPoint, centerPointWorld),
            newSquares[1].points[2],
            new GridPoint(screenPoints[2], worldPoints[2]),
            new GridPoint(getIntersectionPoint(screenPoints[3], utilPoints.vanishingPoint1, centerPoint, utilPoints.vanishingPoint2), getMiddlePoint(worldPoints[2], worldPoints[3])),
        )
    );

    // Right square
    newSquares.push(
        new GridSquare(
            newSquares[0].points[3],
            new GridPoint(centerPoint, centerPointWorld),
            newSquares[2].points[3],
            new GridPoint(screenPoints[3], worldPoints[3]),
        )
    );

    /*
    // Shows subdivisions, for debugging
    for (let i = 0; i < newSquares.length; i++) {
        let tempSquare = newSquares[i];
        ctx.beginPath();
        ctx.moveTo(tempSquare.points[3].screenPoint.x, tempSquare.points[3].screenPoint.y);
        for (let p = 0; p < 4; p++) {
            // Vertex as square
            ctx.fillRect(tempSquare.points[p].screenPoint.x, tempSquare.points[p].screenPoint.y, 5, 5);

            ctx.lineTo(tempSquare.points[p].screenPoint.x, tempSquare.points[p].screenPoint.y);

            // Point's world coordinates
            ctx.fillText(`(${tempSquare.points[p].worldPoint.x}, ${tempSquare.points[p].worldPoint.y}) - ${p}`, tempSquare.points[p].screenPoint.x, tempSquare.points[p].screenPoint.y + 10);
        }
        ctx.stroke();
    }
    */

    return newSquares;
}

// Get possible wall points
function handleWallPoints(data) {
    wallData = data.predictions[0].points;
    console.log(wallData);

    let mergeDistance = canvas.width / 85;
    for (let i = 0; i < wallData.length; i++) {
        for (let p = i + 1; p < wallData.length; p++) {
            if (getDistance(wallData[i], wallData[p]) < mergeDistance) {
                wallData[i].x = getMidpoint(wallData[p].x, wallData[i].x);
                wallData[i].y = getMidpoint(wallData[p].y, wallData[i].y);
                wallData.splice(p, 1);
                p--;
            }
        }
    }
}

// Debugging purposes, renders the grid points
function showGrid() {
    ctx.fillStyle = 'cyan';
    ctx.font = '12px serif';
    ctx.lineWidth = 2;
    for (let i = 0; i < grid.length; i++) {
        let tempSquare = grid[i];
        ctx.beginPath();
        ctx.moveTo(tempSquare.points[3].screenPoint.x, tempSquare.points[3].screenPoint.y);
        for (let p = 0; p < 4; p++) {
            // Vertex as square
            //ctx.fillRect(tempSquare.points[p].screenPoint.x, tempSquare.points[p].screenPoint.y, 5, 5);

            ctx.lineTo(tempSquare.points[p].screenPoint.x, tempSquare.points[p].screenPoint.y);

            // Point's world coordinates
            ctx.fillText(`(${tempSquare.points[p].worldPoint.x}, ${tempSquare.points[p].worldPoint.y}) - ${p}`, tempSquare.points[p].screenPoint.x, tempSquare.points[p].screenPoint.y + 10);
        }
        ctx.stroke();
    }
}

// Returns intersection point of line through p1 + p2 and line through p3 + p4
function getIntersectionPoint(p1, p2, p3, p4) {
    var ua, ub, denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (denom == 0) {
        return null;
    }
    ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
    ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;
    return new Point(p1.x + ua * (p2.x - p1.x), p1.y + ua * (p2.y - p1.y));
}

// Returns if point is inside polygon, array of points
function pointInPolygon(point, polygon) {
    const num_vertices = polygon.length;
    const x = point.x;
    const y = point.y;
    let inside = false;

    let p1 = polygon[0];
    let p2;

    for (let i = 1; i <= num_vertices; i++) {
        p2 = polygon[i % num_vertices];

        if (y > Math.min(p1.y, p2.y)) {
            if (y <= Math.max(p1.y, p2.y)) {
                if (x <= Math.max(p1.x, p2.x)) {
                    const x_intersection = ((y - p1.y) * (p2.x - p1.x)) / (p2.y - p1.y) + p1.x;

                    if (p1.x === p2.x || x <= x_intersection) {
                        inside = !inside;
                    }
                }
            }
        }

        p1 = p2;
    }

    return inside;
}

// Returns middle of p1 and p2
function getMiddlePoint(p1, p2) {
    return new Point((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
}